import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data, workspace } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, data, storage, workspace });

backend.data.resources.tables['WorkspaceFile'].grantReadWriteData(backend.workspace.resources.lambda);
backend.workspace.addEnvironment('WORKSPACEFILE_TABLE_NAME', backend.data.resources.tables['WorkspaceFile'].tableName);

