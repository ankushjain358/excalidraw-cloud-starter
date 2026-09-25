# 006 Sync conflicts

## Context
Multiple devices can edit the same private drawing offline.

## Decision
Autosave debounces changes and serializes saves. Saves carry the expected metadata revision. A mismatch returns a conflict, retaining the local recovery scene and offering reload-cloud or save-as-copy.

## Reason
No device silently overwrites newer cloud work.

## Consequences
The UI reports saving, saved, offline, and error states and warns before navigation with pending work.
