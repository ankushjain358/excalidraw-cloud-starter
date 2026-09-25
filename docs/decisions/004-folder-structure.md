# 004 Folder structure

## Context
A tree needs stable references and predictable deletion.

## Decision
Folders use UUID `id`, stable `ownerUserId`, and nullable `parentFolderId`. Items use nullable `folderId`. Deleting a nonempty folder moves its direct items to the root; child folders are rejected until moved or deleted.

## Reason
The behavior is explicit and avoids accidental recursive deletion.

## Consequences
Move validation must reject cycles and cross-owner parents.
