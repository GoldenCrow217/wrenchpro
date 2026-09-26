# WrenchPro Dependency Upgrade Assessment

Date: 2026-04-29  
Scope: Assessment only; no dependency upgrades performed.

## Why This Exists

Full `npm audit` reports dev/build dependency vulnerabilities. Production dependency audit currently reports 0 vulnerabilities:

```bash
npm audit --omit=dev
```

Result:

```text
found 0 vulnerabilities
```

The remaining vulnerabilities are in development/build tooling, primarily Electron/electron-builder dependency chains. Fixing them requires major/breaking upgrades, so they should not be applied casually during stabilization.

## Current Outdated Packages

Observed from `npm outdated --json`:

| Package | Current | Wanted | Latest | Notes |
|---|---:|---:|---:|---|
| `better-sqlite3` | 12.8.0 | 12.9.0 | 12.9.0 | Small patch/minor candidate; native dependency, must test Node + Electron build. |
| `dotenv` | 16.6.1 | 16.6.1 | 17.4.2 | Major upgrade candidate; low urgency. |
| `electron` | 29.4.6 | 29.4.6 | 41.3.0 | Major upgrade; likely breaking/security-relevant. |
| `electron-builder` | 24.13.3 | 24.13.3 | 26.8.1 | Major upgrade; likely affects packaging/release workflow. |
| `express` | 4.22.1 | 4.22.1 | 5.2.1 | Major upgrade; defer unless needed. |

## Audit Risk Summary

### Production Runtime

- `npm audit --omit=dev`: 0 vulnerabilities.
- Immediate customer/runtime risk appears low based on current audit output.

### Development / Build Tooling

- Full `npm audit`: 11 vulnerabilities, including Electron and `tar`/build-chain advisories.
- `npm audit fix --force` would install newer major versions, including Electron 41.x and electron-builder 26.x.
- This is a separate compatibility workstream, not a quick fix.

## Recommended Upgrade Strategy

### Phase 1 — Stabilize First

Do not upgrade Electron/electron-builder before manual QA and install/update testing of current v1.0.8 stabilization work.

Reason: major upgrades could introduce unrelated packaging/runtime issues and muddy QA results.

### Phase 2 — Low-Risk Native Patch Trial

Test `better-sqlite3` 12.9.0 in a branch/worktree later.

Validation required:

```bash
npm install better-sqlite3@12.9.0
npm run rebuild-node
npm test
npm run qa:api
npm run electron:build
npm run rebuild-node
npm test
npm run qa:api
```

### Phase 3 — Electron Upgrade Workstream

Create a dedicated branch for Electron/electron-builder upgrades.

Recommended branch name:

```text
chore/electron-upgrade-assessment
```

Candidate upgrades:

```bash
npm install --save-dev electron@41.3.0 electron-builder@26.8.1
```

Expected risks:

- Electron API behavior changes.
- Packaging config changes.
- Native module rebuild changes.
- Auto-update behavior changes.
- Windows installer behavior changes.
- Possible UI/runtime issues in the Electron shell.

Validation required:

```bash
npm install
npm run rebuild-node
npm test
npm run qa:api
npm run electron:build
npm run rebuild-node
npm test
npm run qa:api
```

Manual checks required:

- Electron app launches.
- Window opens to WrenchPro UI.
- Local API connects.
- Installer builds.
- Installed app launches.
- Data persists after install/update.

### Phase 4 — Express 5 Later

Defer Express 5. Express 4 is stable and currently not reported as production vulnerable by `npm audit --omit=dev`.

Express 5 could change routing/middleware behavior and should not be mixed with Electron upgrades.

## Recommendation

Do **not** run `npm audit fix --force` on main.

Next best action:

1. Complete manual UI/install QA on current stabilization work.
2. Push current stabilization only after Brandon approval.
3. Open a separate local branch/workstream for Electron/electron-builder upgrade testing.
4. Only merge upgrade work after smoke/API/build/manual checks pass.
