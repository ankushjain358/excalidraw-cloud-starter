import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

// Browser clients only call these operations. The function derives the app user
// from the validated Cognito token and never accepts an owner id from the client.
export const workspace = defineFunction({ entry: '../functions/workspace/handler.ts', resourceGroupName: 'data' });

const schema = a.schema({
  User: a.model({
    id: a.id().required(),
    email: a.email(),
    createdAtUtc: a.datetime().required(),
    updatedAtUtc: a.datetime().required(),
  }).identifier(['id']).authorization((allow) => [allow.groups(['workspace-service'])]),
  IdentityLink: a.model({
    id: a.id().required(),
    userId: a.id().required(),
    issuer: a.string().required(),
    subject: a.string().required(),
    linkedAtUtc: a.datetime().required(),
  }).identifier(['id']).secondaryIndexes((index) => [index('issuer').sortKeys(['subject'])]).authorization((allow) => [allow.groups(['workspace-service'])]),
  Folder: a.model({
    id: a.id().required(),
    ownerUserId: a.id().required(),
    parentFolderId: a.id(),
    name: a.string().required(),
    createdAtUtc: a.datetime().required(),
    updatedAtUtc: a.datetime().required(),
  }).identifier(['id']).secondaryIndexes((index) => [index('ownerUserId').sortKeys(['updatedAtUtc'])]).disableOperations(['mutations']).authorization((allow) => [allow.groups(['workspace-service'])]),
  WorkspaceFile: a.model({
    id: a.id().required(),
    ownerUserId: a.id().required(),
    folderId: a.id(),
    name: a.string().required(),
    itemType: a.enum(['DRAWING', 'UPLOAD']),
    s3Key: a.string().required(),
    contentType: a.string(),
    size: a.integer(),
    revision: a.integer().required(),
    createdAtUtc: a.datetime().required(),
    updatedAtUtc: a.datetime().required(),
  }).identifier(['id']).secondaryIndexes((index) => [index('ownerUserId').sortKeys(['updatedAtUtc'])]).authorization((allow) => [allow.groups(['workspace-service'])]),
  WorkspaceSnapshot: a.customType({
    userId: a.id().required(),
    folders: a.json().required(),
    files: a.json().required(),
  }),
  SaveResult: a.customType({ revision: a.integer().required(), updatedAtUtc: a.datetime().required() }),
  DrawingSnapshot: a.customType({ file: a.json().required(), scene: a.json().required() }),
  FileBytes: a.customType({ contentType: a.string().required(), base64: a.string().required() }),
  getWorkspace: a.query().returns(a.ref('WorkspaceSnapshot')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  loadDrawing: a.query().arguments({ fileId: a.id().required() }).returns(a.ref('DrawingSnapshot')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  readFileBytes: a.query().arguments({ fileId: a.id().required() }).returns(a.ref('FileBytes')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  createFolder: a.mutation().arguments({ name: a.string().required(), parentFolderId: a.id() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  renameFolder: a.mutation().arguments({ folderId: a.id().required(), name: a.string().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  moveFolder: a.mutation().arguments({ folderId: a.id().required(), parentFolderId: a.id() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  deleteFolder: a.mutation().arguments({ folderId: a.id().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  createDrawing: a.mutation().arguments({ name: a.string().required(), folderId: a.id(), scene: a.json().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  renameFile: a.mutation().arguments({ fileId: a.id().required(), name: a.string().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  moveFile: a.mutation().arguments({ fileId: a.id().required(), folderId: a.id() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  deleteFile: a.mutation().arguments({ fileId: a.id().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  saveDrawing: a.mutation().arguments({ fileId: a.id().required(), expectedRevision: a.integer().required(), scene: a.json().required() }).returns(a.ref('SaveResult')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  writeFileBytes: a.mutation().arguments({ name: a.string().required(), folderId: a.id(), contentType: a.string().required(), base64: a.string().required() }).returns(a.json().required()).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });
