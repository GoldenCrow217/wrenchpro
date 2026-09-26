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

## ISSUE-009: Electron 39 is out of support

- Status: Open
- Severity: High
- Area: Dependencies / Security / Desktop Shell
- Found by: Maintenance pass
- Found date: 2026-09-26
- App version/commit: v1.1.0

### Problem

WrenchPro ships Electron 39 (39.8.10). Electron supports only the three newest major versions (42, 43, and 44 as of 2026-09-26). The last 39.x release was 39.8.10 on 2026-05-05, so the bundled Chromium has received no security fixes since then.

### Expected

WrenchPro ships a supported Electron major version.

### Actual

Electron 39, about five months without security updates.

### Notes / Evidence

- Exposure is limited: the window only loads WrenchPro's own pages from `127.0.0.1`, runs sandboxed with context isolation, blocks off-origin navigation, and opens external links in the system browser.
- Upgrading also clears ISSUE-007 (`extract-zip` via Electron's installer).
- Treat it as its own workstream: upgrade `electron` (and `electron-builder` if needed), rebuild `better-sqlite3` for the new ABI, run `npm run test:all` including the Electron renderer and print-preload QA, build the installer, and check auto-update from the previous release on a real install.
- Check with `npm view electron dist-tags` and the Electron release schedule.

## ISSUE-007: Dev-only dependency advisory in Electron's installer (`extract-zip`)

- Status: Open (accepted risk until ISSUE-009)
- Severity: Low
- Area: Dependencies / Build Tooling
- Found by: Stabilization Pass
- Found date: 2026-04-29
- Updated: 2026-09-26
- App version/commit: v1.1.0

### Problem

`npm audit` reports 2 high-severity advisories for `extract-zip` <=2.0.1 (symlink path traversal), pulled in by `electron@39`.

### Actual

- **Production dependencies: 0 vulnerabilities** after the 2026-09-26 maintenance pass (`qs` 6.15.3 → 6.16.0 via Express, `js-yaml` 4.3.1 → 4.3.2 via electron-updater, using non-breaking `npm audit fix`).
- `extract-zip` runs only on developer machines, when `npm install` unpacks the Electron binary downloaded from Electron's official release server. It is not part of the installed app.

### Notes / Evidence

The only fix is a major Electron upgrade, tracked as ISSUE-009. Do not run `npm audit fix --force` casually.

---

## Fixed / Verified Issues

## ISSUE-002: Project docs and issue tracker are untracked locally

- Status: Verified
- Fixed date: 2026-09-26
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

### Fix

All internal docs are tracked in git under `docs/` (moved there in PR #19 with an index at `docs/README.md`).

### Verification

`git status --short` is clean and `git ls-files docs` lists all 29 docs plus the `README.md` index.

## ISSUE-008: App uses default Electron icon

- Status: Verified
- Fixed date: 2026-09-26
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

### Fix

Added a WrenchPro app icon generated from the Claude Design brand mark (`electron/assets/icon.svg` → `icon.ico`/`icon.png`, `npm run build:icons`) and set it in the electron-builder config and main window (v1.1.0).

### Verification

The icon extracted from the built `WrenchPro.exe` shows the WrenchPro mark, and `npm run qa:package` asserts the icon is packaged.

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

- Status: Verified
- Severity: Medium
- Area: CI / Release
- Found by: GitHub / Repo Issue Auditor
- Found date: 2026-04-29
- Fixed date: 2026-04-29
- App version/commit: v1.0.8 / local stabilization pass

### Fix

Added `scripts/smoke.js`, `npm run smoke`, `npm test`, and inserted `npm test` into the GitHub Actions release workflow before Electron packaging.

### Verification

Local `npm test` passed. Superseded on 2026-09-26: the release workflow now gates on `npm run test:all` (all QA scripts), and a separate QA workflow runs it on every pull request and push to `main`. Verified on GitHub by the v1.1.0 release run.

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
