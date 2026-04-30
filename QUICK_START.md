# WrenchPro Quick Start

Status: First-pass draft for early private beta users  
Audience: Brandon, first tester/business owner, and trusted private beta users

## What WrenchPro Is

WrenchPro is desktop software for mobile mechanics and small mechanic businesses. It helps organize leads, customers, vehicles, estimates, jobs/work orders, scheduling, inspections, parts/inventory, payments, expenses, warranties, employee time, and follow-ups.

> Private beta note: WrenchPro is still in QA / polish / stabilization. Use it with test data first, keep backups, and report anything confusing or broken.

## First-Time Setup

1. Install WrenchPro using the latest approved installer.
2. Launch WrenchPro from the Desktop shortcut or Start Menu.
3. Open **Settings**.
4. Enter business information:
   - business name and owner name
   - phone, email, address, website, business hours
   - default labor/diagnostic/fleet/emergency rates if used
   - service fee and tax rate if applicable
   - invoice terms/footer and warranty terms
5. Save settings.
6. Add a test customer and test vehicle before entering real customer data.

## Recommended First Workflow

Use this order for the cleanest customer-to-payment test:

1. **Lead** — enter the first contact if the person is not a customer yet.
2. **Convert Lead to Customer** when they are ready to move forward.
3. **Customer** — confirm name, phone, email, address, status, tags, notes, and preferred contact method.
4. **Vehicle** — add year/make/model, VIN/plate if available, mileage, engine, transmission, fuel type, and notes.
5. **Estimate** — create labor/parts/service lines, discounts, tax, complaint, notes, and expiration date.
6. **Convert Estimate to Job** after approval.
7. **Job** — track service, date, mileage, labor, parts, complaint, diagnosis, status, invoice status, and notes.
8. **Schedule** — add an appointment if the work is planned for a date/time.
9. **Inspection** — document pass/advisory/fail/N/A checklist items when needed.
10. **Payment** — record money collected.
11. **Warranty / Follow-up / Reminder** — track post-job obligations and future service.

## Main Screens

- **Dashboard:** overview of recent business activity.
- **Leads:** prospects, source, requested service, status, follow-up date, and estimated value.
- **Customers:** customer profile, interactions, follow-ups, service reminders, vehicles, and job history.
- **Vehicles:** vehicle records linked to customers.
- **Estimates:** estimate builder with labor/parts lines, totals, print/share view, and estimate-to-job conversion.
- **Jobs:** active and historical work orders.
- **Schedule:** appointment calendar.
- **Inspections:** checklist-style inspection records.
- **Parts / Inventory:** parts, vendor, cost, retail price, stock quantity, reorder quantity, and location.
- **Service Catalog:** reusable services with default hours/prices for estimates.
- **Warranties:** labor/parts/mileage coverage and expiration tracking.
- **Employees:** employee contact, role, hourly rate, and status.
- **Time Tracking:** job/general time logs.
- **Finance:** payment overview.
- **Payment Plans:** installments, due dates, down payments, balances, and overdue items.
- **Expenses:** business expense records.
- **P&L Report:** income, expenses, and profit by period.
- **Settings:** business profile, rates, taxes, invoice terms, logo, and warranty terms.

## Daily Use Tips

- Search before creating a customer to avoid duplicates.
- Add the vehicle before creating an estimate or job.
- Use consistent statuses so open work is easy to find.
- Record payments immediately after collection.
- Keep notes short but specific: what was requested, what was found, what was done, and what still needs attention.
- Use follow-ups and service reminders for future customer contact.

## Known Private Beta Assumptions / Limits

- **Assumption:** Windows desktop install is the first private beta path.
- WrenchPro stores data locally in a SQLite database on the computer running the app.
- No cloud sync or multi-device sync is documented yet.
- No dedicated public support channel is open yet.
- Before relying on real business data, confirm backups are working for the tester's machine.

## If Something Goes Wrong

1. Write down what screen you were on.
2. Write what you clicked or typed right before the issue.
3. Take a screenshot if possible.
4. Do not uninstall/reinstall until the database is backed up.
5. Use `PRIVATE_BETA_FEEDBACK_GUIDE.md` to report the issue.
