import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { auth } from './auth/resource';
import { data, workspace } from './data/resource';
import { storage } from './storage/resource';

const backend = defineBackend({ auth, data, storage, workspace });

for (const model of ['User', 'IdentityLink', 'WorkspaceFile'] as const) {
  backend.data.resources.tables[model].grantReadWriteData(backend.workspace.resources.lambda);
  backend.workspace.addEnvironment(`${model.toUpperCase()}_TABLE_NAME`, backend.data.resources.tables[model].tableName);
}

// IdentityLink GSI for issuer+subject lookup on first login / S3 key resolution
const identityLinkTable = backend.data.resources.tables['IdentityLink'];
backend.workspace.resources.lambda.addToRolePolicy(new PolicyStatement({
  actions: ['dynamodb:Query'],
  resources: [`${identityLinkTable.tableArn}/index/*`],
}));

backend.workspace.addEnvironment('IDENTITYLINK_ISSUER_SUBJECT_INDEX_NAME', 'identityLinksByIssuerAndSubject');
