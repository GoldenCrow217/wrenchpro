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

## v1.0.36 - 2026-08-16

### Added

- Connected shop workflow board with customizable columns, drag-and-drop repair orders, promised times, priorities, and assignable bays or mobile service units.
- Custom inspection templates, per-corner brake/rotor/tire measurements, quick notes, photos, recommendations, deferred-service follow-up, and printable inspection reports.
- Service-line authorization history with typed signatures, technician task queues and labor-line time tracking, vehicle check-in/quality-control records, parts reservations, vendors, and purchase orders with receiving.
- Recurring appointments with resource conflict detection, expanded vehicle/customer service history, customer statements, and partial job-payment refunds.

### Changed

- Repair-order and estimate line items retain stable IDs so authorization, tasks, inventory reservations, and deferred work remain attached through edits and conversion.
- Mutation completion waits for local state application and distinguishes a confirmed save from a follow-up view-refresh failure.
- Local SQLite migrations add the new operational records without requiring a hosted service or external database.

### Fixed

- Inspection and estimate saves return canonical records with stable item IDs, allowing immediate authorization, editing, and reporting without a broad refresh.
- Workflow, purchasing, task, resource, authorization, and refund APIs validate linked records before changing local data.
- Focus refresh and renderer QA account for the connected operations data source without overlapping requests or stale-state replacement.

## v1.0.35 - 2026-08-14

### Added

- Focused finance-corrections QA covering operating revenue, late fees, repair-order ledger protection, weighted inventory cost, direct-job stock movement, estimate preservation, invoice balances, wage cost, and calendar-month schedules.
- Separate late-fee payment tracking with automatic migration and historical installment-payment backfill.

### Changed

- Dashboard and Profit and Loss now distinguish operating income from sales-tax liability, customer credits, canceled or voided receipts, and late fees.
- Expense restocks use weighted-average inventory cost, while inventory-linked repair-order creation, editing, and deletion adjust stock transactionally.
- Invoices show paid amounts, balance due, customer credit, payment history, and separate service/fee subtotals.
- Payment plans calculate remaining obligations without applying late-fee receipts against principal and schedule monthly payments by calendar month.
- Time Tracking estimates wage cost from employee hourly rates rather than customer billing rates.

### Fixed

- Installment-generated payments can no longer be edited independently from their installment state.
- Repair orders with payments or payment plans can no longer be deleted in ways that orphan or reclassify financial history.
- Editing an estimate preserves intentional zero-percent tax and inventory-item links.
- Direct repair orders now reject insufficient inventory without partial writes and restore reserved stock when an unpaid order is deleted.

## v1.0.34 - 2026-08-13

### Added

- Payment-ledger Delete actions with confirmation, duplicate-action protection, and focused state refreshes.

### Changed

- Deleting allocated or installment-linked payments now recalculates the associated installment and repair-order balance while preserving other recorded payments.
- Plan down payments remain protected until their payment plan is deleted, with clear guidance for the safe correction workflow.

### Fixed

- Payments for archived customers can be removed when correcting historical records.
- Payment deletion immediately refreshes Payments, Dashboard, Profit and Loss, customer history, repair-order status, and linked payment-plan state.

## v1.0.33 - 2026-08-13

### Added

- Atomic Quick Entry API workflow that creates or reuses the customer and vehicle, creates the repair order, and records an optional payment in one database transaction.
- Persisted repair-order discounts so approved estimate pricing, parts-only tax, invoices, balances, dashboards, reports, and automatic payments remain consistent after conversion.
- Optional request-scoped shop membership enforcement and a narrow saved shop-context header bridge while retaining local desktop mode by default.

### Changed

- Payment-plan paid totals now come from the payment ledger, including additional payments, instead of assuming a configured down payment was successfully recorded.
- Profit and Loss proportionally allocates repair-order discounts between labor and parts and calculates sales-tax liability from discounted parts.
- Customer and employee archive updates now keep active frontend lists consistent while preserving closed-job and payment history.

### Fixed

- Estimate partial updates preserve saved discount, tax, notes, approval, mileage, and expiration values instead of resetting omitted fields.
- Quick Entry validation can no longer leave the save action permanently locked, and a failed transaction no longer leaves partial customer or vehicle records.
- Focus-refresh QA supports the shop-context request headers and continues to verify state preservation without unhandled rejections.
- Local date arithmetic remains stable across daylight-saving boundaries, impossible local date-times are rejected, and interaction defaults use the local business date.
- Archived-customer payments and time history remain available in dashboard and reporting queries.
- SQLite WAL and SHM runtime files are excluded from source control.

## v1.0.32 - 2026-08-12

### Added

- Focused accounting and historical-integrity QA covering archived records, payment reconciliation, atomic plan down payments, authoritative line pricing, tax snapshots, employee history, and time validation.
- Shared local business-date, line-item normalization, and repair-order finance helpers.

### Changed

- Repair-order and estimate line amounts are calculated on the server from quantity and rate, and parts taxability is derived from the controlled item type.
- Customer and vehicle archival removes records from active selection lists while retaining repair orders, estimates, payments, plans, inspections, warranties, and revenue history.
- Employees are archived instead of hard-deleted; open jobs are unassigned while closed-job assignments and time history remain intact.
- Payment-plan creation records any down payment in the same database transaction, and fully paid plans no longer create zero-dollar installments.
- Profit and Loss caps invoice allocation at the invoice total and reports excess receipts as customer-credit liabilities rather than operating income or sales tax.

### Fixed

- Repair-order invoice status now reconciles with actual payments after payment creation, editing, deletion, installment payment, and repair-order total changes.
- Existing closed and paid repair orders receive a frozen tax-rate snapshot so later Settings changes do not rewrite historical totals.
- Automatic payment and overdue-plan dates use the desktop's local business date rather than UTC.
- Invalid or reversed time-log timestamps return clear validation errors instead of corrupting calculated hours.
- Malformed line-item payloads return HTTP 400 instead of an internal server error.
- Startup loading tolerates unavailable optional endpoints while preserving successfully loaded state, and desktop startup uses one IPv4-consistent, single-instance server lifecycle.
- Unexpected external-link protocols are blocked, numeric API inputs receive consistent validation, and referenced inventory deletion returns a clear conflict response.

## v1.0.31 - 2026-08-12

### Added

- Native Windows printing and direct PDF saving for invoices and estimates.
- Dashboard calculation QA covering revenue, profit, outstanding balances, overdue invoices, activity, and pipeline periods.
- Estimate and repair-order mileage tracking that advances vehicle mileage without allowing older documents to reduce it.
- Optional parts deposits, configurable payment grace periods and late fees, and expanded payment-plan details on invoices.
- Request-scoped shop validation for the desktop-to-hosted application bridge while preserving offline desktop behavior.

### Changed

- Jobs can be filtered as all, open, or closed repair orders and sorted in either direction by every data column.
- Job and estimate line editors separate labor hours from parts quantity and retain service-catalog hours and pricing.
- The repair-order catalog picker includes both service-catalog and inventory items.
- Trip fees use the configured default but remain optional per repair order.
- Dashboard KPIs use their stated periods and include parts-only tax, trip fees, attached payments, and current-month expenses.
- Vehicle entry places VIN first, and new repair orders and estimates prefill the selected vehicle's current mileage.

### Fixed

- Job rows update deterministically after line-item saves instead of waiting for an unrelated refresh.
- Estimate numbers are allocated sequentially and same-day estimates have stable newest-first ordering.
- Estimate mileage is retained when converting an approved estimate into a repair order.
- Invoice and estimate printing no longer depends on a browser popup workflow in the installed desktop application.

## v1.0.30 - 2026-08-10

### Added

- Parts and supplies expenses can create a new inventory item or restock an existing item in the same atomic save.
- Payments and payment plans reference their repair order and display the R/O number throughout Payments and plan details.
- Payment plans support exact custom payment amounts and due dates, additional payments, and printable plan details on the related invoice.

### Changed

- Marking a job Paid records its remaining balance as a payment so Payments and Profit & Loss stay synchronized.
- Down payments, installment payments, and additional plan payments retain the linked repair order without double-counting the plan balance.

### Fixed

- Expense inventory updates and paid-job payment creation roll back together when either side of the operation fails.
- Repeated Paid saves do not create duplicate payments, and invalid custom plan totals are rejected without partial writes.

## v1.0.29 - 2026-08-09

### Added

- New repair orders automatically receive the next editable `RO-####` number.
- Existing customers can add a vehicle later directly from the customer editor.
- Approved estimates automatically convert to an idempotent, numbered repair order.
- Repair-order catalog selection now uses an in-app picker that works in Electron.

### Changed

- Parts & Inventory shows separate total-cost and total-retail KPIs.
- New repair-order labor lines use the standard labor rate configured in Settings.
- Travel and trip fee spinner controls change the amount in $10 increments.

### Fixed

- Failed estimate conversion leaves the estimate retryable as Draft without creating a duplicate estimate or repair order.
- Customer creation clearly supports saving without vehicle information.

## v1.0.28 - 2026-08-09

### Added

- Jobs can store, search, display, edit, and print an external repair-order number.
- Parts markup settings can add and remove price tiers while preserving the required Above fallback.

### Fixed

- Clicking outside an open data-entry modal no longer closes it and discards in-progress input.
- Saving a database-loaded job line without an inventory link no longer incorrectly reports "Inventory item not found."

## v1.0.27 - 2026-08-09

### Added

- Editable O'Reilly-style parts markup tiers with automatically calculated gross margin.
- Server-side pricing helpers and focused QA for tier selection, cent rounding, settings persistence, and parts-only sales tax.

### Changed

- Part cost changes now select the configured markup tier and calculate retail price to the nearest cent.
- Payment method and invoice terms settings accept custom values while retaining common suggestions.
- Estimate totals are recalculated on the server, and discounts are allocated proportionally before calculating tax.

### Fixed

- Settings cards now use the existing card padding so headings and fields are no longer clipped by rounded borders.
- Sales tax is applied to parts and shop-supply lines, not labor, diagnostic, fee, or sublet lines.

## v1.0.26 - 2026-08-09

### Fixed

- Dashboard and sidebar identity rendering no longer fails when resolving the configured owner or business-name fallback.

### Changed

- Rendering QA now executes configured-owner and business-name fallback behavior and guards against restoring the hardcoded sample greeting.

## v1.0.25 - 2026-08-09

### Changed

- The Dashboard now keeps its local New Job action and hides the duplicate contextual topbar action.
- The sidebar identity and Dashboard greeting now use the configured owner name instead of hardcoded sample data, with business-name and neutral fallbacks when no owner is configured.
- The sidebar Quick Entry shortcut now uses a recognizable lightning icon with an explicit accessible label.

## v1.0.24 - 2026-08-09

### Added

- A native Electron application menu for customer, job, appointment, navigation, quick-entry, payment, settings, update, and application actions.
- An allowlisted preload IPC bridge and renderer command dispatcher that reuse existing application workflows without exposing Node integration.

### Changed

- Standard edit, reload, zoom, full-screen, developer-tool, and exit actions now use Electron menu roles.

### Known limitations

- Backup Database, Export Data, Run Data Integrity Check, and Open Logs remain disabled until safe application-level implementations exist.
- Toggle Developer Tools is available only in development builds.

## v1.0.23 - 2026-08-03

### Added

- Focused QA coverage for rendering security, IPv4 port selection, installment payments, mutation reliability, API validation, inventory values, and focus refreshes.

### Changed

- Successful create, edit, delete, status, and conversion workflows now update only directly affected frontend state instead of depending on the global `loadAll()` refresh.
- API mutation routes consistently validate required text, finite numbers, dates, times, stable IDs, and related records before database execution.
- Inventory cost, retail price, quantity, and reorder quantity now reject negative or malformed values at the API boundary while retaining fractional quantities.

### Fixed

- Stored customer and application text is escaped before HTML rendering to prevent persisted script injection.
- Electron free-port probing now uses the same IPv4 loopback address as the Express server.
- Installment payment creation and paid-state updates are transactional, linked, and idempotent.
- Window-focus refresh failures retain existing state, avoid unhandled promise rejections, and show one consolidated warning.

### Known limitations

- Quick Entry is not fully transactional.
- Payment-plan creation and optional down-payment recording remain separate operations.
- Appointments do not yet support duration, status, or assigned employee fields.
- Markup percentage is derived from rounded cost and retail values rather than stored.
- Full CSP hardening and removal of `unsafe-inline` remain future work.
- Some destructive actions still lack confirmation.
- Modal Escape-key support and broader accessibility improvements remain future work.

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
