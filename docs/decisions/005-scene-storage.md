# 005 Scene storage

## Context
Editable Excalidraw scenes include elements, app state, and embedded image files.

## Decision
Persist the complete `serializeAsJSON` payload in the item object, and store the metadata revision separately.

## Reason
Reloading preserves editable images and does not depend on transient canvas state.

## Consequences
Large scenes need object upload progress and a size limit at the backend.
