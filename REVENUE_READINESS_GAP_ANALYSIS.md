# WrenchPro Revenue Readiness Gap Analysis

Date: 2026-04-29  
Owner: Revenue Readiness Agent  
Scope: Minimum product changes and checks required before asking anyone to pay or private-beta test. No code changes were made.

## Evidence Reviewed

- `TESTING_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- `QA_INITIAL_PASS.md`
- `BUSINESS_WORKFLOW_ASSUMPTIONS.md`
- `RELEASE_CHECKLIST.md`
- Local verification commands run during this pass:
  - `npm test` — passed
  - `npm run qa:api` — passed
  - `git status --short` — currently shows untracked `MONETIZATION_IMPLEMENTATION_PLAN.md` and `MONEY_MAKING_MANDATE.md`

## Executive Readiness Call

WrenchPro is **not ready to ask external users to pay yet**.

It may be close to a **controlled internal alpha** if the installed app launch, manual UI click-through, data persistence, invoice/receipt usability, and backup/update safety checks pass.

For a **private beta with trusted mechanics**, the largest blockers are not broad feature count. The product already has many modules. The blockers are trust, data safety, and whether the core money workflow can be completed reliably without confusing disconnected records.

## Minimum Bar Before Asking Anyone to Pay

Do not ask for payment until all of these are true:

1. A mechanic can complete the full lifecycle without developer help:
   - lead/customer/vehicle
   - estimate
   - approval
   - job/work order
   - schedule/date/time
   - invoice or receipt
   - payment
   - warranty/follow-up if applicable
2. The installed Windows app launches from the Desktop shortcut and survives close/reopen.
3. Data persists across app restart and install/update.
4. The invoice/receipt output is usable enough to hand to a real customer.
5. Payment status and dashboard totals are correct after full, partial, and no-payment scenarios.
6. There is a documented backup/restore or at least database backup procedure.
7. Business-critical records are protected from accidental permanent deletion, or limitations are clearly documented and tested only with throwaway data.
8. Known issues and release notes are current.
9. Brandon explicitly approves the release/private beta.

## Revenue Blockers

### BLOCKER-001: Manual installed-app QA has not been completed

- Priority: Critical
- Area: Release / Product Trust
- Evidence: `QA_INITIAL_PASS.md` says automated API/smoke checks passed, but manual UI, installed app launch, install/update persistence, PDF/print, and deep CRUD are not covered.
- Risk: A paying/private-beta user judges the product by the UI and installer, not API tests.
- Minimum required outcome:
  - Installed app launches from Desktop shortcut.
  - Dashboard loads.
  - Core navigation works.
  - App closes/reopens cleanly.
  - Data persists.
  - No visible blocking errors.

### BLOCKER-002: Full revenue workflow needs one successful manual end-to-end pass

- Priority: Critical
- Area: Core Business Workflow
- Evidence: Automated QA covers lead -> customer/vehicle -> estimate -> job -> paid status at API level, but not full UI flow or invoice/payment/warranty/follow-up confidence.
- Risk: The app may technically have features but still fail the actual mechanic workflow.
- Minimum required outcome:
  - Create a realistic test customer and vehicle.
  - Create estimate with labor, parts, tax, discount if supported.
  - Convert estimate to job.
  - Schedule or date the job.
  - Complete job with mileage/diagnosis/work notes.
  - Generate/print invoice or receipt.
  - Record payment.
  - Confirm dashboard/report totals update correctly.

### BLOCKER-003: Invoice/receipt model is not product-confidence ready

- Priority: Critical for paid users; High for private beta
- Area: Invoicing / Payments
- Evidence: Business assumptions identify no dedicated invoices table; invoices appear inferred from jobs/payments/print view.
- Risk: Mechanics need durable proof of work, clear balances, invoice numbers, and paid/unpaid status. If this is ambiguous, asking for money is premature.
- Minimum required outcome before private beta:
  - Decide and document whether `job = invoice` for this release.
  - Confirm printed job invoice/receipt contains business info, customer, vehicle, line items/totals, payment status, and date.
  - Test unpaid, partially paid, and paid cases.
- Minimum required outcome before paid release:
  - Add or emulate invoice number, due date, paid date/status, balance, and sent/printed metadata.

### BLOCKER-004: Data safety/update safety is unproven

- Priority: Critical
- Area: Data Safety / Installer
- Evidence: Release checklist requires database location, backup before install/update, uninstall behavior, and update persistence; QA initial pass says this is not covered.
- Risk: Losing a mechanic's customer/job/payment records is unacceptable.
- Minimum required outcome:
  - Identify and document database location.
  - Create backup before install/update test.
  - Confirm install/update preserves data.
  - Confirm uninstall behavior is understood.
  - Add a simple user-facing backup instruction before beta.

### BLOCKER-005: Permanent deletes are risky for real business records

- Priority: High
- Area: Data Safety / UX
- Evidence: Business assumptions flag hard deletes across main entities; testing checklist warns to delete/archive only with test data.
- Risk: A beta user can accidentally destroy customer/job/payment history.
- Minimum required outcome before private beta:
  - Either implement archive/void/inactive flows for customer, vehicle, job, payment, and estimate records, or document delete limitations clearly and add confirmation guardrails.
- Minimum required outcome before paid release:
  - Avoid hard-delete as the normal path for business-critical records.

### BLOCKER-006: Scheduling is disconnected from core records

- Priority: High
- Area: Mobile Mechanic Workflow
- Evidence: Business assumptions state appointments use free-text customer/phone/service/date/time and are not linked to customer, vehicle, job, lead, or estimate.
- Risk: Mobile mechanics need who/what/where/when in one place. Disconnected appointments cause duplicate entry and missed context.
- Minimum required outcome before private beta:
  - Either link appointments to customer/vehicle/job/estimate, or document an alpha rule that scheduling happens from the job date/status and appointments are optional notes.
- Minimum required outcome before paid release:
  - Linked appointment records with service address/location should be implemented.

### BLOCKER-007: Financial totals need manual trust checks

- Priority: High
- Area: Payments / Reporting
- Evidence: Testing checklist marks totals/payments wrong as release blockers; QA only checks aggregate dashboard fields at API level.
- Risk: Bad totals directly damage user trust and business decisions.
- Minimum required outcome:
  - Test estimate totals with labor, parts, discount, tax.
  - Test payment recording for full and partial payment.
  - Test expense entry.
  - Confirm dashboard/P&L values match expected math for a controlled dataset.

## Should-Fix Before Private Beta

These do not necessarily block an internal alpha, but they should be addressed or deliberately deferred before giving WrenchPro to 1-3 external mechanics.

1. **Approval proof is weak**
   - Add approval date/method/notes at minimum, or document that approval is external for alpha.
2. **Parts/inventory are not connected to estimate/job usage**
   - Decide if inventory is purely reference-only for beta, or implement inventory-backed line items and quantity decrement.
3. **Service address/travel model is unclear**
   - For mobile mechanics, document whether customer address is used as service address, and how travel fees are represented.
4. **Backup/restore UX is missing**
   - At minimum provide a `Where your data lives / How to back it up` doc.
5. **Payment plan reconciliation needs focused testing**
   - Confirm plan/installment payments line up with job/customer balances or mark feature experimental.
6. **Settings/business profile must be verified**
   - Invoice/receipt credibility depends on business name, contact info, tax/labor settings, and persistence.
7. **Release docs need to match actual shipped behavior**
   - `KNOWN_ISSUES.md`, release notes, and roadmap should be current before any beta handoff.

## Nice-to-Have / Defer Safely

These are useful but should not block private beta if limitations are clear:

- Branded app icon (`ISSUE-008`)
- Direct SMS/email/call integrations
- Online payment processor
- VIN decode
- Photo/document attachments
- Map routing/route optimization
- Customer portal or cloud sync
- Fleet/commercial account hierarchy
- Automated warranty creation
- Advanced tax/bookkeeping exports
- Full Electron/electron-builder dependency upgrade for dev audit findings, assuming production audit remains clean and risk is documented

## Current Known Issues Impacting Revenue Readiness

### ISSUE-002: Project docs and issue tracker are untracked locally

- Revenue impact: Medium
- Current observation: `git status --short` now shows untracked monetization docs, not the previously listed tracker docs. Repo hygiene still matters before release.
- Action: Decide which planning/docs should be committed vs intentionally local-only.

### ISSUE-007: Dev/build dependency vulnerabilities

- Revenue impact: Medium before public release, lower for controlled private beta if production audit is clean.
- Action: Keep documented. Do not force-upgrade Electron/electron-builder without a dedicated compatibility pass.

### ISSUE-008: Default Electron icon

- Revenue impact: Low for private beta; medium for perceived polish in paid release.
- Action: Defer until core workflow is trusted.

## Minimum Agent-Owned Next Tasks

### Task 1: Manual installed-app smoke test

- Owner: QA agent
- Type: Check, no product design decision required
- Steps:
  1. Build or use current installer.
  2. Install locally.
  3. Launch from Desktop shortcut.
  4. Confirm dashboard/nav/restart/persistence.
  5. Record results in `QA_INITIAL_PASS.md` or a new manual QA report.

### Task 2: Manual end-to-end revenue workflow test

- Owner: QA/product agent
- Type: Check, no code changes unless defects are found
- Steps:
  1. Use a throwaway realistic mobile mechanic dataset.
  2. Complete lead -> customer/vehicle -> estimate -> approval/status -> job -> schedule/date -> invoice/print -> payment -> dashboard/report verification.
  3. Log every defect in `KNOWN_ISSUES.md`.

### Task 3: Invoice/receipt acceptance review

- Owner: Product readiness agent
- Type: Product spec/check
- Steps:
  1. Inspect current invoice/print output.
  2. Define minimum fields required for beta.
  3. Decide whether `job = invoice` is acceptable for beta.
  4. Produce implementation tasks only for missing must-have fields.

### Task 4: Data safety and backup note

- Owner: Release/readiness agent
- Type: Documentation/check
- Steps:
  1. Identify actual app database location.
  2. Test backup copy and restore if feasible.
  3. Document backup/update instructions.
  4. Confirm uninstall/update data behavior.

### Task 5: Delete/archive risk pass

- Owner: Product/engineering agent
- Type: Product change likely required
- Steps:
  1. Inventory delete routes/buttons for critical records.
  2. Add confirmation/guardrail or convert to archive/void where practical.
  3. Ensure QA never needs real-data deletion for correction workflows.

### Task 6: Financial math QA dataset

- Owner: QA agent
- Type: Check
- Steps:
  1. Create a controlled dataset with known labor, parts, tax, discount, payment, partial payment, expense.
  2. Verify estimate/job/payment/dashboard/P&L totals manually.
  3. Record pass/fail details.

### Task 7: Beta limitations sheet

- Owner: Product/release agent
- Type: Documentation
- Steps:
  1. Write a one-page `PRIVATE_BETA_LIMITATIONS.md`.
  2. Include local-only data, no cloud sync, no online payments, backup expectations, known invoice/scheduling limitations, and support/feedback channel.

## Recommended Revenue Sequence

1. **Internal alpha readiness**
   - Pass installed-app smoke.
   - Pass one manual full workflow.
   - Confirm data persistence.

2. **Friendly private beta readiness**
   - Add/document backup procedure.
   - Resolve or disclose invoice/scheduling/delete limitations.
   - Verify financial math.
   - Prepare release notes, known issues, and feedback intake.

3. **Paid readiness**
   - Strengthen invoice/balance model.
   - Safer archive/void behavior.
   - Linked scheduling/service address.
   - Clear backup/restore UX.
   - Branded installer polish and basic support process.

## Bottom Line

The fastest safe path is **not adding more modules**. It is proving the existing core workflow under installed-app conditions, then tightening invoice/payment/data-safety trust.

If those checks pass, WrenchPro can be positioned as a local, early-access mechanic command center. If they fail, the failures should become the next engineering queue before any revenue ask.
