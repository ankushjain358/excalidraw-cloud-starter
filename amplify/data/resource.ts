import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

export const workspace = defineFunction({ entry: '../functions/workspace/handler.ts', resourceGroupName: 'data' });

const schema = a.schema({
  User: a.model({
    id: a.id().required(),
    email: a.email(),
  }).identifier(['id']).authorization((allow) => [allow.authenticated()]),

  IdentityLink: a.model({
    id: a.id().required(),
    userId: a.id().required(),
    issuer: a.string().required(),
    subject: a.string().required(),
  }).identifier(['id']).secondaryIndexes((index) => [index('issuer').sortKeys(['subject'])]).authorization((allow) => [allow.authenticated()]),

  Folder: a.model({
    parentFolderId: a.id(),
    name: a.string().required(),
  }).authorization((allow) => [allow.authenticated()]),

  WorkspaceFile: a.model({
    folderId: a.id(),
    name: a.string().required(),
    itemType: a.enum(['DRAWING', 'UPLOAD']),
    s3Key: a.string().required(),
    contentType: a.string(),
    size: a.integer(),
    revision: a.integer().required(),
  }).authorization((allow) => [allow.authenticated()]),

  createDrawing: a.mutation()
    .arguments({ name: a.string().required(), folderId: a.id(), scene: a.json().required() })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(workspace)),

  saveDrawing: a.mutation()
    .arguments({ fileId: a.id().required(), expectedRevision: a.integer().required(), scene: a.json().required() })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(workspace)),

  loadDrawing: a.query()
    .arguments({ fileId: a.id().required() })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(workspace)),

  readFileBytes: a.query()
    .arguments({ fileId: a.id().required() })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(workspace)),

  writeFileBytes: a.mutation()
    .arguments({ name: a.string().required(), folderId: a.id(), contentType: a.string().required(), base64: a.string().required() })
    .returns(a.string().required())
    .authorization((allow) => [allow.authenticated()])
    .handler(a.handler.function(workspace)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });
