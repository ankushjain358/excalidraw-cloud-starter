import { defineBackend, defineStorage } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';

// No browser principal receives an S3 grant. Workspace operations mint no keys;
// the authenticated workspace function reads and writes private stable-ID paths.
const storage = defineStorage({ name: 'workspaceObjects', access: () => ({}) });

defineBackend({ auth, data, storage });
