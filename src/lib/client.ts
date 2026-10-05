import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

export const client = generateClient<Schema>();

export type Folder = {
  id: string;
  parentFolderId?: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceFile = {
  id: string;
  folderId?: string | null;
  name: string;
  itemType?: 'DRAWING' | 'UPLOAD' | null;
  s3Key: string;
  contentType?: string | null;
  size?: number | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

export function toWorkspaceFile(value: unknown): WorkspaceFile {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Workspace file response is invalid.');
  }
  const file = value as Record<string, unknown>;
  if (
    typeof file.id !== 'string' ||
    typeof file.name !== 'string' ||
    typeof file.s3Key !== 'string' ||
    typeof file.revision !== 'number' ||
    typeof file.createdAt !== 'string' ||
    typeof file.updatedAt !== 'string'
  ) {
    throw new Error('Workspace file response is incomplete.');
  }
  return {
    id: file.id,
    name: file.name,
    s3Key: file.s3Key,
    revision: file.revision,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    folderId: typeof file.folderId === 'string' ? file.folderId : null,
    itemType: file.itemType === 'DRAWING' || file.itemType === 'UPLOAD' ? file.itemType : null,
    contentType: typeof file.contentType === 'string' ? file.contentType : null,
    size: typeof file.size === 'number' ? file.size : null,
  };
}

export type SaveStatus = 'saved' | 'saving' | 'error';

export const blankScene = { type: 'excalidraw', version: 2, source: 'excalidraw-cloud-starter', elements: [], appState: {}, files: {} };
