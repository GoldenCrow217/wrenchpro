# WrenchPro Known Issues

Use this as the shared bug/issue tracker.

## Issue Format

```md
## ISSUE-000: Short title

- Status: Open / In Progress / Fixed / Verified / Deferred
- Severity: Critical / High / Medium / Low
- Area: Customers / Jobs / Vehicles / Estimates / Build / etc.
- Found by:
- Found date:
- App version/commit:

### Problem

What happened?

### Steps to Reproduce

1.
2.
3.

### Expected

What should happen?

### Actual

What actually happened?

### Notes / Evidence

Screenshots, logs, files, or observations.
```

---

## Open Issues

## ISSUE-002: Project docs and issue tracker are untracked locally

- Status: Open
- Severity: Medium
- Area: Repo Hygiene / Documentation
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- App version/commit: v1.0.8 / `79f2496`

### Problem

Important internal docs are present locally but not tracked by git yet.

### Expected

Project operating docs that should persist across clones/sessions are tracked or intentionally ignored.

### Actual

Docs are untracked and could be lost or omitted from GitHub until committed.

### Notes / Evidence

Run `git status --short` to review untracked docs.

## ISSUE-007: Full npm audit reports dev/build dependency vulnerabilities

- Status: Open
- Severity: Medium
- Area: Dependencies / Build Tooling
- Found by: Stabilization Pass
- Found date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Problem

`npm audit --omit=dev` reports 0 production vulnerabilities, but full `npm audit` reports 11 vulnerabilities in dev/build dependency chains, primarily Electron and `tar` via build tooling.

### Steps to Reproduce

1. Run `npm audit`.

### Expected

No known vulnerabilities, or documented accepted risk.

### Actual

`npm audit` reports 11 vulnerabilities: 4 low and 7 high. Suggested fixes require breaking upgrades to newer Electron/electron-builder versions.

### Notes / Evidence

Do not run `npm audit fix --force` casually. Treat Electron/electron-builder upgrades as a separate upgrade/testing workstream.

## ISSUE-008: App uses default Electron icon

- Status: Open
- Severity: Low
- Area: Branding / Installer
- Found by: Stabilization Pass
- Found date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Problem

Local `electron:build` succeeded but reported that the default Electron icon is used because no application icon is configured.

### Expected

WrenchPro should eventually have a branded app/installer icon.

### Actual

Default Electron icon is used.

---

## Fixed / Verified Issues

## ISSUE-001: Local dev server fails because better-sqlite3 native module ABI does not match active Node

- Status: Verified
- Severity: High
- Area: Build / Local Dev / Database
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Rebuilt `better-sqlite3` for the active local Node runtime.

### Verification

`npm test` passed. The smoke test started the server with temporary data and checked `/api/dashboard` successfully.

## ISSUE-003: Suspicious generated `%TEMP%runs.json` file exists in repo root

- Status: Verified
- Severity: Medium
- Area: Repo Hygiene
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Inspected and removed `%TEMP%runs.json`; added ignore entry to reduce accidental re-add risk.

### Verification

`git status --short` no longer shows `%TEMP%runs.json`.

## ISSUE-004: package-lock root version is stale compared with package.json

- Status: Verified
- Severity: Medium
- Area: Release / Package Metadata
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Ran `npm install --package-lock-only`.

### Verification

`package.json`, `package-lock.json`, and `package-lock.json` root package metadata all report version `1.0.8`.

## ISSUE-005: No automated test or smoke gate before tag-triggered release

- Status: Fixed
- Severity: Medium
- Area: CI / Release
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Added `scripts/smoke.js`, `npm run smoke`, `npm test`, and inserted `npm test` into the GitHub Actions release workflow before Electron packaging.

### Verification

Local `npm test` passed. Workflow change is not verified in GitHub until pushed and run.

## ISSUE-006: Windows repo uses Unix-style `electron:dev` script

- Status: Fixed
- Severity: Low
- Area: Developer Experience / Windows
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Changed `electron:dev` to `electron .`, which is Windows-friendly.
