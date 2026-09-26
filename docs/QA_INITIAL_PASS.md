# WrenchPro Initial QA Pass

Date: 2026-04-29  
Scope: Automated local smoke/API checks, not full manual UI QA.

## Summary

Initial automated QA now covers:

- server startup with temporary data
- `/api/dashboard` smoke check
- lead creation
- lead conversion to customer/vehicle
- customer list verification
- vehicle list verification
- estimate creation with line items
- estimate conversion to job
- job update
- dashboard verification after workflow changes

## Commands Run

```bash
npm test
npm run qa:api
```

## Results

### Smoke Test

Result: Passed.

The smoke test starts the server with a temporary data directory and verifies `/api/dashboard` returns expected fields.

### API Workflow QA

Result: Passed after rebuilding local native dependency for active Node runtime.

Last successful run produced:

```text
API QA passed
```

Workflow covered:

1. Create lead.
2. Convert lead to customer.
3. Confirm customer exists.
4. Confirm converted vehicle exists.
5. Create estimate with labor and parts line items.
6. Convert estimate to job.
7. Confirm job exists.
8. Update job to Done/Paid.
9. Confirm dashboard returns expected aggregate fields.

## Finding: Native Dependency ABI Toggle

After `npm run electron:build`, local Node-based checks can fail because Electron packaging rebuilds `better-sqlite3` for Electron's runtime ABI. Plain Node checks need it rebuilt for the active Node runtime.

Mitigation added:

```bash
npm run rebuild-node
```

Recommended local sequence after building:

```bash
npm run rebuild-node
npm test
npm run qa:api
```

## Not Covered Yet

- Manual UI click-through.
- Installed app launch from Desktop shortcut.
- Install/update persistence test.
- Backup/restore workflow.
- PDF/print output validation.
- Full CRUD for every route.
- Payment, warranty, inventory, time, inspection, settings, reports deep QA.

## Recommendation

Next QA workstream should be manual UI QA against the installed app or Electron dev app, using `TESTING_CHECKLIST.md`.
