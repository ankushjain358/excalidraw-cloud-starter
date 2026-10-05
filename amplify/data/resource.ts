import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

export const workspace = defineFunction({ entry: '../functions/workspace/handler.ts', resourceGroupName: 'data' });

// How allow.owner() works:
// Amplify Gen 2 automatically adds an `owner` field (String) to the DynamoDB table.
// On create  — auto-populates `owner` with `{cognito_user_pool_id}::{username}` (the Cognito sub).
// On list/get — AppSync injects a filter: owner = <calling user's identity>, so users only see their own records.
// On update/delete — AppSync enforces owner = <calling user's identity> as a condition expression.
const schema = a.schema({
  Folder: a.model({
    parentFolderId: a.id(),
    name: a.string().required(),
  }).authorization((allow) => [allow.owner()]),

  WorkspaceFile: a.model({
    folderId: a.id(),
    name: a.string().required(),
    itemType: a.enum(['DRAWING', 'UPLOAD']),
    s3Key: a.string().required(),
    contentType: a.string(),
    size: a.integer(),
    revision: a.integer().required(),
  }).authorization((allow) => [allow.owner()]),

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

});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });
