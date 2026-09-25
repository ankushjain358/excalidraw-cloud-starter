# SketchVault agent guide

Read `docs/decisions/` before changing identity, authorization, storage, folders, scenes, or synchronization. Application UUIDs are permanent ownership keys; Cognito subjects and email are not. Never grant browser principals access to stable-ID S3 paths or accept an owner ID from the browser.

The UI lives in `src/`; Gen 2 resources live in `amplify/`. Keep scene persistence complete (elements, app state, files), revisioned, and conflict-aware. Update the relevant ADR and README when changing a project-wide convention.
