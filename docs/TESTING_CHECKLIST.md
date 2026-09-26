# WrenchPro Testing Checklist

Use this for manual QA before releases.

## Test Setup

- [ ] Confirm current Git branch/status.
- [ ] Confirm app starts in dev mode.
- [ ] Confirm installed app launches from Desktop shortcut.
- [ ] Confirm database location and test data safety.
- [ ] Use test records unless Brandon confirms real data can be edited.

## Automated Local Checks

- [ ] `npm test` passes.
- [ ] `npm run qa:api` passes.
- [ ] If either fails after `electron:build` with a `better-sqlite3` ABI error, run `npm run rebuild-node` and retry.

## Smoke Test

- [ ] App launches without errors.
- [ ] Dashboard loads.
- [ ] Navigation buttons work.
- [ ] No obvious console/server errors.
- [ ] App can be closed and reopened.
- [ ] Data persists after reopening.

## Customers

- [ ] Create customer.
- [ ] View customer list.
- [ ] Open customer detail.
- [ ] Edit customer.
- [ ] Search/filter customer if supported.
- [ ] Delete/archive customer only with test data.
- [ ] Customer validation works.

## Vehicles

- [ ] Create vehicle linked to customer.
- [ ] View vehicle list.
- [ ] Edit vehicle.
- [ ] Confirm service history relationship.
- [ ] Confirm required fields.

## Jobs / Work Orders

- [ ] Create job.
- [ ] Link job to customer and vehicle.
- [ ] Add service/problem description.
- [ ] Change job status.
- [ ] Add labor/parts/notes if supported.
- [ ] Close job.
- [ ] Reopen/edit job if supported.

## Estimates

- [ ] Create estimate.
- [ ] Add line items.
- [ ] Link to customer/vehicle/job if supported.
- [ ] Edit estimate.
- [ ] Approve/convert estimate if supported.
- [ ] Verify totals.

## Inspections

- [ ] Create inspection.
- [ ] Link inspection to job/vehicle.
- [ ] Add checklist/notes.
- [ ] Save and reopen.

## Inventory / Catalog

- [ ] Create catalog item.
- [ ] Create inventory item.
- [ ] Edit quantity/cost/price.
- [ ] Use item on estimate/job if supported.

## Leads / CRM

- [ ] Create lead.
- [ ] Convert lead to customer if supported.
- [ ] Add interaction/follow-up.
- [ ] Confirm reminders/statuses.

## Time Tracking

- [ ] Start/add time entry.
- [ ] Link to job/employee if supported.
- [ ] Edit time entry.
- [ ] Confirm totals.

## Payments / Expenses

- [ ] Add payment.
- [ ] Link payment to job/invoice if supported.
- [ ] Add expense.
- [ ] Verify totals/reports if supported.

## Warranties

- [ ] Create warranty.
- [ ] Link to job/customer/vehicle.
- [ ] Confirm dates/mileage/coverage notes.

## Settings

- [ ] Business profile saves.
- [ ] Tax/labor/shop settings save if supported.
- [ ] Settings persist after restart.

## Build / Install Test

- [ ] Run build command.
- [ ] Installer is created in `dist`.
- [ ] Install/update works.
- [ ] Desktop shortcut launches correct version.
- [ ] Existing data remains after update.

## Release Blockers

A release should be blocked if any of these are true:

- app does not launch
- customer/vehicle/job creation is broken
- data does not persist
- totals/payments are wrong
- installer corrupts or loses data
- navigation blocks normal use
- critical business workflow cannot be completed
