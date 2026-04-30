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
