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

export type SaveStatus = 'saved' | 'saving' | 'error';

export const blankScene = { type: 'excalidraw', version: 2, source: 'excalidraw-cloud-starter', elements: [], appState: {}, files: {} };
