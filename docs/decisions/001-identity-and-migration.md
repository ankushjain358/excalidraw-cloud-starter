# 001 Identity and migration

## Context
The Cognito subject can change during a user-pool migration and email can change.

## Decision
`User.id` is a generated UUID. `IdentityLink` maps an issuer and Cognito subject to that UUID. A trusted authenticated backend operation resolves the link and provisions the first link/User; clients never send an owner ID.

## Reason
Folders, metadata, and object keys survive a Cognito migration.

## Consequences
An operator verifies account recovery using an out-of-band process, disables the old link, and creates a new issuer/subject link to the existing User UUID. Email is then refreshed as profile data. Do not infer links from email alone.
