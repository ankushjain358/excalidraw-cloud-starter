# Development Session Handoff

Updated: 2026-10-02

## Project

`excalidraw-cloud-starter` is a React/Vite application using Excalidraw, Amplify Gen 2, and shadcn/ui. It is intended to be a self-hostable private Excalidraw workspace, not an affiliated Excalidraw product.

## Completed

- Scaffolded Vite, Amplify Gen 2, and shadcn/ui with their official CLIs.
- Configured Cognito email sign-in and a centered, shadcn-aligned Amplify Authenticator screen.
- Added a responsive workspace UI with folders, drawing cards, editor shell, import/export, theme toggle, and save status.
- Fixed the Excalidraw update loop by keeping API and change callback props stable.
- Added ADRs in `docs/decisions/` and project conventions in `AGENTS.md`.
- Defined stable application UUID models: `User`, `IdentityLink`, `Folder`, and `WorkspaceFile`.
- Added AppSync custom operations: `getWorkspace` and `saveDrawing`.
- Added a workspace Lambda that resolves/provisions an application User from Cognito issuer/subject, lists only that user’s metadata, and conditionally saves scene revisions to S3.
- Granted the Lambda generated-table access and private `users/*` object-path access. Browser S3 access remains denied.
- Added owner indexes and authenticated operations for folder/file creation, rename, move, deletion, scene loading, and mediated file-byte transfer.
- Migrated `src/App.tsx` to AppSync. `localStorage` now stores only failed drawing-save recovery records.
- Added serialized revisioned autosaves, offline retry, and reload-cloud/save-as-copy conflict actions.
- Moved drawing payloads to immutable revision-specific object keys, preventing a losing save race from overwriting accepted scene bytes.

## Current Limitation

The backend has not deployed successfully from this Windows workspace. `npx ampx sandbox --once` synthesizes and type-checks the backend, then CDK can fail renaming its generated Lambda bundle under `.amplify/artifacts/cdk.out` with `EPERM`. An active `ampx sandbox` watcher can hold that directory open; stop all watchers before retrying with `npx ampx sandbox --once --debug`.

Focused deployed-sandbox tests are still required for two-user isolation, complete scene round-trip including embedded files, folder behavior, and concurrent revision conflicts.

## Important Files
- `amplify/data/resource.ts`: schema and authenticated custom operations.
- `amplify/backend.ts`: Lambda-to-DynamoDB grants and table-name environment variables.
- `amplify/storage/resource.ts`: function-only S3 prefix authorization.
- `amplify/functions/workspace/handler.ts`: identity resolution, ownership checks, metadata mutations, and S3 object mediation.
- `src/App.tsx`: cloud-backed workspace/editor UI and failed-save recovery handling.
- `src/main.tsx` and `src/index.css`: authenticated application shell and styling.

## Required Next Work

1. Stop any active `ampx sandbox` watcher, resolve the Windows CDK bundle-directory lock, and deploy with `npx ampx sandbox --once --debug`.
2. Manually verify deployed create/load/save/import/export drawing operations, folder mutations, and mediated file-byte transfer.
3. Add and run focused integration tests for scene fidelity, user isolation, folder behavior, and revision conflicts.

## Verification Already Run

- `npx tsc --project amplify/tsconfig.json --noEmit` passed after the workspace-operation changes.
- `npm run build` passed after the frontend cloud migration.
- `npm run lint` completed with existing React Fast Refresh/hook warnings only.
- `npx ampx sandbox --once` synthesized and type-checked successfully, but did not deploy because of the Windows `EPERM` artifact rename failure.

## Notes

- The current sandbox may emit an AWS CDK `addDependency` deprecation warning. It is upstream and non-blocking.
- Do not authorize with an application user ID supplied by the browser.
- Do not use Cognito `sub` or email as a permanent owner key or as part of durable S3 keys.
- Drawing object keys are `users/{application-user-uuid}/items/{file-uuid}/revisions/{revision}`. Failed conditional saves may leave unreachable revision objects but cannot overwrite an accepted revision.
