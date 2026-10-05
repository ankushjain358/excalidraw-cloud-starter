import { randomUUID } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const now = () => new Date().toISOString();
const bucket = () => process.env.WORKSPACE_OBJECTS_BUCKET_NAME!;
const table = (name: string) => process.env[`${name.toUpperCase()}_TABLE_NAME`]!;
const maxBytes = 5 * 1024 * 1024;
const toBody = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value);

type Identity = { sub?: string };
type Event = { fieldName: string; arguments: Record<string, unknown>; identity?: Identity };

function requireSub(identity: Identity | undefined): string {
  if (!identity?.sub) throw new Error('Authenticated identity is required.');
  return identity.sub;
}

async function s3Text(key: string) {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  return res.Body?.transformToString() ?? '';
}

export const handler = async (event: Event) => {
  try {
    const { fieldName, arguments: args, identity } = event;

    if (fieldName === 'createDrawing') {
      const sub = requireSub(identity);
      const scene = args.scene ?? { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
      const body = toBody(scene);
      if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
      const id = randomUUID();
      const ts = now();
      const s3Key = `users/${sub}/items/${id}/revisions/0`;
      const file = { id, folderId: args.folderId ?? undefined, name: (args.name as string).trim(), itemType: 'DRAWING', s3Key, contentType: 'application/json', size: Buffer.byteLength(body), revision: 0, owner: sub, createdAt: ts, updatedAt: ts };
      await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: body, ContentType: 'application/json' }));
      await db.send(new PutCommand({ TableName: table('WorkspaceFile'), Item: file }));
      return JSON.stringify(file);
    }

    if (fieldName === 'loadDrawing') {
      const sub = requireSub(identity);
      const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: args.fileId } }));
      const file = existing.Item;
      if (!file || file.itemType !== 'DRAWING') throw new Error('Drawing not found.');
      if (file.owner !== sub) throw new Error('Drawing not found.');
      return JSON.stringify({ file, scene: JSON.parse(await s3Text(file.s3Key)) });
    }

    if (fieldName === 'saveDrawing') {
      const sub = requireSub(identity);
      const { fileId, expectedRevision, scene } = args as { fileId: string; expectedRevision: number; scene: unknown };
      const body = toBody(scene);
      if (Buffer.byteLength(body) > maxBytes) throw new Error('Scene is too large (maximum 5 MB).');
      const existing = await db.send(new GetCommand({ TableName: table('WorkspaceFile'), Key: { id: fileId } }));
      const file = existing.Item;
      if (!file) throw new Error('Drawing not found.');
      if (file.owner !== sub) throw new Error('Drawing not found.');
      if (file.revision !== expectedRevision) throw new Error(`CONFLICT:${file.revision}`);
      const revision = expectedRevision + 1;
      const updatedAt = now();
      const s3Key = `users/${sub}/items/${fileId}/revisions/${revision}`;
      await s3.send(new PutObjectCommand({ Bucket: bucket(), Key: s3Key, Body: body, ContentType: 'application/json' }));
      await db.send(new UpdateCommand({
        TableName: table('WorkspaceFile'), Key: { id: fileId },
        UpdateExpression: 'SET revision = :next, updatedAt = :updated, s3Key = :key, size = :size',
        ConditionExpression: 'revision = :expected AND #owner = :owner',
        ExpressionAttributeNames: { '#owner': 'owner' },
        ExpressionAttributeValues: { ':next': revision, ':updated': updatedAt, ':key': s3Key, ':size': Buffer.byteLength(body), ':expected': expectedRevision, ':owner': sub },
      }));
      return JSON.stringify({ revision, updatedAt });
    }

    throw new Error(`Unsupported operation: ${fieldName}`);
  } catch (err) {
    if (err instanceof Error && (
      err.message.startsWith('CONFLICT:') ||
      err.message === 'Authenticated identity is required.' ||
      err.message === 'Scene is too large (maximum 5 MB).' ||
      err.message === 'Drawing not found.'
    )) throw err;
    console.error('Workspace handler error:', err);
    throw new Error('An unexpected error occurred. Please try again.');
  }
};
