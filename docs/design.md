# excalidraw-cloud-starter — Design Document

## Overview

Private, cloud-synced Excalidraw workspaces built with React, Vite, Amplify Gen 2, S3, and shadcn/ui. All authenticated users share a single data space — isolation relies on users not knowing each other's resource IDs, not on enforced ownership rules.

## Architecture

### Frontend
- `src/lib/client.ts` — Amplify `generateClient` instance and shared local types
- `src/hooks/useWorkspace.ts` — folder and drawing CRUD via direct Amplify model client (ORM style)
- `src/hooks/useDrawingEditor.ts` — active drawing state, autosave, conflict resolution, offline retry
- `src/components/WorkspaceView.tsx` — sidebar + drawing grid
- `src/components/EditorView.tsx` — editor header + Excalidraw canvas
- `src/App.tsx` — thin shell composing the two views

### Backend
- `amplify/data/resource.ts` — Amplify Gen 2 schema; all models use `allow.authenticated()`
- `amplify/functions/workspace/handler.ts` — Lambda for S3-backed operations only
- `amplify/backend.ts` — table grants and environment variables for the Lambda
- `amplify/storage/resource.ts` — S3 bucket; browser access denied, Lambda-only

## Data Models

All models get `id`, `createdAt`, and `updatedAt` automatically from Amplify.

- `User` — stable application UUID, email
- `IdentityLink` — maps Cognito `issuer + subject` → `User.id`; GSI on `issuer + subject`
- `Folder` — `name`, nullable `parentFolderId`
- `WorkspaceFile` — `name`, `itemType` (DRAWING | UPLOAD), `folderId`, `s3Key`, `revision`, `size`, `contentType`

## Lambda-backed Operations

Folder and file CRUD go directly through the model client. The Lambda handles only operations that require S3:

| Operation | Reason |
|---|---|
| `createDrawing` | Generates S3 key, writes scene bytes, writes DynamoDB row |
| `loadDrawing` | Reads scene bytes from S3 |
| `saveDrawing` | Writes new revision to S3, conditional DynamoDB update |
| `writeFileBytes` | Writes uploaded file bytes to S3, writes DynamoDB row |
| `readFileBytes` | Reads file bytes from S3, returns base64 |

## Identity and Migration

`User.id` is a stable generated UUID. On every S3-backed Lambda call, `resolveUserId` looks up the `IdentityLink` GSI by `issuer + subject`. If no link exists, a new `User` and `IdentityLink` are provisioned. S3 keys are namespaced `users/{User.id}/items/{file-id}/revisions/{revision}`.

For account recovery: locate the stable `User.id`, disable the old `IdentityLink`, create a new one for the new issuer/subject. S3 paths and ownership rows are untouched. Do not link accounts based on matching email alone.

## Scene Storage

Scenes are stored as complete `serializeAsJSON` payloads in S3. Each save writes to a new revision key (`revisions/{n}`), so a losing concurrent save can only leave an unreachable object — it cannot overwrite an accepted revision. The DynamoDB update uses a conditional expression on `revision` to detect conflicts.

## Sync and Conflict Handling

Autosave debounces at 900 ms and serializes saves through a promise chain. Each save carries `expectedRevision`. On a revision mismatch the Lambda returns `CONFLICT:{revision}`, the local scene is written to `localStorage` as a recovery record, and the UI offers two choices: reload cloud or save as copy. On reconnect, any pending recovery record is retried automatically.

Save status states: `saving` → `saved` | `offline` | `error`.

## Local Setup

1. `npm install`
2. Configure AWS credentials with Amplify backend deployment access
3. `npx ampx sandbox` in one terminal — generates `amplify_outputs.json`
4. `npm run dev` in another terminal

## Known Issue (Windows)

`npx ampx sandbox --once` may fail with `EPERM` when CDK tries to rename the Lambda bundle under `.amplify/artifacts/cdk.out`. Stop all active `ampx sandbox` watchers before retrying with `npx ampx sandbox --once --debug`.
