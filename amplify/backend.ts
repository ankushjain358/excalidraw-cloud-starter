import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { workspace } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, data, storage, workspace });

// The function bypasses the public GraphQL model surface and receives access to
// only the generated tables it needs to enforce stable-user ownership itself.
for (const model of ['User', 'IdentityLink', 'Folder', 'WorkspaceFile'] as const) {
  backend.data.resources.tables[model].grantReadWriteData(backend.workspace.resources.lambda);
  backend.workspace.addEnvironment(`${model.toUpperCase()}_TABLE_NAME`, backend.data.resources.tables[model].tableName);
}

// DynamoDB table grants do not include secondary-index ARNs. The handler uses
// these indexes to resolve identity and enumerate the caller's workspace.
for (const model of ['IdentityLink', 'Folder', 'WorkspaceFile'] as const) {
  const table = backend.data.resources.tables[model];
  backend.workspace.resources.lambda.addToRolePolicy(new PolicyStatement({
    actions: ['dynamodb:Query'],
    resources: [`${table.tableArn}/index/*`],
  }));
}

backend.workspace.addEnvironment('IDENTITYLINK_ISSUER_SUBJECT_INDEX_NAME', 'issuer-subject-index');
backend.workspace.addEnvironment('FOLDER_OWNER_INDEX_NAME', 'ownerUserId-updatedAtUtc-index');
backend.workspace.addEnvironment('WORKSPACEFILE_OWNER_INDEX_NAME', 'ownerUserId-updatedAtUtc-index');
