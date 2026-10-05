# excalidraw-cloud-starter — Design Document

## Overview

Private, cloud-synced Excalidraw workspaces built with React, Vite, Amplify Gen 2, S3, and shadcn/ui. Each user can only see and modify their own folders and drawings — enforced at the AppSync layer via Amplify owner-based authorization.

## Architecture

### Frontend
- `src/lib/client.ts` — Amplify `generateClient` instance and shared local types
- `src/hooks/useWorkspace.ts` — folder and drawing CRUD via direct Amplify model client (ORM style)
- `src/hooks/useDrawingEditor.ts` — active drawing state, autosave, conflict resolution, offline retry
- `src/workspace/WorkspaceApp.tsx` — top-level app shell; owns `folderId` state and wires workspace + editor
- `src/components/WorkspaceView.tsx` — sidebar + drawing grid; receives `folderId` and `onFolderChange` as props
- `src/components/EditorView.tsx` — editor header + Excalidraw canvas

### Backend
- `amplify/data/resource.ts` — Amplify Gen 2 schema; `Folder` and `WorkspaceFile` use `allow.owner()`
- `amplify/functions/workspace/handler.ts` — Lambda for S3-backed operations only
- `amplify/backend.ts` — table grants and environment variables for the Lambda
- `amplify/storage/resource.ts` — S3 bucket; browser access denied, Lambda-only

## Data Models

All models get `id`, `createdAt`, and `updatedAt` automatically from Amplify.

- `Folder` — `name`, nullable `parentFolderId`; `owner` is added automatically by Amplify
- `WorkspaceFile` — `name`, `itemType` (DRAWING | UPLOAD), `folderId`, `s3Key`, `revision`, `size`, `contentType`; `owner` is added automatically by Amplify

## Authorization

`Folder` and `WorkspaceFile` use `allow.owner()`. Amplify automatically:

- Adds an `owner` field (String) to the DynamoDB table — no need to declare it in the schema
- On create — auto-populates `owner` with `{cognito_user_pool_id}::{username}` (the Cognito `sub`)
- On list/get — AppSync injects a filter condition `owner = <calling user's identity>`, so users only ever receive their own records
- On update/delete — AppSync enforces `owner = <calling user's identity>` as a condition expression

No application-level filtering is needed in the frontend. The `User` and `IdentityLink` tables from earlier designs have been removed — the Cognito `sub` is the sole user identity.

## Lambda-backed Operations

Folder and file CRUD go directly through the model client. The Lambda handles only operations that require S3:

| Operation | Reason |
|---|---|
| `createDrawing` | Generates S3 key, writes scene bytes, writes DynamoDB row |
| `loadDrawing` | Reads scene bytes from S3 |
| `saveDrawing` | Writes new revision to S3, conditional DynamoDB update |
| `writeFileBytes` | Writes uploaded file bytes to S3, writes DynamoDB row |
| `readFileBytes` | Reads file bytes from S3, returns base64 |

The Lambda reads `identity.sub` directly from the AppSync event to namespace S3 keys: `users/{sub}/items/{file-id}/revisions/{revision}`.

## Folder and Drawing Relationship

- A `Folder` belongs to a user (via `owner`) and has an optional `parentFolderId` for future nesting support (not yet surfaced in the UI).
- A `WorkspaceFile` has an optional `folderId` linking it to a folder. `null` means root (All drawings).
- The active folder selection (`folderId`) is owned by `WorkspaceApp` and passed down to `WorkspaceView` as a controlled prop, so `onCreateDrawing` and `onCreateFolder` always receive the correct context.

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
