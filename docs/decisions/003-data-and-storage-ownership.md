# 003 Data and S3 ownership

## Context
Amplify Storage `{entity_id}` is an Identity Pool identity, which is not a stable app UUID.

## Decision
Use immutable object keys of the form `users/{application-user-uuid}/items/{file-uuid}/revisions/{revision}`. Display names remain metadata. Browser S3 access is denied; the authorized workspace backend mediates object reads and writes.

## Reason
Renames and identity relinking do not move bytes or alter ownership.

## Consequences
The backend must enforce object ownership before issuing a response or changing an object.
