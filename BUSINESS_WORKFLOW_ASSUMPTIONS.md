# WrenchPro Business Workflow Assumptions

Generated: 2026-04-29
Owner: Business Workflow Agent
Scope: Provisional workflow model for a solo/small mobile mechanic business, inferred from `BUSINESS_WORKFLOW.md`, project operating docs, route names, database schema, and current UI/API capabilities. These assumptions are meant to unblock QA/product work without requiring Brandon to answer a long questionnaire first.

## Evidence Reviewed

- Planning docs: `BUSINESS_WORKFLOW.md`, `PROJECT_COMMAND_CENTER.md`, `COMPANY_OPERATING_MODEL.md`, `AUTONOMOUS_OPERATING_RULES.md`, `ROADMAP.md`.
- UI shell: `public/index.html` exposes pages for Dashboard, Leads, Estimates, Jobs, Schedule, Inspections, Quick Entry, Customers, Vehicles, Parts / Inventory, Service Catalog, Warranties, Employees, Time Tracking, Finance Overview, Payment Plans, Expenses, P&L Report, and Settings.
- API routes: customers, vehicles, jobs, appointments, employees, CRM interactions/follow-ups/service reminders, leads, estimates, inventory, catalog, inspections, warranties, time logs, payments, payment plans, expenses, settings, dashboard.
- Database model: customers, vehicles, jobs, leads, estimates + estimate items, inspections + inspection items, parts inventory, service catalog, warranties, employees, time logs, appointments, payments, payment plans/installments, expenses, settings.

## Provisional Business Basics

Assumption: The first real target user is a solo or family-run mobile mechanic, likely doing local customer-pay work from phone/text referrals.
Confidence: Medium
Why: Project docs repeatedly describe mobile mechanic use; current app is local desktop/Electron with single-business settings and no multi-location/multi-tenant model.
Needs Human Approval?: No for internal QA and workflow modeling; Yes before public positioning/marketing.

Assumption: Jobs are usually customer-pay repair/maintenance/diagnostic jobs, not insurance or dealership work.
Confidence: Medium
Why: App supports cash/card/check-style payments, estimates, warranties, service catalog, parts, expenses, and customer follow-up; no claim/vendor/RO compliance features.
Needs Human Approval?: No.

Assumption: Customer records may be individual retail customers first, with commercial/fleet support treated as a later or light-current capability.
Confidence: Medium
Why: Customers include `customer_type`, `status`, `tags`, preferred contact, and billing address, but there is no dedicated fleet/account hierarchy.
Needs Human Approval?: No for internal assumptions; Yes before promising fleet features.

## Provisional End-to-End Mobile Mechanic Workflow

### 1. Lead / First Contact

Expected real-world behavior:
- Customer contacts mechanic by phone, text, referral, Facebook, Google, or repeat business.
- Mechanic captures name, phone, vehicle basics, service/problem, source, urgency, rough value, and follow-up date.
- Lead may be new, contacted, quoted, won, or lost.

Current app support:
- `leads` table and API support first/last name, phone, email, source, vehicle year/make/model, service needed, status, notes, follow-up date, estimated value, and conversion to customer.
- UI has Leads page and lead conversion.

Likely gaps:
- No direct call/text/email integration.
- No explicit urgency/priority, location/service address, preferred appointment window, or lead loss reason.
- Lead conversion creates customer and optionally vehicle, but does not automatically create estimate/job/appointment.

### 2. Customer Record

Expected real-world behavior:
- Customer should be easy to find by name/phone.
- Required minimum: first/last or business name, phone, and maybe address/service area.
- Notes/tags/status matter for repeat customers, problem customers, and fleet/commercial accounts.

Current app support:
- Customers have first/last, phone, email, address, notes, status, tags, customer type, preferred contact, billing address.
- Customer detail appears to aggregate related vehicles/jobs/payments/CRM activity.

Likely gaps:
- Customer deletion is hard-delete oriented; production use likely needs archive/inactive defaults and data-safety guardrails.
- No explicit separate service address vs billing address per job.
- No company/contact-person structure for commercial customers.

### 3. Vehicle Record

Expected real-world behavior:
- Customer can have multiple vehicles.
- Mechanic needs year/make/model, VIN if available, mileage, plate/state, engine/transmission/fuel details, notes, and service history.

Current app support:
- Vehicles are linked to customer and support year/make/model/trim/color/plate/state/VIN/miles/oil-change miles/fuel/transmission/engine/notes.
- Jobs and inspections can link to vehicles.

Likely gaps:
- VIN is optional and there is no VIN decode.
- No photo/doc attachment for registration/VIN/odometer.
- Oil-change-mile tracking exists but broader recurring maintenance due logic appears limited to CRM service reminders.

### 4. Problem / Diagnostic Intake

Expected real-world behavior:
- Mechanic captures customer complaint, symptoms, requested service, diagnostic notes, mileage, and maybe photos.
- Some jobs start as diagnostic-only and later become a repair estimate.

Current app support:
- Jobs include service, complaint, diagnosis, notes, miles.
- Estimates include customer complaint and notes.
- Service catalog can provide standard services/hours/prices.

Likely gaps:
- No structured symptom/intake checklist.
- No photo/video attachments.
- No separate diagnostic authorization/deposit flow.

### 5. Estimate / Quote

Expected real-world behavior:
- Mechanic builds estimate from labor, parts, fees, taxes, discount, and notes/terms.
- Customer approves before parts/work when needed.
- Estimate should be printable/shareable and convert to job/work order.

Current app support:
- Estimates have number, customer, vehicle, employee, date, status, complaint, notes, discount, tax rate, expiration, total, and line items.
- Estimate line items support type, description, quantity, rate, amount.
- Estimate can convert to a pending job and mark estimate Approved.
- UI includes an estimate invoice/print-style function.

Likely gaps:
- Approval is a status update only; no signature, approval timestamp, approval method, or customer-facing send/share flow.
- Estimate conversion does not appear to create appointment, parts reservations, warranty, payment request, or follow-up automatically.
- Job update route does not allow changing customer/vehicle after creation; this is good for stability but may be awkward for correction workflows.
- No explicit shop supplies, travel fee, disposal fee, deposit, or separate taxable/non-taxable totals beyond line-item taxable catalog support and estimate tax rate.

### 6. Scheduling / Route Planning

Expected real-world behavior:
- Mobile mechanic schedules by date/time, customer location, travel distance, and sometimes parts availability.
- Needs daily agenda and reminder of who/where/what.

Current app support:
- Appointments have customer name text, phone, service, date, time.
- UI has Schedule/calendar page.
- Jobs have date but are separate from appointments.

Likely gaps:
- Appointment is not formally linked to customer, vehicle, job, lead, or estimate.
- No service address/location, map, route order, travel time, arrival window, or travel fee tracking.
- No reminder notification/SMS/email.
- Potential duplicate scheduling data between `appointments.date` and `jobs.date`.

### 7. Parts / Inventory

Expected real-world behavior:
- Mechanic either buys parts per job or tracks small stock of common parts/fluids.
- Needs cost vs retail price, vendor/source, part number, quantity, reorder threshold, and link to estimates/jobs.

Current app support:
- Parts inventory supports name, part number, vendor, cost, retail price, quantity, reorder quantity, location, notes.
- Service catalog supports default hours/prices.
- Estimate line items can represent parts.

Likely gaps:
- Estimate/job parts are not linked to inventory records; no automatic quantity decrement, reservation, purchase order, or vendor order status.
- No per-job part sourcing status: needed/ordered/received/returned/core charge.
- No inventory valuation or low-stock workflow beyond possible UI highlighting.

### 8. Work Performed / Work Order

Expected real-world behavior:
- Mechanic works the job, tracks status, labor time, parts used, findings, recommendations, and completion notes.
- Status flow should match actual shop language.

Current app support:
- Jobs support service, date, mileage, labor, labor hours/rate, parts total, status, notes, employee, complaint, diagnosis, invoice status, estimate link.
- Employees and time logs can link labor time to jobs.

Likely gaps:
- Job status list needs confirmation; likely statuses should include New/Pending, Scheduled, Diagnosing, Waiting on Parts, In Progress, Ready for Payment, Done/Closed, Cancelled.
- No structured work-order line items separate from estimate items.
- No automatic transfer of time logs into labor charges.
- No checklist for job completion/quality control.

### 9. Inspection / Findings

Expected real-world behavior:
- Inspection records should document pass/advisory/fail items, safety issues, notes, and recommendations.
- Photos are valuable for customer trust.

Current app support:
- Inspections link to job/customer/vehicle/employee with status, notes, and checklist items by category/item/condition/notes.
- UI includes inspection checklist functions.

Likely gaps:
- No photo attachments.
- No canned inspection templates management visible in API.
- Inspection findings do not automatically create estimate recommendations/follow-ups.

### 10. Invoice / Payment

Expected real-world behavior:
- After work, mechanic invoices/collects payment and records method/date/amount/balance.
- May accept partial payment, deposits, payment plans, cash/card/Zelle/Cash App/etc.

Current app support:
- Payments link to customer, plan, job with description, amount, method, date, note.
- Jobs have invoice status.
- Payment plans and installments exist.
- Expenses and P&L/reporting exist.
- Job invoice print-style function exists in UI.

Likely gaps:
- There is no dedicated invoices table; invoice is inferred from job/payment/print view.
- No invoice number, due date, balance calculation, sent date, paid date, or PDF persistence.
- No online payment processor integration.
- Payment methods likely need tailoring to the mechanic's real methods.
- Tax/fees/discounts may be estimate-side but not consistently modeled job/invoice-side.

### 11. Warranty / Follow-Up / Reminder

Expected real-world behavior:
- Mechanic may offer parts/labor warranty by time and/or mileage.
- Follow-up reminders drive repeat work: oil changes, brakes, recommended repairs, unpaid balances.

Current app support:
- Warranties link to job/customer/vehicle with labor months, parts months, mileage limit, start/expires dates, status, notes.
- CRM supports interactions, follow-ups, and service reminders.

Likely gaps:
- Warranties are manual; no automatic creation from completed job/service catalog.
- No warranty claim workflow.
- No automatic reminder delivery.
- No mileage-based reminder trigger unless manually reviewed.

### 12. Reporting / Business Management

Expected real-world behavior:
- Owner needs weekly/monthly revenue, expenses, net profit, unpaid invoices, open estimates, active jobs, parts cost, labor/time, taxes, and customer follow-up.

Current app support:
- Dashboard shows revenue, expenses, net profit, active jobs, customers, vehicles, recent jobs/payments.
- P&L report and finance overview exist.
- Expenses and payments are modeled.

Likely gaps:
- No sales tax report/payment report by date range confirmed from API.
- No accounts receivable/open invoice report due to lack of invoice table/balance model.
- No profit-per-job if parts/labor costs/time are not consistently connected.
- No export/backup workflow confirmed here.

## Provisional Workflow States

Recommended temporary job statuses for testing:
1. Pending / New
2. Scheduled
3. Diagnosing
4. Waiting on Parts
5. In Progress
6. Ready for Payment
7. Done / Closed
8. Cancelled

Recommended estimate statuses for testing:
1. Draft
2. Sent / Presented
3. Approved
4. Declined
5. Expired
6. Converted

Recommended lead statuses for testing:
1. New
2. Contacted
3. Estimate Needed
4. Estimate Sent
5. Won
6. Lost

Recommended invoice/payment statuses for testing:
1. Unpaid
2. Deposit Paid
3. Partial
4. Paid
5. Overdue
6. Written Off / Cancelled

## Highest-Priority Workflow Gaps

| Gap | Why It Matters | Priority | Current Evidence | Suggested Next Step |
|---|---|---:|---|---|
| Appointments are not linked to customers/vehicles/jobs/estimates | Mobile mechanic scheduling depends on who/where/what; disconnected appointments create duplicate entry and missed context | High | `appointments` table stores free-text `cust`, phone, service, date, time only | Add or plan linked appointment fields: customer_id, vehicle_id, job_id/estimate_id, location/address |
| No dedicated invoice entity | Real business needs invoice number, due date, balance, paid/sent status, and durable invoice history | High | Payments exist; jobs have invoice_status; print invoice UI appears job-based | Decide whether to add `invoices` table before real beta or treat job as invoice in alpha with clear rules |
| Estimate approval is weakly modeled | Approval proof matters before ordering parts/doing work | High | Estimate status can become Approved; no signature/method/timestamp | Add approval metadata or at least status/date/notes acceptance criteria |
| Parts are not connected to jobs/estimates/inventory consumption | Profit and stock tracking will be wrong if parts are just text/amounts | High | Inventory exists; estimate items are generic and not linked to inventory IDs | Add acceptance criteria for manual part line item vs inventory-backed part behavior |
| No service location/travel model | Mobile mechanic workflow needs address, travel time, mileage, route, and fees | High | Customer address exists; appointments/jobs lack service address/travel fee | Add provisional fields or testing rule: use customer address + service fee setting for now |
| Job completion does not automatically drive invoice/payment/warranty/follow-up | Closing the loop is the core business workflow | High | Separate jobs, payments, warranties, CRM reminders | Define close-job checklist: invoice status, payment, warranty, reminder |
| No photo/document attachments | Inspections, diagnostics, VIN, parts receipts, and proof of work benefit heavily from photos | Medium | No attachment tables/routes observed | Park as beta feature unless real user needs proof-of-work immediately |
| Hard deletes in main entities | Accidental deletion is risky for business records | Medium/High | Delete routes exist for customers/jobs/vehicles/payments/etc. | For alpha, QA only deletes test data; for beta, consider archive/void instead of delete for business records |
| Payment plans may not reconcile with job balances | Partial/deferred payment is supported, but invoice balance model is unclear | Medium | Plans/installments/payments exist; no invoice balance table | Test plan flow end-to-end and define expected balance rules |
| Reporting may not satisfy tax/bookkeeping needs | Owner needs reliable monthly numbers and likely tax reports | Medium | Dashboard/P&L exist; no export/date-range API confirmed here | Add reporting acceptance criteria for date filters and expense categories |

## App-Readiness Criteria for Real Business Alpha

Minimum criteria before Brandon/brother uses it on real jobs:

1. Create lead -> convert to customer/vehicle without losing details.
2. Create customer with multiple vehicles and find them quickly.
3. Create estimate with labor/parts/tax/discount and verify total math.
4. Convert approved estimate to job and preserve complaint/service/parts/labor context.
5. Schedule the job in a way that clearly shows date/time/customer/service.
6. Complete job with final mileage, complaint/diagnosis/work notes, parts/labor totals, and status.
7. Generate/print a usable invoice or job receipt with business settings.
8. Record full or partial payment and see invoice/payment status accurately.
9. Create warranty/follow-up/reminder from completed job.
10. Dashboard/report totals reflect payments and expenses correctly.
11. Data persists after app close/reopen and after install/update testing.
12. No normal workflow requires deleting real data to correct a mistake.

## App-Readiness Criteria for Private Beta

Additional criteria before 1-3 external trusted mechanics:

1. Clear backup/restore and data location documentation.
2. Basic user guide for the standard job lifecycle.
3. Release notes and known-issues list maintained.
4. Safer delete/archive/void behavior for business-critical records.
5. Date-range reporting for revenue, expenses, unpaid work, and taxes.
6. A support/feedback intake process that does not expose Brandon to chaos.
7. Clear statement of limitations: local desktop app, no cloud sync/mobile companion unless added later.

## Assumptions to Validate Later With Brandon or Real User

These do not block internal QA, but should be confirmed before real beta/public positioning:

- Actual business name, owner/operator name, service area, and services offered.
- Whether the primary user needs fleet/commercial accounts now or later.
- Required customer fields and preferred contact methods.
- Whether VIN, mileage, plate/state are required or optional in real use.
- Actual job statuses and whether every repair needs an estimate first.
- Accepted payment methods and whether deposits are common.
- Whether taxes, shop supplies, disposal fees, travel fees, and discounts are used.
- Whether parts are stocked or bought per job.
- Warranty terms by service/part and whether warranty claims must be tracked.
- Reporting requirements for taxes/bookkeeping.

## Recommended Product Stance for Now

Use WrenchPro as a practical local command center for a solo mobile mechanic, centered on:

1. Capturing leads and customer/vehicle records.
2. Building estimates.
3. Converting approved work to jobs.
4. Scheduling and completing work.
5. Recording payments/expenses.
6. Tracking warranties and follow-ups.

Do not promise automation-heavy features yet (SMS, online booking, payment processing, route optimization, customer portal, cloud sync). The current product looks strongest as a local alpha tool with broad workflow coverage but several connection gaps between modules.
