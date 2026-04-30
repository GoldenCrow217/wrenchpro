# WrenchPro Release Checklist

Use this before creating or publishing a release.

## Pre-Release

- [ ] Confirm release goal.
- [ ] Confirm all release blockers are fixed.
- [ ] Confirm `KNOWN_ISSUES.md` is updated.
- [ ] Confirm `ROADMAP.md` reflects what is shipping.
- [ ] Confirm Git working tree is understood.
- [ ] Confirm Brandon approves release.

## Versioning

- [ ] Update `package.json` version if needed.
- [ ] Confirm installer version matches app version.
- [ ] Prepare release notes.

## Data Safety

- [ ] Identify database location.
- [ ] Back up database before install/update testing.
- [ ] Confirm uninstall does not delete app data unless explicitly intended.
- [ ] Confirm update preserves data.

## Build

- [ ] Run install/dependency check if needed.
- [ ] Run app smoke test.
- [ ] Run build command.
- [ ] Confirm installer exists in `dist`.
- [ ] Confirm installer size looks reasonable.

## Install / Update Test

- [ ] Install build locally.
- [ ] Launch from Desktop shortcut.
- [ ] Confirm version.
- [ ] Confirm dashboard loads.
- [ ] Confirm core create/edit workflows.
- [ ] Confirm data persistence.

## GitHub Release

Do not publish without Brandon approval.

- [ ] Commit final changes.
- [ ] Tag version if appropriate.
- [ ] Create release notes.
- [ ] Upload installer if using GitHub releases.
- [ ] Confirm release assets are correct.

## Post-Release

- [ ] Record release notes.
- [ ] Record known issues/deferred work.
- [ ] Add next priorities to roadmap.
