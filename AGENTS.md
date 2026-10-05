# excalidraw-cloud-starter agent guide

Read `docs/design.md` before changing authorization, storage, folders, scenes, or synchronization.

## Key rules

- **Ownership is enforced by AppSync.** `Folder` and `WorkspaceFile` use `allow.owner().inOwnerField('owner')`. Amplify stamps the Cognito `sub` on create and filters all reads automatically. Never add application-level ownership filtering on top of this.
- **The Cognito `sub` is the user identity.** There is no separate `User` or `IdentityLink` table. Do not reintroduce stable UUID indirection unless a Cognito migration requirement is explicitly raised.
- **Never grant browser principals S3 access.** All S3 reads and writes go through the Lambda resolver. The browser never holds S3 credentials or constructs S3 keys.
- **`folderId` is controlled state.** It lives in `WorkspaceApp` and is passed down as a prop. `onCreateDrawing` and `onCreateFolder` must always receive the active `folderId` from the parent — do not re-introduce local folder state in `WorkspaceView`.
- **Scene persistence must stay complete and revisioned.** Every save writes a new S3 revision key. Never overwrite an existing revision key. Keep conflict detection (`CONFLICT:{revision}`) intact.

## Layout

- UI: `src/` — components, hooks, workspace shell
- Backend resources: `amplify/` — schema, Lambda, auth, storage
- Design reference: `docs/design.md`

Update `docs/design.md` when changing a project-wide convention.
