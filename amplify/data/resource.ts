import { type ClientSchema, a, defineData, defineFunction } from '@aws-amplify/backend';

// Browser clients only call these operations. The function derives the app user
// from the validated Cognito token and never accepts an owner id from the client.
const workspace = defineFunction({ entry: '../functions/workspace/handler.ts' });

const schema = a.schema({
  User: a.model({
    id: a.id().required(),
    email: a.email(),
    createdAtUtc: a.datetime().required(),
    updatedAtUtc: a.datetime().required(),
  }).identifier(['id']).authorization((allow) => [allow.resource(workspace)]),
  IdentityLink: a.model({
    id: a.id().required(),
    userId: a.id().required(),
    issuer: a.string().required(),
    subject: a.string().required(),
    linkedAtUtc: a.datetime().required(),
  }).identifier(['id']).authorization((allow) => [allow.resource(workspace)]),
  Folder: a.model({
    id: a.id().required(),
    ownerUserId: a.id().required(),
    parentFolderId: a.id(),
    name: a.string().required(),
    createdAtUtc: a.datetime().required(),
    updatedAtUtc: a.datetime().required(),
  }).identifier(['id']).authorization((allow) => [allow.resource(workspace)]),
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
  }).identifier(['id']).authorization((allow) => [allow.resource(workspace)]),
  WorkspaceSnapshot: a.customType({
    userId: a.id().required(),
    folders: a.json().required(),
    files: a.json().required(),
  }),
  SaveResult: a.customType({ revision: a.integer().required(), updatedAtUtc: a.datetime().required() }),
  Conflict: a.customType({ currentRevision: a.integer().required(), message: a.string().required() }),
  getWorkspace: a.query().returns(a.ref('WorkspaceSnapshot')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
  saveDrawing: a.mutation().arguments({ fileId: a.id().required(), expectedRevision: a.integer().required(), scene: a.json().required() }).returns(a.ref('SaveResult')).authorization((allow) => [allow.authenticated()]).handler(a.handler.function(workspace)),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'userPool' } });
