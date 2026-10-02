import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const now = () => new Date().toISOString();
const bucket = () => process.env.workspaceObjects_BUCKET_NAME!;
const table = (name: string) => process.env[`${name.toUpperCase()}_TABLE_NAME`]!;
const maxBytes = 5 * 1024 * 1024;

type Claims = { sub?: string; iss?: string; email?: string };
type Event = { info: { fieldName: string }; arguments: Record<string, unknown>; identity?: { claims?: Claims } };

// Resolves or provisions the stable app UUID for S3 key namespacing
async function resolveUserId(event: Event): Promise<string> {
  const claims = event.identity?.claims;
  if (!claims?.sub || !claims.iss) throw new Error('Authenticated identity is required.');
  const existing = await db.send(new QueryCommand({
    TableName: table('IdentityLink'),
    IndexName: process.env.IDENTITYLINK_ISSUER_SUBJECT_INDEX_NAME,
    KeyConditionExpression: 'issuer = :iss AND subject = :sub',
    ExpressionAttributeValues: { ':iss': claims.iss, ':sub': claims.sub },
  }));
  if (existing.Items?.[0]?.userId) return existing.Items[0].userId as string;
  const userId = randomUUID();
  const ts = now();
  await db.send(new PutCommand({ TableName: table('User'), Item: { id: userId, email: claims.email, createdAt: ts, updatedAt: ts } }));
  await db.send(new PutCommand({ TableName: table('IdentityLink'), Item: { id: randomUUID(), userId, issuer: claims.iss, subject: claims.sub, createdAt: ts, updatedAt: ts } }));
  return userId;
}

async function s3Text(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body?.transformToString() ?? '';
}

export const handler = async (event: Event) => {
  const args = event.arguments;

  if (event.info.fieldName === 'createDrawing') {
    const userId = await resolveUserId(event);
    const scene = args.scene ?? { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
    const body = JSON.stringify(scene);
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
    const id = randomUUID();
    const ts = now();
    const s3Key = `users/${userId}/items/${id}/revisions/0`;
    const file = { id, folderId: args.folderId ?? null, name: (args.name as string).trim(), itemType: 'DRAWING', s3Key, contentType: 'application/json', size: Buffer.byteLength(body), revision: 0, createdAt: ts, updatedAt: ts };
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: body, ContentType: 'application/json' }));
    await db.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file }));
    return JSON.stringify(file);
  }

  if (event.info.fieldName === 'loadDrawing') {
    const { data: file } = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: args.fileId } })) as any;
    if (!file || file.itemType !== 'DRAWING') throw new Error('Drawing not found.');
    return JSON.stringify({ file, scene: JSON.parse(await s3Text(file.s3Key)) });
  }

  if (event.info.fieldName === 'saveDrawing') {
    const { fileId, expectedRevision, scene } = args as { fileId: string; expectedRevision: number; scene: unknown };
    const body = JSON.stringify(scene);
    if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
    const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: fileId } }));
    const file = existing.Item;
    if (!file) throw new Error('Drawing not found.');
    if (file.revision !== expectedRevision) throw new Error(`CONFLICT:${file.revision}`);
    const userId = await resolveUserId(event);
    const revision = expectedRevision + 1;
    const updatedAt = now();
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

  if (event.info.fieldName === 'writeFileBytes') {
    const userId = await resolveUserId(event);
    const bytes = Buffer.from(args.base64 as string, 'base64');
    if (bytes.byteLength > maxBytes) throw new Error('File is too large (maximum 5 MB).');
    const id = randomUUID();
    const ts = now();
    const contentType = (args.contentType as string).trim();
    const s3Key = `users/${userId}/items/${id}`;
    const file = { id, folderId: args.folderId ?? null, name: (args.name as string).trim(), itemType: 'UPLOAD', s3Key, contentType, size: bytes.byteLength, revision: 0, createdAt: ts, updatedAt: ts };
    await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: bytes, ContentType: contentType }));
    await db.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file }));
    return JSON.stringify(file);
  }

  if (event.info.fieldName === 'readFileBytes') {
    const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: args.fileId } }));
    const file = existing.Item;
    if (!file) throw new Error('File not found.');
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: file.s3Key }));
    const data = await res.Body?.transformToByteArray();
    return JSON.stringify({ contentType: file.contentType ?? 'application/octet-stream', base64: Buffer.from(data ?? new Uint8Array()).toString('base64') });
  }

  throw new Error(`Unsupported operation: ${event.info.fieldName}`);
};
