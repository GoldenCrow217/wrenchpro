# ADR-0003: Monorepo in this repository with npm workspaces

- Status: Accepted (2026-09-26)

## Context

The web app, mobile app, API, and desktop app must share types, validation, and business logic, and contract tests must run the legacy and new API side by side.

## Decision

Convert this repository to **npm workspaces**: `apps/desktop` (current Electron + Express + public), `apps/api`, `apps/web`, `apps/mobile`, and `packages/*`. Add Turborepo only if build times require it.

Moving the current code into `apps/desktop` is a separate, behaviour-neutral PR, verified by the full QA suite and an installer build.

## Consequences

One place for shared code and CI. The release workflow and electron-builder paths change once, in that relocation PR.
