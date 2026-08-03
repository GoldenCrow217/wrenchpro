# Changelog

All notable WrenchPro changes should be documented here before release.

## Unreleased

### Added

- Project/company operating docs for the AI-assisted WrenchPro software company workflow.
- Initial internal strategy, business workflow assumptions, QA checklist, release checklist, support/docs plan, and Telegram bot plan.
- Basic smoke test script: `npm run smoke` / `npm test`.
- Initial README, security policy, license notice, and GitHub issue templates.

### Changed

- `electron:dev` script updated to a Windows-friendly `electron .` command.
- `package-lock.json` metadata synced with `package.json` version.

### Fixed

- Local `better-sqlite3` native dependency rebuilt for the active local Node runtime.
- Removed accidental `%TEMP%runs.json` generated file from repo root.

## v1.0.22 - 2026-08-03

### Added

- Parts and Inventory now includes a derived Markup % input with two-way cost/markup/retail calculations, cent rounding, and nonnegative price validation.
- Saved appointments can be selected by stable ID from the Schedule calendar and edited through the existing appointment modal and API.

### Fixed

- Customer saves no longer depend on unrelated data refreshes, reject duplicate clicks, clearly report failures, and retain the saved customer when optional vehicle creation needs to be retried.
- Lead conversion remains transactional and idempotent while updating only the affected lead and customer state in the frontend.
- New Job and Add Vehicle actions open their modals before optional initialization and provide guidance when related state is unavailable.
- Appointment clicks no longer bubble into the calendar day action; multiple appointments on the same date remain independently selectable.
- Profit and Loss report content uses the shared padded-card layout so the Income heading is no longer clipped.

## v1.0.20 - 2026-07-29

### Fixed

- Release workflow now runs `electron:publish` (`--publish always`) instead of a plain build, so `latest.yml` and the installer blockmap are actually uploaded to the GitHub release. Previously published installers (including v1.0.19) had no update manifest, so **Help > Check for Updates** failed with a 404 on `latest.yml`.
- CI now verifies `dist/latest.yml`, the installer it references, and the matching `.blockmap` all exist before the release step is considered done.
- Auto-updater shows a clearer message when update metadata is missing instead of a raw HTTP error.
- CI now pre-creates the GitHub release before running electron-builder, avoiding a race where concurrent asset uploads (installer + blockmap) both tried to create the release and one failed with `422 already_exists`, leaving the release incomplete.

## v1.0.13 - 2026-05-03

### Fixed

- `POST /api/vehicles` now validates `customer_id` exists and is not soft-deleted before insert — returns `400 { "error": "Customer not found" }` instead of a raw FK constraint error
- Soft-deleting a customer now cascades to their vehicles — vehicles whose customer is deleted no longer appear in `GET /api/vehicles` or any joined views

## v1.0.12 - 2026-05-03

### Fixed

- Migration ordering bug: `closed_at` backfill ran before the `ALTER TABLE` that adds the column, crashing fresh database startup with `SqliteError: no such column: closed_at`. Data backfills are now ordered after all schema migrations.
- `npm test` and `npm run qa:api` now pass on fresh databases.

## v1.0.11 - 2026-05-03

### Fixed

- `POST /api/jobs` now validates that `customer_id` and `vehicle_id` exist in the database (and are not soft-deleted, and vehicle belongs to the customer) before inserting — returns `400 { "error": "Customer not found" }` or `"Vehicle not found"` instead of leaking raw SQLite foreign key wording
- `POST /api/jobs` now stamps `closed_at` when creating a job with `Complete` or `Canceled` status (previously only the PUT path stamped it)
- Backfill migration: existing `Complete`/`Canceled` jobs with null `closed_at` are stamped on startup
- Dashboard recent jobs widget now only shows active statuses (excludes `Complete`, `Canceled`, and deleted rows)

## v1.0.10 - 2026-05-03

### Fixed

- API validation: `POST /customers` requires first/last name; `POST /jobs` requires customer, vehicle, and date — all return `400 JSON` instead of SQLite stack traces
- Global JSON error handler: unhandled server errors now always return `{ "error": "..." }` instead of HTML
- Frontend `api()` helper: checks `response.ok`, toasts the server error message, and halts the save flow without closing the modal
- Estimate convert: returns `400` with a clear message when no vehicle is set on the estimate
- Job status standardized: `Done` renamed to `Complete` throughout UI, status filter, calendar, quick entry, and badge map; existing `Done` rows backfilled automatically on startup
- `Canceled` jobs now receive `closed_at` timestamp (same as `Complete`)
- Dashboard no longer counts soft-deleted customers, vehicles, or jobs; active job count excludes `Complete` and `Canceled`
- Recent jobs panel on dashboard filters soft-deleted records

### Added

- Service address and travel/trip fee fields on job create/edit modal; service address auto-fills from customer address on new jobs
- Travel fee appears as a line item on invoices and is included in the tax base and total
- Service address shown in the Bill To section of invoices
- Window focus refresh: app reloads data automatically when the window regains focus (covers import/API changes without restart)
- `Canceled` status badge now renders as gray; `Partial` payment badge renders as amber

## v1.0.9 - 2026-05-03

### Added

- Appointments now link to customers, vehicles, and estimates via foreign keys; GET returns joined customer/vehicle names; missing PUT endpoint added.
- Estimate approval metadata: `approved_at` timestamp, `approved_by`, and `approval_notes` fields; auto-stamped when status changes to Approved.
- Estimate line items now support an `inventory_id` FK to parts inventory; converting an estimate to a job automatically deducts stock quantities.
- Jobs: `service_address` and `travel_fee` fields for mobile-mechanic location tracking.
- Jobs: `closed_at` timestamp auto-stamped when status changes to Complete.
- New `GET /api/jobs/:id/balance` endpoint returning `{ total, paid, balance }` for real-time invoice balance.
- Soft delete (`deleted_at`) on customers, vehicles, jobs, and estimates — all list and detail endpoints filter deleted records; no business data is permanently destroyed on delete.

## v1.0.8 - 2026-04-29

### Added

- Estimates / quotes with line-item builder, discount, tax, PDF print, and convert-to-job.
- Vehicle inspections checklist.
- Parts and inventory tracking with low-stock alerts.
- Service catalog with default pricing.
- Warranty tracking per job.
- Lead pipeline with convert-to-customer workflow.
- Time tracking with clock in/out and job timers.

### Enhanced

- Job fields: complaint, diagnosis, invoice status, and work order statuses.
- Customer fields: type, preferred contact, and billing address.
- Vehicle fields: fuel type, transmission, and engine.
- Settings: labor rates, warranty terms, estimate terms, and business hours.

## v1.0.7

- Version bump and release preparation.

## v1.0.6

- Fixed navigation button onclick leak.
- Added dashboard quick-add buttons.

## v1.0.5

- Added CRM features: interactions, follow-ups, service reminders, customer status, and tags.

## v1.0.0 - v1.0.4

- Initial WrenchPro releases and early feature expansion.
