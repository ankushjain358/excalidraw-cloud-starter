import { defineStorage } from '@aws-amplify/backend';
import { workspace } from '../data/resource';

// No browser principal receives an S3 grant. The authenticated workspace
// function enforces stable application-user ownership before object access.
export const storage = defineStorage({
  name: 'workspaceObjects',
  // Only the trusted function may read or change stable application-ID paths.
  access: (allow) => ({ 'users/*': [allow.resource(workspace).to(['read', 'write', 'delete'])] }),
});
