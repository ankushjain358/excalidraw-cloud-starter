# 002 Authorization

## Context
Direct model owner rules use Cognito identity claims, not the stable application user ID.

## Decision
Models use a backend-only `workspace-service` group rule; ordinary users are never assigned to it. Authenticated browser callers use custom operations; the operation validates its token and the handler resolves `IdentityLink` before every read or mutation.

## Reason
This prevents a browser-supplied `ownerUserId` from becoming an authorization decision.

## Consequences
The workspace handler is a security boundary and needs focused isolation tests.
