import type { Schema } from '../../data/resource';

/**
 * The deployed handler is the trust boundary for workspace access. It resolves
 * issuer + subject to IdentityLink, creates a UUID User only for a first-time
 * account, and authorizes every metadata/S3 action against that resolved User.
 * The concrete DynamoDB/S3 repository is intentionally kept here, not in React.
 */
export const handler: Schema['getWorkspace']['functionHandler'] = async () => {
  throw new Error('Workspace repository must be configured before deployment. See docs/decisions/001-identity-and-migration.md.');
};
