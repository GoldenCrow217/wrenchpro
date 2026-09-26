# WrenchPro GitHub / Repo Audit

- Audit date: 2026-04-29
- Repo: `C:\Users\imajo\wrenchpro`
- Remote checked: `https://github.com/GoldenCrow217/wrenchpro`
- Scope: local git/repo hygiene, package/build risks, GitHub Actions/release signals, repo documentation gaps, likely GitHub issues.

## Executive Summary

The public GitHub release pipeline is basically working: the `Build & Release` workflow syntax is valid enough to run, and GitHub shows a successful `v1.0.8` release run with installer, blockmap, and `latest.yml` assets uploaded.

Main risks found:

1. Local `npm start` currently fails because the installed `better-sqlite3` native module was built for a different Node ABI than the active Node runtime.
2. The repository has many useful project docs untracked locally, so they are not yet protected by git or visible on GitHub.
3. A suspicious generated file named `%TEMP%runs.json` is untracked in the repo root and should not be committed unless intentionally created.
4. Local `dist/` artifacts are stale at v1.0.7 while GitHub release v1.0.8 exists; this can confuse manual release verification.
5. `package-lock.json` root package metadata still says `1.0.1` while `package.json` says `1.0.8`.
6. The repo has no tracked README, license, changelog, security policy, issue templates, or contributor docs.
7. There are no automated tests or CI checks beyond tag-triggered release building.

## Evidence / Checks Run

### Local git state

`git status --short --branch`:

```text
## main...origin/main
?? %TEMP%runs.json
?? AGENT_WORKFLOW.md
?? AUTONOMOUS_OPERATING_RULES.md
?? BUSINESS_WORKFLOW.md
?? COMPANY_OPERATING_MODEL.md
?? FEEDBACK_INBOX.md
?? KNOWN_ISSUES.md
?? PROJECT_COMMAND_CENTER.md
?? RELEASE_CHECKLIST.md
?? ROADMAP.md
?? STRATEGY_DRAFT.md
?? SUPPORT_AND_DOCS_PLAN.md
?? TECHNICAL_NOTES.md
?? TELEGRAM_BOT_PLAN.md
?? TESTING_CHECKLIST.md
```

Recent commits:

```text
79f2496 Add GitHub Actions release workflow
e7f3024 Bump version to 1.0.8 — major feature expansion
1eb6c0c Bump version to 1.0.7
7216859 Fix nav button onclick leak, add dashboard quick-add buttons
2daf81b Bump version to 1.0.6
b0a9e5c Add CRM feature — interactions, follow-ups, service reminders, and customer status/tags
30ef9a9 Bump version to 1.0.5
a9e5a50 Add employees, flat-rate billing, invoice customization, Quick Entry, and appointments
75fc25b Initial commit — WrenchPro v1.0.0
```

### GitHub public signals

GitHub API access worked.

- Public repo exists: `GoldenCrow217/wrenchpro`.
- Open GitHub issues: none returned by API.
- Latest release: `v1.0.8`, published 2026-04-29T23:20:13Z.
- `v1.0.8` assets present:
  - `WrenchPro-Setup-1.0.8.exe`
  - `WrenchPro-Setup-1.0.8.exe.blockmap`
  - `latest.yml`
- Recent Actions: 3 workflow runs total; latest `Build & Release` run for `v1.0.8` completed successfully.

### Package / syntax checks

- `npm ci --dry-run`: passed.
- `npm audit --omit=dev --json`: 0 known production vulnerabilities.
- `node --check` on server/electron JS files: passed.
- Package version mismatch found:

```text
package.json version: 1.0.8
package-lock.json root version: 1.0.1
package-lock.json packages[""] version: 1.0.1
```

### Local smoke check

Command attempted with temp data dir:

```powershell
$env:PORT='3310'; $env:WRENCHPRO_DATA=(Join-Path (Get-Location) 'qa-temp-data\repo-audit-smoke'); node server/index.js
```

Result: failed before startup due native module ABI mismatch:

```text
Error: The module '\\?\C:\Users\imajo\wrenchpro\node_modules\better-sqlite3\build\Release\better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 121. This version of Node.js requires
NODE_MODULE_VERSION 137.
```

## Findings

### High Severity

#### 1. Local dev server currently cannot start under active Node runtime

`node server/index.js` fails because `better-sqlite3` is compiled for Node ABI 121 while active Node v24.14.1 requires ABI 137.

Impact:

- `npm start` and API smoke testing fail locally until native deps are rebuilt or the expected Node version is used.
- Future agents may misdiagnose app bugs when the real issue is native dependency/runtime mismatch.

Recommended fix:

- Decide the supported local Node version and add it to `.nvmrc`/`.node-version` and README.
- Rebuild local native deps for that runtime when testing with plain Node: `npm rebuild better-sqlite3` or reinstall dependencies.
- Keep Electron native rebuild (`npm run rebuild-native`) for packaged builds.

### Medium Severity

#### 2. Important project docs are untracked

All command-center/business/QA/docs are untracked, including this audit file after creation. Until committed, GitHub and future clones will not have the operating model, release checklist, roadmap, install guides, or issue tracker. Final verification also showed additional untracked docs from parallel work: `BUSINESS_WORKFLOW_ASSUMPTIONS.md`, `COMPANY_AGENT_ORG.md`, `INSTALL_AND_BACKUP_GUIDE.md`, `PRIVATE_BETA_FEEDBACK_GUIDE.md`, and `QUICK_START.md`.

Recommended fix:

- Review the untracked docs.
- Commit the docs that should be part of the repo.
- Do not commit `%TEMP%runs.json` unless it is intentionally useful.

#### 3. Suspicious generated `%TEMP%runs.json` in repo root

A root file named `%TEMP%runs.json` is untracked and looks like accidental generated/debug output.

Recommended fix:

- Inspect it before deletion.
- If accidental, remove or move it out of repo and add an ignore pattern if the generator may recreate it.

#### 4. Local `dist/` is stale relative to GitHub release

Local ignored `dist/` contains installers through v1.0.7, while GitHub has v1.0.8 assets. This is not a source-control bug because `dist/` is ignored, but it is a release-verification risk.

Recommended fix:

- Treat GitHub Actions artifacts/releases as release source of truth.
- Optionally clean or annotate local `dist/` before manual verification to avoid installing the wrong version.

#### 5. `package-lock.json` version metadata is stale

`package.json` is `1.0.8`, but `package-lock.json` root metadata is `1.0.1`.

Impact:

- Confusing release provenance.
- Package consumers/tools may show stale project version metadata even though dependency integrity is otherwise valid.

Recommended fix:

- Run `npm install --package-lock-only` after version bumps, then commit the lockfile metadata update.

#### 6. No automated test/quality gate before release

The tag-triggered release workflow builds and publishes, but it does not run tests, lint, smoke checks, or API checks. There is also no `test` script in `package.json`.

Recommended fix:

- Add at least a smoke-check script that starts the server with temp data and hits `/api/dashboard`.
- Add this check before `electron:build` in GitHub Actions.
- Later add route/API tests and frontend workflow tests.

### Low / Documentation / Repo Hygiene

#### 7. Missing public repo docs

No tracked README/license/changelog/security/contributing docs were found.

Recommended minimum before wider distribution:

- `README.md` with install/update/data-location/support basics.
- `CHANGELOG.md` or release-notes discipline.
- `LICENSE` or private/proprietary notice.
- `SECURITY.md` for vulnerability reporting, even if private support-only.
- `.github/ISSUE_TEMPLATE/` for bug reports and feature requests.

#### 8. Public GitHub repo has no open issues

GitHub API returned `[]` for open issues. Local `KNOWN_ISSUES.md` is the only issue tracker right now.

Recommended fix:

- Keep using `KNOWN_ISSUES.md` during early private stabilization.
- When ready, mirror selected public-safe bugs into GitHub Issues.

#### 9. `electron:dev` script is Unix-style and likely fails in Windows PowerShell

`electron:dev` uses `env -u ELECTRON_RUN_AS_NODE electron .`, which is Unix syntax. This repo is being worked on in Windows.

Recommended fix:

- Replace with a cross-platform helper (e.g. small Node script) or add Windows-specific docs/script.

## GitHub Actions Review

Current workflow:

```yaml
name: Build & Release
on:
  push:
    tags:
      - 'v*'
```

Assessment:

- Syntax is working in GitHub; latest run succeeded.
- Uses `windows-latest`, Node 20, `npm ci`, native rebuild, and `npm run electron:build`.
- `GH_TOKEN: ${{ secrets.GH_TOKEN }}` apparently worked for the latest run, implying the secret exists or electron-builder also had sufficient token context. Still, this is brittle compared to `GH_TOKEN: ${{ github.token }}` plus explicit `permissions: contents: write`.
- Uploads `dist/` only on failure, not on success. Since electron-builder publishes release assets on success, this is acceptable but leaves no separate Actions artifact for normal builds.

Recommended workflow hardening:

```yaml
permissions:
  contents: write
```

Then either:

```yaml
env:
  GH_TOKEN: ${{ github.token }}
```

or keep the secret but document it in release setup notes.

## Suggested Next Actions

1. Fix local dev startup by aligning/rebuilding `better-sqlite3` for the active Node runtime or standardizing Node version.
2. Commit the project documentation files that should be durable, including any newly generated docs from parallel agents.
3. Remove/ignore `%TEMP%runs.json` after inspection.
4. Update `package-lock.json` metadata to 1.0.8.
5. Add a minimal smoke test script and run it before releases.
6. Add README/license/security/changelog/issue templates before wider public use.
