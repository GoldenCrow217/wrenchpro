# WrenchPro Private Beta Feedback Guide

Status: First-pass draft for early private beta users

## Beta Goal

The private beta is for proving WrenchPro can support a real mobile mechanic workflow safely and clearly.

Priority order:

1. Reliability
2. Core business workflow
3. Data safety
4. Usability
5. Advanced features later

## What To Test First

Please focus on normal daily business work:

- create a lead
- convert a lead to a customer
- add a customer manually
- add one or more vehicles
- create an estimate
- convert an estimate to a job
- schedule an appointment
- complete or update a job
- record an inspection
- record a payment
- create a payment plan if relevant
- enter an expense
- review the P&L report
- create a warranty or follow-up reminder
- close and reopen WrenchPro to confirm data is still there

## Bug Report Template

```md
## Bug: Short title

- Tester:
- Date:
- WrenchPro version:
- Windows version, if known:
- Screen / area:
- Severity: Critical / High / Medium / Low

### What were you trying to do?


### What happened?


### What did you expect to happen?


### Steps to reproduce

1.
2.
3.

### Did it happen more than once?


### Workaround, if any


### Screenshot / notes


```

## Severity Guide

- **Critical:** data loss, app will not launch, cannot save core records, update breaks data.
- **High:** core workflow disrupted but there may be a workaround; wrong totals; estimate/job/payment issues.
- **Medium:** important workflow or usability issue; confusing field; missing status; too many clicks.
- **Low:** typo, layout polish, label change, nice-to-have shortcut.

## Feature Request Template

```md
## Feature request: Short title

- Tester:
- Date:
- Area: Customers / Vehicles / Jobs / Estimates / Scheduling / Finance / etc.

### What problem would this solve?


### How do you handle this today?


### What would the ideal WrenchPro behavior be?


### How often would you use it?

Daily / Weekly / Monthly / Rarely

### Is this needed before real business use?

Yes / No / Not sure

```

## Workflow Feedback Template

Use this when WrenchPro technically works, but does not match the way a mobile mechanic actually works.

```md
## Workflow feedback: Short title

- Tester:
- Date:
- Real-world step:

### What happens in the real business?


### What WrenchPro currently does


### What feels missing, extra, or out of order?


### Suggested change


```

## Questions Testers Should Answer

### Customers

- What customer info is required before doing work?
- Do customers have multiple vehicles?
- Are commercial/fleet customers needed?
- Are tags/status/preferred contact useful?

### Vehicles

- Is VIN required or optional?
- What vehicle details matter most in the field?
- Should service history always be vehicle-based?

### Jobs

- What job statuses are needed?
- Does every job require an estimate first?
- Should jobs track parts, labor, fees, taxes, discounts, complaint, diagnosis, and work performed separately?

### Estimates / Invoices

- Do printed estimates/invoices include everything needed?
- Should estimates convert into jobs/invoices?
- What payment methods are accepted?
- Are deposits needed?

### Scheduling

- Do you schedule by exact time, day window, or route/location?
- Does travel time, mileage, or travel fee matter?

### Parts / Inventory

- Do you keep inventory or buy parts per job?
- Do you need vendor/source tracking?
- Do you need part cost vs customer price?
- Are low-stock alerts useful?

### Reports

- What weekly/monthly numbers matter most?
- Do you need revenue, expenses, profit per job, open estimates, unpaid invoices, or tax reports?

## Data Safety Feedback

Report immediately if:

- data disappears
- saved changes do not stay saved after restart
- update changes or removes records
- delete buttons remove more than expected
- app crashes while saving
- backup/restore instructions do not match the tester's machine

## What Not To Do During Beta

- Do not use WrenchPro as the only copy of important records until backup behavior is verified.
- Do not uninstall/reinstall without making a backup first.
- Do not delete real records just to test delete behavior unless you have a backup.
- Do not publish screenshots with real customer information publicly.

## Where Feedback Goes

For now, feedback should stay controlled:

- direct conversation with Brandon
- private tester notes/screenshots
- GitHub issues only if Brandon decides to make that public later

## Fast Feedback Format

```text
Version:
Screen:
Trying to:
What happened:
Expected:
How serious:
Screenshot attached: yes/no
```
