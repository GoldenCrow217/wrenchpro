# Handoff — WrenchPro Desktop GUI Redesign

## Overview

Full visual + interaction redesign of the **WrenchPro** Electron desktop app for mobile mechanics. Replaces the current cream-and-blue, table-heavy UI with a tighter "pro tool" aesthetic — warm off-white background, charcoal type, a single bold amber accent, and technical data set in a monospace face — across all 18 screens.

The redesign keeps the existing information architecture (same sidebar groups, same page set) and the existing backend. It improves the visual system, density, and consistency, and adds three desktop-appropriate interactions: a **⌘K command palette**, a **Jobs Kanban board**, and a **VIN decoder** in the Add-Vehicle flow.

**This is a desktop-only product.** Earlier drafts of this mock included customer-facing web pages (an estimate-approval portal and an online booking widget) and a multi-vendor parts marketplace. **Those have been removed** because they require the server to be exposed to the public internet, which conflicts with WrenchPro's offline / local-data model. Do not reintroduce them.

---

## About the Design Files

The files in this bundle are **HTML/CSS/JSX prototype references**, not production code. They were built with React + in-browser Babel for fast design iteration. **Do not ship them as-is.**

**Your task is to recreate this design inside the existing `wrenchpro/public/index.html` file using vanilla HTML / CSS / JS** — matching the project's current "no build step, single-file frontend" architecture (Electron 29 + Express + SQLite via better-sqlite3).

Hard constraints:

- **Do NOT introduce React, a bundler, Vite, Webpack, or any build step.** The app must stay a self-contained `public/index.html` that Electron loads directly. The current production frontend is a single 3,600-line `index.html` with one `<style>` block and one `<script>` block — keep that shape.
- **Do NOT add a cloud/account/subscription layer.** WrenchPro's selling points are: one-time purchase, fully offline, local SQLite database the user owns, Windows desktop. Every change must preserve that.
- **Keep the existing backend** (`server/routes/*.js`, `server/database.js`) intact except for the small, explicitly-listed schema additions below. The redesign is frontend-first.
- The prototype's React components map 1:1 to vanilla functions that build DOM nodes / HTML strings. **The prototype is the specification, not the implementation.**

If `index.html` grows unwieldy, split into multiple `<link>`/`<script>` tags loaded directly by the file — never a bundler.

---

## Fidelity

**High-fidelity.** Pixel-level mockup with final colors, typography, spacing, interactions, and copy. Treat measurements, OKLCH/hex values, and font choices as decisions to keep.

---

## Existing Codebase Context — READ FIRST

Before writing code, read these files in the repo:

| File | What to take from it |
|---|---|
| `public/index.html` | Current monolithic frontend. Confirm the existing `sp()` (set-page) and `openX()` modal-function naming, and element-ID conventions (`d-jobs`, `cf-first`, `jf-status`, `cust-search`, etc.). **Preserve these IDs and function names** so existing wiring/tests keep working. |
| `server/database.js` | The full SQLite schema + migration pattern (idempotent `ALTER TABLE` guarded by `PRAGMA table_info`). New columns MUST follow this same migration pattern. |
| `server/routes/*.js` | The 17 REST routers. Keep every fetch endpoint identical. |
| `server/index.js` | Express app + `/api/dashboard` aggregate. |
| `electron/main.js`, `electron/preload.js` | App shell, auto-updater, context bridge. Do not touch. |
| `README.md`, `BUSINESS_WORKFLOW.md` | Domain context — job lifecycle, terminology. |

### Real database schema (from `server/database.js`) — map the mock to THESE columns

The mock's field names are illustrative. Bind to the real columns:

| Mock field | Real column | Notes |
|---|---|---|
| `job.laborHrs` | `jobs.labor_hours` | exists via migration |
| `job.laborRate` | `jobs.labor_rate` | |
| `job.fee` | `jobs.travel_fee` | |
| `job.invStatus` | `jobs.invoice_status` | default `'Unpaid'` |
| `job.assignedTo` | `jobs.employee_id` → `employees` | join for name/initials |
| `job.complaint` | `jobs.complaint` | also `jobs.diagnosis` exists |
| `job.addr` | `jobs.service_address` | |
| `job.status` | `jobs.status` | values: Pending, Confirmed, En Route, In Progress, Waiting on Parts, Complete, Canceled (note: legacy `'Done'` is migrated to `'Complete'`) |
| `vehicle.oilDue` | `vehicles.oil_change_miles` | |
| `vehicle.miles` | `vehicles.miles` | |
| `vehicle.fuel` | `vehicles.fuel_type` | |
| `vehicle.engine/trim/plate/state/vin/color` | same on `vehicles` | all present |
| `customer.type` | `customers.customer_type` | Personal/Fleet/Dealership/Commercial |
| `customer.status` | `customers.status` | |
| `customer.tags` | `customers.tags` | comma-joined TEXT |
| estimate line items | `estimate_items` (`type`,`description`,`qty`,`rate`,`amount`,`inventory_id`) | the builder maps exactly |
| estimate header | `estimates` (`estimate_number`,`status`,`expires_date`,`total`,`discount`,`tax_rate`,`approved_at`,`approved_by`) | |
| part row | `parts_inventory` (`name`,`part_number`,`vendor`,`cost`,`retail_price`,`quantity`,`reorder_qty`,`location`) | |
| service template | `service_catalog` (`name`,`category`,`default_hours`,`default_price`,`taxable`,`notes`) | |
| warranty | `warranties` (`description`,`labor_months`,`parts_months`,`mileage_limit`,`expires_date`,`status`) | |
| inspection item P/A/F/NA | `inspection_items.condition` | string: `pass`/`advisory`/`fail`/`na` |
| time entry | `time_logs` (`employee_id`,`job_id`,`type`,`clock_in`,`clock_out`) | |
| lead | `leads` (`first`,`last`,`phone`,`source`,`vehicle_*`,`service_needed`,`status`,`follow_up_date`,`estimated_value`) | |
| payment | `payments` (`customer_id`,`plan_id`,`job_id`,`description`,`amount`,`method`,`date`) | |
| plan | `payment_plans` + `installments` | progress = sum(installments.paid)/total |
| settings | `settings` (single row id=1: `business_name`,`owner_name`,`default_labor_rate`,`diagnostic_rate`,`fleet_rate`,`emergency_rate`,`service_fee`,`tax_rate`,`oil_warn_miles`,`invoice_*`,`warranty_terms`, etc.) | |

The mock lines up cleanly with the existing schema. Only the three kept new features need additions (below).

---

## Schema additions required (follow the existing migration pattern)

Only **two** small additions, both for kept features. Add them in `server/database.js` using the same guarded `ALTER TABLE` / `CREATE TABLE IF NOT EXISTS` style already in the file.

**1. Inspection photos** (for the per-item photo feature):
```sql
CREATE TABLE IF NOT EXISTS inspection_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_item_id INTEGER NOT NULL,
  file_path TEXT,            -- store the image on disk under the app-data dir; keep only the path
  caption TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (inspection_item_id) REFERENCES inspection_items(id)
);
```
Save the actual image files under the writable app-data directory (the same place `wrenchpro.db` lives — see `WRENCHPRO_DATA` in `database.js`), e.g. `…/photos/<uuid>.jpg`. Only the relative path goes in SQLite. This keeps the offline / owned-data model intact.

**2. "Notify customer en route" toggle** (the SMS toggle in the job detail panel):
```sql
-- in the jobs migration block:
if (!jobCols.includes('notify_en_route'))
  db.prepare(`ALTER TABLE jobs ADD COLUMN notify_en_route INTEGER DEFAULT 1`).run();
```
This is a per-job boolean. Whether it actually sends an SMS is a separate, optional decision (see "Open questions"). The UI only needs to persist the flag.

**No other schema changes.** The VIN decoder and Kanban board need zero backend changes.

---

## Design Tokens

All tokens are CSS custom properties on `:root` in `styles.css`. Copy them verbatim into the top of `index.html`'s `<style>` block.

### Typography
- **UI font:** `'Inter Tight', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Mono font:** `'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace` — used for all technical/numeric data: VINs, plates, part numbers, work-order IDs, mileage, money, timestamps, durations
- **Base:** 14px body. Scale: 10px (label-up) · 11px (meta) · 12px (small) · 13px (body) · 14px (default) · 17px (card title) · 22px (page title) · 28px (KPI value)
- Large headings: `letter-spacing: -0.02em`. Uppercase labels: `letter-spacing: 0.06em`, `font-weight: 600`.
- Bundle the two fonts as local `woff2` under `public/fonts/` with `@font-face` for offline use — do NOT rely on the Google Fonts CDN in production.

### Color — Daylight (default theme)
| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(98% 0.005 80)` | Page background |
| `--bg-elev` | `#ffffff` | Cards, popovers |
| `--bg-subtle` | `oklch(96% 0.006 80)` | Table headers, soft surfaces |
| `--border` | `oklch(91% 0.006 80)` | Dividers, card borders |
| `--border-strong` | `oklch(86% 0.008 80)` | Hover borders |
| `--fg` | `oklch(22% 0.01 60)` | Primary text |
| `--fg-muted` | `oklch(50% 0.012 60)` | Secondary text |
| `--fg-faint` | `oklch(65% 0.01 60)` | Tertiary / placeholder |
| `--accent` | `oklch(62% 0.16 50)` | Primary action, active nav, brand |
| `--accent-hover` | `oklch(56% 0.17 50)` | Hover |
| `--accent-soft` | `oklch(94% 0.04 60)` | Pill bg, soft fills, selected row |
| `--accent-fg` | `oklch(35% 0.12 50)` | Text on `--accent-soft` |
| success / warning / danger / info | green 145° / amber 75° / red 25° / blue 240° families, each with `-soft` and `-fg` variants | status |
| `--neutral-soft` / `--neutral-fg` | gray | default pill, count badges |

### Color — Garage (optional dark theme)
Toggled by `[data-theme="garage"]` on `<html>`. Full override block in `styles.css`. **Keep it behind a settings toggle or strip it** — it's not required for v1, but the token structure makes it cheap to keep.

### Spacing / Radius / Shadow
- Space scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40px
- `--row-h`: 44px comfortable → 36px compact (`[data-density="compact"]`). Card pad 20→14px; cell pad `12px 14px`→`8px 12px`.
- Radius: 6px (chips/inputs) · 8px (buttons) · 10px · 14px (cards) · 999px (pills/avatars)
- Shadows are minimal: `--shadow-sm` on active nav/stat; `--shadow-md/-lg` only on modals + popovers. **Cards have no shadow by default** — border + radius only.

### Layout
- App grid: `grid-template-columns: 232px 1fr` (sidebar | main). Icon-only sidebar = 56px via `[data-sidebar="icon"]`.
- Topbar 56px, sticky: breadcrumb + search (opens ⌘K) + bell + page action.
- Content padding `24px 28px 40px`.

---

## Visual Language Rules

1. **No emoji, no decorative SVG illustrations.** Icons are 16/18px stroke SVG (1.6 width, round caps). Full set in `icons.jsx` — convert to an inline `<svg><symbol>` sprite in `index.html`, reference via `<use href="#icon-…">`.
2. **Mono on all technical/numeric data** (`.mono` class) + `font-variant-numeric: tabular-nums` (`.num`) on aligned number columns.
3. **Cards = `--bg-elev` + 1px `--border` + 14px radius, no shadow.**
4. **Border accents over fills:** active nav = 3px left accent bar; payment-plan cards = 3px colored left border; never a flooded background.
5. **Pills:** 6 semantic colors (gray/green/amber/red/blue/accent), optional 6px leading dot. Mapping below.
6. **Uniform table row:** strong primary cell + small muted secondary line beneath. See Jobs/Customers for the canonical pattern.
7. **Sidebar count badges are calm gray** (`--neutral-soft` / `--fg-muted`), not accent — they inform without shouting.

---

## Screens (18) — source of truth is each `screens/*.jsx`

| Screen | Prototype file | Notes |
|---|---|---|
| **Dashboard** | `screens/dashboard.jsx` | Greeting + day summary; 4 KPI cards (Active jobs, Revenue this week + sparkline, Outstanding, Net profit); **Today's route** stack (the priority card for a mobile mechanic); Action-needed (overdue invoices / low stock / estimates awaiting approval); Pipeline snapshot bars; Recent activity; Recent payments. |
| **Leads** | `screens/leads.jsx` | 6-column kanban (New→Lost) + table toggle; cards show service, vehicle, value, follow-up, Hot pill. |
| **Estimates** | `screens/estimates.jsx` | Master list + line-item builder (type pill / qty / rate / amount; subtotal-tax-total box; "Convert to job" on approved). Maps to `estimates` + `estimate_items`. |
| **Jobs** | `screens/jobs.jsx` | **Table + Board (Kanban) toggle.** Table has right-side detail panel: customer+vehicle mini-cards, complaint, charges breakdown, action row, **"Auto-text when en route" toggle**, status timeline. |
| **Schedule** | `screens/schedule.jsx` | Weekly grid (Sun–Sat × 7am–7pm), Day/Week/Month toggle, color-coded appointment blocks. |
| **Inspections** | `screens/inspection.jsx` | Vehicle + summary header (P/A/F/NA counts, health bar, 0–100 score); category cards; 4-state P/A/F/— toggle per item; **photo strip on Advisory/Fail items** (drop-zone + thumbs). |
| **Customers** | `screens/customers.jsx` | Table: avatar+name+joined, type pill, contact, vehicle/job counts, LTV, last service, tags. |
| **Customer detail** | `screens/customer.jsx` | Header card + embedded KPI strip (LTV/jobs/vehicles/last service); tabs; Overview = vehicle grid + recent jobs (left), interactions + reminders + notes (right). |
| **Vehicles** | `screens/vehicles.jsx` | Fleet-wide table + **Add-Vehicle modal with VIN decoder** (NHTSA vPIC). |
| **Parts & Inventory** | `screens/inventory.jsx` | KPI strip + table with margin %, stock bar, low-stock highlight, van location. |
| **Service Catalog** | `screens/catalog.jsx` | Reusable service templates table. |
| **Warranties** | `screens/warranties.jsx` | Coverage table (labor/parts months, mileage limit, expiry, status). |
| **Employees** | `screens/team.jsx` → `Employees` | Card grid: avatar, status, role, 3-stat footer. |
| **Time Tracking** | `screens/team.jsx` → `TimeTracking` | KPI strip + typed entries table (in-progress highlighted). |
| **Payments** | `screens/finance.jsx` → `Payments` | KPI strip + ledger + collected-by-method bars. |
| **Payment Plans** | `screens/finance.jsx` → `PaymentPlans` | Progress cards with 3px colored left border. |
| **Expenses** | `screens/finance.jsx` → `Expenses` | KPI strip + category-pill table, negative amounts in danger color. |
| **P&L Report** | `screens/report.jsx` | KPI strip + 5-month income/expense bars + category breakdown + full P&L statement. |
| **Settings** | `screens/settings.jsx` | Left-rail sections + form cards (business profile, branding, labor rates, invoicing, vehicle defaults, backup). Maps to the single `settings` row. |

---

## Kept new interactions (desktop-safe)

### ⌘K Command Palette — `command-palette.jsx`
- `Cmd/Ctrl+K` or click topbar search. Centered 560px modal, blurred backdrop.
- Filters across: 18 nav targets, quick actions, all customers, recent jobs.
- Keyboard: ↑↓ move, ↵ activate, Esc close. Active row gets accent icon tile.

### Jobs Kanban board — `screens/jobs.jsx` (`JobsBoard`)
- Toggle next to Table view. 6 columns by `jobs.status`. Cards show WO#, service, customer+vehicle, assignee, total. Per-column count + value subtotal. (Drag-to-restage is implied; wire to a `PATCH /api/jobs/:id { status }`.)

### VIN decoder — `screens/vehicles.jsx` (`AddVehicleModal`)
- Field for a 17-char VIN + "Decode" button. Calls the **free public NHTSA vPIC API** (`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/<VIN>?format=json`), maps results into the existing vehicle fields (year/make/model/trim/engine/transmission/fuel).
- **Offline-safe:** decode is convenience only; every field remains manually editable, and the modal works with no internet. This is the only outbound network call in the app — it degrades gracefully when offline.

### "Auto-text customer when en route" — `screens/jobs.jsx` (`NotifyCustomer`)
- iOS-style toggle in the job detail panel, persists to `jobs.notify_en_route`. Shows the templated preview message (built from `settings.business_name` / `owner_name`). Actually sending the SMS is optional (see below).

---

## Pills — semantic status mapping

| Domain | Status → pill |
|---|---|
| Job | Pending→gray · Confirmed→blue · En Route→amber · In Progress→accent · Waiting on Parts→amber · Complete→green · Canceled→red (all with dot) |
| Invoice | Paid→green · Unpaid→amber · Partial→blue · Voided→gray |
| Lead | New/Contacted→blue · Quoted→amber · Scheduled→accent · Won→green · Lost→red |
| Estimate | Draft→gray · Sent→blue · Approved→green · Declined→red · Expired→amber |
| Warranty | Active→green · Pending→amber · Expired→red · Voided→gray |
| Inspection item | Pass→green · Advisory→amber · Fail→red · N/A→gray (boxed P/A/F/— toggle) |
| Vehicle oil | OK→green · Oil soon (within `settings.oil_warn_miles`)→amber · Oil overdue→red |

---

## State Management (vanilla port)

Mirror the prototype's React state into the existing global pattern:

- `currentPage` via `sp(page)`, persisted to URL hash (`#/jobs`, `#/customer/3`).
- `selectedJobId` (jobs detail panel), `selectedCustomerId` (customer detail).
- Jobs view mode (table/board), Leads view mode (board/table) — local, optionally persisted.
- Inspection item conditions — live, persisted via the existing inspections route; photos via a new `POST /api/inspections/:id/items/:itemId/photos`.
- Command palette: open/query/index, reset on close.
- `notify_en_route` per job.
- Theme/density/sidebar: `data-*` attributes on `<html>` from localStorage (keep for QA; the **Tweaks panel in the prototype is design-only — strip it or gate behind `?tweaks=1`**, do not ship it).

All data continues to come from the existing routes: `/api/dashboard`, `/api/jobs`, `/api/customers`, `/api/vehicles`, `/api/leads`, `/api/estimates`, `/api/inventory`, `/api/catalog`, `/api/warranties`, `/api/employees`, `/api/time`, `/api/payments`, `/api/plans`, `/api/expenses`, `/api/settings`, `/api/crm`, `/api/inspections`, `/api/appointments`.

---

## Assets
- **Fonts:** Inter Tight + JetBrains Mono — bundle local `woff2`, no CDN.
- **Icons:** `icons.jsx` stroke set → inline `<symbol>` sprite.
- **Logo:** no raster. Sidebar mark = 26×26 rounded square, charcoal bg, 16px wrench glyph, accent diagonal stripe via `::after`. Recreate exactly.
- No photographs or raster images in the UI.

---

## Files in This Bundle
```
design_handoff_wrenchpro_redesign/
├── README.md                 ← this file
├── WrenchPro.html            ← prototype entry (open in a browser; no build step)
├── styles.css                ← all tokens + base styles (copy into <style>)
├── data.js, data2.js         ← realistic mock data (fixture/seed reference)
├── icons.jsx                 ← stroke icon set (→ inline SVG sprite)
├── atoms.jsx                 ← Pill, Avatar, Card, StatCard, Spark
├── shell.jsx                 ← Sidebar + Topbar
├── command-palette.jsx       ← ⌘K palette
├── app.jsx                   ← routing + (design-only) tweaks wiring
├── tweaks-panel.jsx          ← design-only; DO NOT ship
└── screens/
    ├── dashboard.jsx   jobs.jsx       schedule.jsx   inspection.jsx
    ├── customers.jsx   customer.jsx   leads.jsx      estimates.jsx
    ├── vehicles.jsx    inventory.jsx  catalog.jsx    warranties.jsx
    ├── team.jsx        finance.jsx    report.jsx     settings.jsx
```
(There is intentionally **no** portal, booking, or marketplace file — those were cut for the desktop-only scope.)

---

## Recommended Implementation Order
1. Tokens + fonts + app shell (sidebar + topbar + content) — match pixel layout first.
2. Atoms (Pill, Avatar, Card, StatCard, Spark, status-pill helpers).
3. Icon sprite.
4. Dashboard.
5. Jobs (table + detail panel + Kanban toggle + en-route toggle).
6. Table-based screens in a batch (Customers, Vehicles, Inventory, Catalog, Warranties, Payments, Expenses, Time Tracking) — they share one table pattern.
7. Schedule (custom weekly grid).
8. Inspection (P/A/F/NA toggle, live summary, photos → new table + disk storage).
9. Customer detail (tabs).
10. Leads kanban.
11. Estimates builder.
12. Payment Plans cards.
13. P&L Report (CSS flexbox bars, no chart lib).
14. Settings.
15. VIN decoder (NHTSA fetch into Add-Vehicle).
16. ⌘K command palette.

---

## Open Questions to Resolve
1. **En-route SMS:** wire `notify_en_route` to a real sender (Twilio/Telnyx, pay-per-message — no subscription, aligns with the moat) or leave the toggle as a UI-only preference for now? If wired, add an SMS-credentials section to Settings.
2. **Garage dark theme:** ship as a user setting, or strip for v1?
3. **WO numbers:** server-sequential (current) or user-editable?
4. **Inspection photo capture:** file-picker only (desktop), or also support a webcam capture via `getUserMedia`?
5. Confirm the **Tweaks panel** should be stripped from production (recommended) vs. gated behind `?tweaks=1`.
