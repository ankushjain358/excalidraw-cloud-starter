# excalidraw-cloud-starter

Private, cloud-synced Excalidraw workspaces built with React, Vite, Amplify Gen 2, S3, and shadcn/ui.

## Local setup

1. Run `npm install`.
2. Configure AWS credentials with Amplify backend deployment access.
3. Run `npx ampx sandbox` in one terminal. It generates `amplify_outputs.json`.
4. Run `npm run dev` in another terminal.

Deploy with your Amplify Hosting Git connection or `npx ampx pipeline-deploy` in CI. No AWS credentials or secrets belong in frontend variables.

## Architecture

`User.id` is a stable application UUID. Cognito issuer/subject pairs are linked privately through `IdentityLink`; email is mutable profile data. Workspace metadata uses `Folder` and `WorkspaceFile`; display names are never object keys. Authenticated AppSync workspace operations mediate all folder, drawing, import/export, and byte-transfer actions. Browser S3 access is denied.

## Cognito migration/relinking

After verifying the person through a support-controlled recovery process, locate their stable User UUID, disable the retired issuer/subject link, and create an `IdentityLink` for the new issuer/subject. Refresh the User email from the new verified claim. Do not link accounts merely because emails match. Ownership rows and `users/{User.id}/...` S3 paths remain untouched.

## Sync behavior

The browser loads workspace metadata and scenes from AppSync. Autosaves are serialized and carry a revision; a revision mismatch presents reload-cloud and save-as-copy choices. Local storage is used only for the current drawing when a cloud save fails, then retried when connectivity returns. Scene and uploaded byte payloads are limited to 5 MB by the backend.
