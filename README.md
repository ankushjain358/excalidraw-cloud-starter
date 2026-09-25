# SketchVault

Private, cloud-synced Excalidraw workspaces built with React, Vite, Amplify Gen 2, S3, and shadcn/ui.

## Local setup

1. Run `npm install`.
2. Configure AWS credentials with Amplify backend deployment access.
3. Run `npx ampx sandbox` in one terminal. It generates `amplify_outputs.json`.
4. Run `npm run dev` in another terminal.

Deploy with your Amplify Hosting Git connection or `npx ampx pipeline-deploy` in CI. No AWS credentials or secrets belong in frontend variables.

## Architecture

`User.id` is a stable application UUID. Cognito issuer/subject pairs are linked privately through `IdentityLink`; email is mutable profile data. Workspace metadata uses `Folder` and `WorkspaceFile`; display names are never object keys. See the ADRs in `docs/decisions/` for the authorization, S3, hierarchy, scene, and conflict rules.

## Cognito migration/relinking

After verifying the person through a support-controlled recovery process, locate their stable User UUID, disable the retired issuer/subject link, and create an `IdentityLink` for the new issuer/subject. Refresh the User email from the new verified claim. Do not link accounts merely because emails match. Ownership rows and `users/{User.id}/...` S3 paths remain untouched.

## Current implementation note

The frontend provides the authenticated workspace shell and local recovery behavior. The generated workspace Lambda currently documents, but does not yet implement, the DynamoDB/S3 repository required for cloud object operations; it deliberately throws rather than weakening authorization. Complete that repository and its isolation/conflict tests before production deployment.
