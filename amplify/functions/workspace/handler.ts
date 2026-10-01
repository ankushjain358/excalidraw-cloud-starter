import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand, TransactWriteCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const database = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const storage = new S3Client({});
const now = () => new Date().toISOString();
const emptyScene = { type: 'excalidraw', version: 2, source: 'excalidraw-cloud-starter', elements: [], appState: {}, files: {} };
const maxObjectBytes = 5 * 1024 * 1024;

type Claims = { sub?: string; iss?: string; email?: string };
type Event = { info: { fieldName: string }; arguments: Record<string, unknown>; identity?: { claims?: Claims } };

const table = (name: string) => process.env[`${name.toUpperCase()}_TABLE_NAME`]!;

async function appUser(event: Event) {
  const claims = event.identity?.claims;
  if (!claims?.sub || !claims.iss) throw new Error('Authenticated identity is required.');

  // Cognito values are lookup credentials only; ownership remains the generated UUID.
  const existing = await database.send(new QueryCommand({
    TableName: table('IdentityLink'),
    IndexName: process.env.IDENTITYLINK_ISSUER_SUBJECT_INDEX_NAME,
    KeyConditionExpression: 'issuer = :issuer AND subject = :subject',
    ExpressionAttributeValues: { ':issuer': claims.iss, ':subject': claims.sub },
  }));
  if (existing.Items?.[0]?.userId) return existing.Items[0].userId as string;

  const userId = randomUUID();
  const timestamp = now();
  await database.send(new PutCommand({ TableName: table('User'), Item: { id: userId, email: claims.email, createdAtUtc: timestamp, updatedAtUtc: timestamp } }));
  await database.send(new PutCommand({ TableName: table('IdentityLink'), Item: { id: randomUUID(), userId, issuer: claims.iss, subject: claims.sub, linkedAtUtc: timestamp } }));
  return userId;
}

async function ownedItems(model: 'Folder' | 'WorkspaceFile', ownerUserId: string) {
  const result = await database.send(new QueryCommand({
    TableName: table(model),
    IndexName: process.env[`${model.toUpperCase()}_OWNER_INDEX_NAME`],
    KeyConditionExpression: 'ownerUserId = :owner',
    ExpressionAttributeValues: { ':owner': ownerUserId },
  }));
  return result.Items ?? [];
}

async function ownedItem(model: 'Folder' | 'WorkspaceFile', id: string, ownerUserId: string) {
  const result = await database.send(new GetCommand({ TableName: table(model), Key: { id } }));
  const item = result.Item;
  if (!item || item.ownerUserId !== ownerUserId) throw new Error(`${model === 'Folder' ? 'Folder' : 'File'} not found.`);
  return item;
}

const cleanName = (value: unknown, label: string) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 200) throw new Error(`A ${label} between 1 and 200 characters is required.`);
  return value.trim();
};
const nullableId = (value: unknown) => value === null || value === undefined ? null : typeof value === 'string' ? value : (() => { throw new Error('Invalid ID.'); })();
const sceneBytes = (scene: unknown) => {
  const bytes = Buffer.byteLength(JSON.stringify(scene));
  if (bytes > maxObjectBytes) throw new Error('Scene is too large (maximum 5 MB).');
  return bytes;
};
async function assertFolder(ownerUserId: string, folderId: string | null) {
  if (folderId) await ownedItem('Folder', folderId, ownerUserId);
}
async function objectText(key: string) {
  const response = await storage.send(new GetObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: key }));
  return response.Body?.transformToString() ?? '';
}

export const handler = async (event: Event) => {
  const userId = await appUser(event);
  if (event.info.fieldName === 'getWorkspace') {
    const [folders, files] = await Promise.all([ownedItems('Folder', userId), ownedItems('WorkspaceFile', userId)]);
    return { userId, folders, files };
  }

  if (event.info.fieldName === 'saveDrawing') {
    const fileId = event.arguments.fileId as string;
    const expectedRevision = event.arguments.expectedRevision as number;
    const scene = event.arguments.scene;
    const file = await ownedItem('WorkspaceFile', fileId, userId);
    if (file.itemType !== 'DRAWING') throw new Error('Drawing not found.');
    if (file.revision !== expectedRevision) throw new Error(`CONFLICT:${file.revision}`);

    const revision = expectedRevision + 1;
    const updatedAtUtc = now();
    // Each revision has a distinct key. A losing conditional update can leave only
    // an unreachable object; it can never overwrite the winning revision's bytes.
    sceneBytes(scene);
    const s3Key = `users/${userId}/items/${fileId}/revisions/${revision}`;
    await storage.send(new PutObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: s3Key, Body: JSON.stringify(scene), ContentType: 'application/json' }));
    await database.send(new UpdateCommand({
      TableName: table('WorkspaceFile'), Key: { id: fileId },
      UpdateExpression: 'SET revision = :next, updatedAtUtc = :updated, s3Key = :s3Key, size = :size',
      ConditionExpression: 'ownerUserId = :owner AND revision = :expected',
      ExpressionAttributeValues: { ':next': revision, ':updated': updatedAtUtc, ':s3Key': s3Key, ':size': Buffer.byteLength(JSON.stringify(scene)), ':owner': userId, ':expected': expectedRevision },
    }));
    return { revision, updatedAtUtc };
  }
  if (event.info.fieldName === 'loadDrawing') {
    const file = await ownedItem('WorkspaceFile', event.arguments.fileId as string, userId);
    if (file.itemType !== 'DRAWING') throw new Error('Drawing not found.');
    return { file, scene: JSON.parse(await objectText(file.s3Key)) };
  }
  if (event.info.fieldName === 'createFolder') {
    const parentFolderId = nullableId(event.arguments.parentFolderId);
    await assertFolder(userId, parentFolderId);
    const timestamp = now();
    const folder = { id: randomUUID(), ownerUserId: userId, parentFolderId, name: cleanName(event.arguments.name, 'folder name'), createdAtUtc: timestamp, updatedAtUtc: timestamp };
    await database.send(new PutCommand({ TableName: table('Folder'), Item: folder }));
    return folder;
  }
  if (event.info.fieldName === 'renameFolder') {
    const folder = await ownedItem('Folder', event.arguments.folderId as string, userId);
    folder.name = cleanName(event.arguments.name, 'folder name'); folder.updatedAtUtc = now();
    await database.send(new PutCommand({ TableName: table('Folder'), Item: folder })); return folder;
  }
  if (event.info.fieldName === 'moveFolder') {
    const folder = await ownedItem('Folder', event.arguments.folderId as string, userId);
    const parentFolderId = nullableId(event.arguments.parentFolderId);
    if (parentFolderId === folder.id) throw new Error('A folder cannot contain itself.');
    let cursor = parentFolderId;
    while (cursor) { const parent = await ownedItem('Folder', cursor, userId); if (parent.id === folder.id) throw new Error('Folders cannot contain a cycle.'); cursor = parent.parentFolderId ?? null; }
    folder.parentFolderId = parentFolderId; folder.updatedAtUtc = now();
    await database.send(new PutCommand({ TableName: table('Folder'), Item: folder })); return folder;
  }
  if (event.info.fieldName === 'deleteFolder') {
    const folder = await ownedItem('Folder', event.arguments.folderId as string, userId);
    const [folders, files] = await Promise.all([ownedItems('Folder', userId), ownedItems('WorkspaceFile', userId)]);
    if (folders.some((item) => item.parentFolderId === folder.id)) throw new Error('Move or delete child folders first.');
    const timestamp = now();
    await database.send(new TransactWriteCommand({ TransactItems: [
      ...files.filter((item) => item.folderId === folder.id).map((item) => ({ Update: { TableName: table('WorkspaceFile'), Key: { id: item.id }, UpdateExpression: 'SET folderId = :root, updatedAtUtc = :updated', ExpressionAttributeValues: { ':root': null, ':updated': timestamp } } })),
      { Delete: { TableName: table('Folder'), Key: { id: folder.id }, ConditionExpression: 'ownerUserId = :owner', ExpressionAttributeValues: { ':owner': userId } } },
    ] }));
    return folder;
  }
  if (event.info.fieldName === 'createDrawing') {
    const folderId = nullableId(event.arguments.folderId); await assertFolder(userId, folderId);
    const scene = event.arguments.scene ?? emptyScene; sceneBytes(scene);
    const timestamp = now(); const id = randomUUID();
    const file = { id, ownerUserId: userId, folderId, name: cleanName(event.arguments.name, 'drawing name'), itemType: 'DRAWING', s3Key: `users/${userId}/items/${id}/revisions/0`, contentType: 'application/json', size: Buffer.byteLength(JSON.stringify(scene)), revision: 0, createdAtUtc: timestamp, updatedAtUtc: timestamp };
    await storage.send(new PutObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: file.s3Key, Body: JSON.stringify(scene), ContentType: file.contentType }));
    await database.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file })); return file;
  }
  if (event.info.fieldName === 'renameFile' || event.info.fieldName === 'moveFile') {
    const file = await ownedItem('WorkspaceFile', event.arguments.fileId as string, userId);
    if (event.info.fieldName === 'renameFile') file.name = cleanName(event.arguments.name, 'file name');
    else { const folderId = nullableId(event.arguments.folderId); await assertFolder(userId, folderId); file.folderId = folderId; }
    file.updatedAtUtc = now(); await database.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file })); return file;
  }
  if (event.info.fieldName === 'deleteFile') {
    const file = await ownedItem('WorkspaceFile', event.arguments.fileId as string, userId);
    await Promise.all([database.send(new DeleteCommand({ TableName: table('WorkspaceFile'), Key: { id: file.id }, ConditionExpression: 'ownerUserId = :owner', ExpressionAttributeValues: { ':owner': userId } })), storage.send(new DeleteObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: file.s3Key }))]);
    return file;
  }
  if (event.info.fieldName === 'writeFileBytes') {
    const base64 = event.arguments.base64; if (typeof base64 !== 'string') throw new Error('File content is required.');
    const bytes = Buffer.from(base64, 'base64'); if (bytes.byteLength > maxObjectBytes) throw new Error('File is too large (maximum 5 MB).');
    const folderId = nullableId(event.arguments.folderId); await assertFolder(userId, folderId);
    const timestamp = now(); const id = randomUUID(); const contentType = cleanName(event.arguments.contentType, 'content type');
    const file = { id, ownerUserId: userId, folderId, name: cleanName(event.arguments.name, 'file name'), itemType: 'UPLOAD', s3Key: `users/${userId}/items/${id}`, contentType, size: bytes.byteLength, revision: 0, createdAtUtc: timestamp, updatedAtUtc: timestamp };
    await storage.send(new PutObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: file.s3Key, Body: bytes, ContentType: contentType }));
    await database.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file })); return file;
  }
  if (event.info.fieldName === 'readFileBytes') {
    const file = await ownedItem('WorkspaceFile', event.arguments.fileId as string, userId);
    const response = await storage.send(new GetObjectCommand({ Bucket: process.env.workspaceObjects_BUCKET_NAME, Key: file.s3Key }));
    const bytes = await response.Body?.transformToByteArray();
    return { contentType: file.contentType ?? 'application/octet-stream', base64: Buffer.from(bytes ?? new Uint8Array()).toString('base64') };
  }
  throw new Error(`Unsupported workspace operation: ${event.info.fieldName}`);
};
