import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const now = () => new Date().toISOString();
const bucket = () => process.env.WORKSPACE_OBJECTS_BUCKET_NAME!;
// Resolves the Amplify-generated table name env var, e.g. table('WorkspaceFile') → WORKSPACEFILE_TABLE_NAME
const table = (name: string) => process.env[`${name.toUpperCase()}_TABLE_NAME`]!;
const maxBytes = 5 * 1024 * 1024;
// AppSync passes a.json() arguments as already-parsed objects, not strings
const toBody = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

// AppSync Cognito identity shape for direct Lambda resolvers.
// sub and issuer are top-level on identity; email is inside claims.
type Identity = { sub?: string; issuer?: string; claims?: { email?: string } };
type Event = { fieldName: string; arguments: Record<string, unknown>; identity?: Identity };

/**
 * Resolves the stable application UUID for the caller.
 * On first call, provisions a User row and an IdentityLink mapping
 * issuer+subject → userId. Subsequent calls return the existing userId.
 * S3 keys are namespaced under users/{userId}/... so they survive Cognito migrations.
 */
async function resolveUserId(identity: Identity | undefined): Promise<string> {
  const { sub, issuer, claims } = identity ?? {};
  if (!sub || !issuer) throw new Error('Authenticated identity is required.');

  // Look up existing issuer+subject link via GSI
  const existing = await db.send(new QueryCommand({
    TableName: table('IdentityLink'),
    IndexName: process.env.IDENTITYLINK_ISSUER_SUBJECT_INDEX_NAME,
    KeyConditionExpression: 'issuer = :iss AND subject = :sub',
    ExpressionAttributeValues: { ':iss': issuer, ':sub': sub },
  }));
  if (existing.Items?.[0]?.userId) return existing.Items[0].userId as string;

  // First login — provision stable User UUID and link it to this Cognito identity
  const userId = randomUUID();
  const ts = now();
  await db.send(new PutCommand({ TableName: table('User'), Item: { id: userId, email: claims?.email, createdAt: ts, updatedAt: ts } }));
  await db.send(new PutCommand({ TableName: table('IdentityLink'), Item: { id: randomUUID(), userId, issuer, subject: sub, createdAt: ts, updatedAt: ts } }));
  return userId;
}

/** Reads an S3 object and returns its body as a UTF-8 string. */
async function s3Text(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body?.transformToString() ?? '';
}

/**
 * Single Lambda handler for all AppSync custom operations.
 * Folder and WorkspaceFile CRUD goes through the Amplify model client directly.
 * Only operations that require S3 access are routed here.
 */
export const handler = async (event: Event) => {
  try {
  const { fieldName, arguments: args, identity } = event;

  // --- createDrawing ---
  // Writes the initial scene to S3 under a stable user-namespaced key,
  // then creates the WorkspaceFile metadata row in DynamoDB.
  if (fieldName === 'createDrawing') {
    const userId = await resolveUserId(identity);
    const scene = args.scene ?? { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
    const body = toBody(scene);
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
    const id = randomUUID();
    const ts = now();
    const s3Key = `users/${userId}/items/${id}/revisions/0`;
    const file = { id, folderId: args.folderId ?? undefined, name: (args.name as string).trim(), itemType: 'DRAWING', s3Key, contentType: 'application/json', size: Buffer.byteLength(body), revision: 0, createdAt: ts, updatedAt: ts };
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: body, ContentType: 'application/json' }));
    await db.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file }));
    return JSON.stringify(file);
  }

  // --- loadDrawing ---
  // Fetches the WorkspaceFile metadata row, then reads the scene bytes from S3.
  // No userId needed — s3Key is stored on the row.
  if (fieldName === 'loadDrawing') {
    const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: args.fileId } }));
    const file = existing.Item;
    if (!file || file.itemType !== 'DRAWING') throw new Error('Drawing not found.');
    return JSON.stringify({ file, scene: JSON.parse(await s3Text(file.s3Key)) });
  }

  // --- saveDrawing ---
  // Writes the new scene revision to a distinct S3 key (prevents a losing
  // concurrent save from overwriting an accepted revision), then conditionally
  // updates the DynamoDB row. A revision mismatch throws CONFLICT:{revision}
  // so the frontend can offer reload-cloud or save-as-copy.
  if (fieldName === 'saveDrawing') {
    const userId = await resolveUserId(identity);
    const { fileId, expectedRevision, scene } = args as { fileId: string; expectedRevision: number; scene: unknown };
    const body = toBody(scene);
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
    const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: fileId } }));
    const file = existing.Item;
    if (!file) throw new Error('Drawing not found.');
    if (file.revision !== expectedRevision) throw new Error(`CONFLICT:${file.revision}`);
    const revision = expectedRevision + 1;
    const updatedAt = now();
    // Each revision gets its own S3 key — a failed conditional update leaves only an unreachable object
    const s3Key = `users/${userId}/items/${fileId}/revisions/${revision}`;
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: body, ContentType: 'application/json' }));
    await db.send(new UpdateCommand({
      TableName: table('WorkspaceFile'), Key: { id: fileId },
      UpdateExpression: 'SET revision = :next, updatedAt = :updated, s3Key = :key, size = :size',
      ConditionExpression: 'revision = :expected',
      ExpressionAttributeValues: { ':next': revision, ':updated': updatedAt, ':key': s3Key, ':size': Buffer.byteLength(body), ':expected': expectedRevision },
    }));
    return JSON.stringify({ revision, updatedAt });
  }

  // --- writeFileBytes ---
  // Decodes a base64 payload and writes it to S3, then creates the WorkspaceFile row.
  if (fieldName === 'writeFileBytes') {
    const userId = await resolveUserId(identity);
    const bytes = Buffer.from(args.base64 as string, 'base64');
    if (bytes.byteLength > maxBytes) throw new Error('File is too large (maximum 5 MB).');
    const id = randomUUID();
    const ts = now();
    const contentType = (args.contentType as string).trim();
    const s3Key = `users/${userId}/items/${id}`;
    const file = { id, folderId: args.folderId ?? undefined, name: (args.name as string).trim(), itemType: 'UPLOAD', s3Key, contentType, size: bytes.byteLength, revision: 0, createdAt: ts, updatedAt: ts };
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: bytes, ContentType: contentType }));
    await db.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file }));
    return JSON.stringify(file);
  }

  // --- readFileBytes ---
  // Reads raw bytes from S3 and returns them as a base64 string.
  // No userId needed — s3Key is stored on the row.
  if (fieldName === 'readFileBytes') {
    const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: args.fileId } }));
    const file = existing.Item;
    if (!file) throw new Error('File not found.');
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: file.s3Key }));
    const data = await res.Body?.transformToByteArray();
    return JSON.stringify({ contentType: file.contentType ?? 'application/octet-stream', base64: Buffer.from(data ?? new Uint8Array()).toString('base64') });
  }

  throw new Error(`Unsupported operation: ${fieldName}`);
  } catch (err) {
    if (err instanceof Error && (
      err.message.startsWith('CONFLICT:') ||
      err.message === 'Authenticated identity is required.' ||
      err.message === 'Scene is too large (maximum 5 MB).' ||
      err.message === 'File is too large (maximum 5 MB).' ||
      err.message === 'Drawing not found.' ||
      err.message === 'File not found.'
    )) throw err;
    console.error('Workspace handler error:', err);
    throw new Error('An unexpected error occurred. Please try again.');
  }
};
