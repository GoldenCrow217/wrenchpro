# WrenchPro Architecture Audit and SaaS Migration Plan

- **Date:** 2026-09-26
- **Scope:** entire repository at `main` (`6f74014`, v1.1.1) plus open PR #22 (Electron 44 / better-sqlite3 13)
- **Goal:** evolve WrenchPro into a multi-tenant SaaS: shop web app + technician mobile app + customer portal on one shared API and PostgreSQL, without breaking the desktop app that a real shop uses today.
- **Decisions:** recorded as ADRs in [`adr/`](adr/).

---

## 1. Findings that change the plan

| # | What we found | Why it matters | Recommendation | What changes |
|---|---|---|---|---|
| F1 | **WrenchPro already implements most of the requested business domain.** 40 tables, 105 API endpoints: estimates, repair orders, line items, authorizations (approve / decline / defer with method + typed signature), deferred work, inspections with templates, measurements, photos and recommendations, workflow board, bays/mobile units, parts, reservations, vendors, purchase orders, payments, allocations, refunds, credits, payment plans, time tracking, CRM, warranties. | Phases 5–10 are mostly **port and enhance**, not greenfield. Rebuilding from scratch would throw away hundreds of validated business rules and 24 QA suites. | Treat the Express API as the reference behaviour and move it behind a new API **incrementally** (strangler pattern). | The roadmap is shorter; phases 5–10 become "port screen + API module, then enhance". |
| F2 | **The backend is JavaScript on Node (Express), not Python.** | FastAPI would mean re-writing every business rule and test in a second language, and the web (Next.js) and mobile (Expo) clients are TypeScript. | **NestJS (TypeScript).** Nest runs on Express, so the existing routers can be mounted inside the Nest app while modules are ported one by one. See [ADR-0001](adr/0001-backend-nestjs-typescript.md). | No language change. One language across API, web, mobile, and shared packages. |
| F3 | **All data access is synchronous, inline SQLite SQL**: 538 `db.prepare(...)` calls spread across route files, with tenant filters concatenated per query. | PostgreSQL drivers are asynchronous and use a different SQL dialect. This, not the UI, is the biggest technical blocker to PostgreSQL. | Introduce a **repository layer** using **Kysely** (typed SQL builder that supports both SQLite and PostgreSQL), route by route, with tenant scoping built into the repository. See [ADR-0002](adr/0002-postgres-supabase-kysely.md). | Phase 1 builds the data-access layer before any PostgreSQL cut-over. |
| F4 | **Tenant isolation is opt-in (fail-open).** With no shop context, queries use `1=1` and see every row. Hosted mode is enabled only by an environment flag (`WRENCHPRO_REQUIRE_SHOP_MEMBERSHIP`). | Correct for the single-shop desktop app, dangerous for SaaS: one missing env var on a hosted deployment would expose every shop's data without login. | Fail closed. **Phase 0 (done in this change):** any request arriving through a hosted domain is refused unless membership enforcement is on. Phase 3: tenant context becomes mandatory in the repository layer, plus PostgreSQL row-level security as defense in depth. | Hosted exposure without auth is no longer possible by misconfiguration. |
| F5 | **Roles exist but are never enforced.** `shop_memberships.role` (owner / admin / mechanic / service_writer) is loaded but no route checks it. | Any authenticated member (e.g. a technician) could edit settings, payments, or delete records. | Server-side permission guards in Phase 3, mapping to OWNER / MANAGER / SERVICE_ADVISOR / TECHNICIAN. See [ADR-0004](adr/0004-auth-supabase-roles.md). | Phase 3 scope. |
| F6 | **Pricing math is duplicated in the browser.** `calculateEstimateTotals`, `jobPricingTotals`, and `markupForPartCost` in `public/index.html` are hand copies of `server/pricing.js`. They match today, but only by manual discipline. | Exactly what the brief forbids: a fix in one copy and not the other would make the screen disagree with the saved invoice. | One implementation. **Phase 0 (done in this change):** the browser loads the server's `pricing.js`; the copies are deleted. Later this module becomes `packages/business-logic`. Saved totals always come from the API; the shared module is used only for instant preview while typing. See [ADR-0005](adr/0005-single-source-business-logic.md). | Duplication removed now. |
| F7 | **Money is stored as floating point (`REAL`).** | Float cents drift in sums and reports. | PostgreSQL uses `numeric(12,2)`; rounding stays in the shared pricing module. | Part of the Phase 2 schema. |
| F8 | **No versioned migrations.** The schema is 40 `CREATE TABLE IF NOT EXISTS` plus 83 guarded `ALTER TABLE` statements run on every startup. | Works for SQLite, but can't describe the PostgreSQL schema history, review changes, or roll back. | Versioned migration files for PostgreSQL (Kysely migrator). The desktop SQLite schema stays as-is until the desktop app is retired. | Phase 2. |
| F9 | **No audit log.** | Repair shops need a trail of who approved, changed prices, took payments, or deleted records, especially with multiple employees and customer approvals. | `audit_log` table written by the API for sensitive actions. | Phase 3. |
| F10 | **Photos are stored as base64 inside the database** (inspections and check-in events). | Right for the offline desktop (single-file backups), wrong for SaaS (database bloat, no CDN, can't serve video). | SaaS stores media in object storage (Supabase Storage, private buckets, signed URLs); the importer moves existing photos there. | Phase 2 (importer) and Phase 8 (media). |
| F11 | **The existing Claude Design redesign is written in React** (`design_handoff_wrenchpro_redesign/*.jsx`). It was ported to vanilla JS only because the desktop app had no build step. | With Next.js, those prototype components are a head start for the web app's design system. | Build `apps/web` from the handoff's React components and tokens. | Phase 4 is faster; the visual design is already decided. |
| F12 | **A real shop uses the desktop app today** (v1.1.1, offline, with automatic backups). | The migration must never strand their data or break their daily work. | Desktop stays supported (maintenance only) until the web app reaches parity for their workflow. Their data moves with an **importer that reads a WrenchPro backup file** (the same `.db` files the app already makes daily). See [ADR-0006](adr/0006-desktop-transition.md). | Adds an importer to Phase 2 and a cut-over step for the existing user. |

---

## 2. Current architecture

```
┌──────────────────────────── Electron (desktop shell) ─────────────────────────────┐
│ electron/main.js                                                                 │
│  • finds a free port, requires server/index.js IN-PROCESS                        │
│  • BrowserWindow (sandbox, contextIsolation) → http://127.0.0.1:<port>          │
│  • preload.js: print/PDF, backup actions, menu commands (no paths cross IPC)    │
│  • electron/backup.js: daily verified SQLite backups, restore w/ safety copy    │
│  • electron-updater → GitHub Releases                                            │
│                                                                                  │
│   ┌──────────── Express 4 (CommonJS JavaScript) ─────────────┐                   │
│   │ server/index.js  Host allowlist, CORS, CSP, JSON limits, │                   │
│   │                  id validation, /api/dashboard           │                   │
│   │ server/tenant.js shop context, Supabase JWT (HS256),     │                   │
│   │                  membership + plan-status checks          │                   │
│   │ server/routes/*  20 routers, 105 endpoints,               │                   │
│   │                  538 synchronous inline SQL statements    │                   │
│   │ server/pricing.js, line-items.js, job-finance.js,         │                   │
│   │ financial-report.js, validation.js (pure logic)           │                   │
│   └──────────────────────────┬────────────────────────────────┘                   │
│                              │ better-sqlite3 (sync)                             │
│                    wrenchpro.db (SQLite, WAL) in %APPDATA%\WrenchPro              │
│                                                                                  │
│   public/index.html: 6,500-line single file: CSS + JS, global `state`,           │
│   239 inline onclick handlers, innerHTML templates escaped via esc()             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- **Languages:** JavaScript (Node 24, CommonJS), HTML/CSS, PowerShell (release script).
- **Frameworks:** Electron 39 (PR #22 → 44), Express 4, better-sqlite3 12 (PR #22 → 13), electron-builder, electron-updater. No frontend framework and no build step.
- **Storage:** one SQLite file per installation; photos embedded as base64 data URLs; settings in a `settings` row (global) or `shop_settings` (per hosted shop).
- **Hosted groundwork:** `shops`, `shop_memberships`, plan/trial status, `shop_id` on major tables, Supabase JWT verification, and a frontend "shop context" bootstrap that expects an outer shell to supply the token. There is **no sign-in UI and no hosted deployment**.
- **Tests:** 24 QA scripts (HTTP integration against a real server with temp data, Electron renderer, rendering-security, packaging) run by `npm run test:all` in CI on every PR and before every release.

## 3. Current features (working)

| Area | What works today |
|---|---|
| Pipeline | Leads (status board, convert to customer); estimates with typed line items (labor, parts, fees, diagnostic, sublet, emergency, discount lines), parts-only tax, markup tiers, expiration, approval, convert to repair order, print/PDF |
| Repair orders | Complaint → diagnosis → service-line authorization (approve / decline / defer, method, typed signature) → tasks → labor/parts → invoice status; customizable workflow board; bays and mobile units; vehicle check-in/out records (mileage, fuel, keys, warning lights, damage, road test, photo) |
| Deferred work | Declined/deferred services are kept (`deferred_services`) |
| Scheduling | Month calendar, recurring appointments, job overlay, bay/mobile-unit conflict checks |
| Inspections | Templates, pass/advisory/fail/N/A, brake/rotor/tire measurements, quick notes, recommendations, photos (resized on upload), printable reports |
| Customers & CRM | Customer types, tags, addresses, interactions, follow-ups, service reminders, lifetime value, history |
| Vehicles | Full vehicle fields, VIN, plate, mileage, oil-due tracking |
| Parts | Inventory, reorder levels, reservations, vendors, purchase orders with receiving |
| Canned jobs (basic) | Service catalog with default hours, price, category, taxable flag, description |
| Warranties | Labor/parts months, mileage limit, expiry, status, linked to jobs |
| Team | Employees, pay rates, time tracking by job and type |
| Money | Payments (6 methods), partial payments, deposits, refunds, customer credits, allocations, statements; payment plans with installments and late fees; expenses; P&L; dashboard KPIs |
| Platform | Offline desktop app, auto-update, daily verified backups + restore, printing/PDF, ⌘K command palette, Claude Design visual system, security hardening (Host allowlist, CSP, sandbox) |

## 4. Partially implemented

- **Hosted/SaaS mode:** backend tenant + auth checks exist; no sign-in/sign-up UI, no deployment, no role enforcement, HS256 shared-secret JWT verification (Supabase now recommends asymmetric signing keys verified via JWKS).
- **Canned jobs:** templates carry labor and price but not default parts, fees, or inspection requirements.
- **Invoices:** an `invoice_status` on the repair order plus printouts; no separate invoice record, invoice numbering, or immutable issued invoice.
- **Customer approvals:** recorded by staff (method + typed signature); customers can't approve themselves (no portal, no links).
- **"Notify customer en route":** database column exists, no UI or messaging.
- **Menu items** "Export Data", "Run Data Integrity Check", "Open Logs" are disabled placeholders.

## 5. Feature gaps (vs. the target product)

User accounts and sign-in; enforced roles and permissions; audit log; customer portal with expiring links (estimate/inspection review, approve/decline, invoice, payment); SMS/email notifications; online payments; separate invoice entity with numbering; canned jobs with parts; inspection → estimate conversion as a first-class action; media storage for photos/video and voice notes; technician mobile workflow; dispatch, maps, routing, service-area pricing; VIN decoding; data export; reporting beyond P&L; AI documentation assistance; multi-shop administration.

---

## 6. KEEP / REFACTOR / REPLACE / MISSING

### KEEP (mostly intact, becomes the reference behaviour)
| Item | Why |
|---|---|
| `server/pricing.js`, `line-items.js`, `job-finance.js`, `financial-report.js`, `business-date.js` | Pure, tested business rules (cent rounding, parts-only tax, discount allocation, markup tiers, invoice reconciliation). Move into `packages/business-logic` as TypeScript with the same tests. |
| `server/validation.js` rules | Validation semantics carry over (re-expressed as Zod schemas shared with clients). |
| The domain model (40 tables) | Already matches the brief's entities closely (see §8); it becomes the PostgreSQL schema with type fixes. |
| QA suites (`scripts/*-qa.js`) | 24 behaviour specifications. HTTP suites become **contract tests** run against both the legacy and new API during porting. |
| Security middleware ideas | Host allowlist, CSP, no-store API caching, id validation, JSON limits, rendering escape discipline. |
| Claude Design system (tokens, icons, React prototype components) | Foundation of the web app UI. |
| Desktop app + backup/restore | Serves the current customer until cut-over; its backup files are the migration source. |
| CI (`test:all` on PRs and releases) | Extend to the monorepo. |

### REFACTOR (useful, needs reorganizing)
| Item | Refactor into |
|---|---|
| `server/routes/*.js` (105 endpoints) | NestJS modules (controller → service → repository) ported one at a time; business rules stay in services, SQL moves to repositories. |
| 538 inline SQL statements | Kysely repositories with mandatory tenant scope. |
| `server/tenant.js` | Nest auth guard + tenant context (fail-closed), JWKS verification, role guard. |
| `server/database.js` schema | Versioned PostgreSQL migrations (types: `numeric`, `date`/`timestamptz`, `boolean`, `jsonb`, `NOT NULL shop_id`). |
| `shop_memberships` roles | OWNER / MANAGER / SERVICE_ADVISOR / TECHNICIAN (+ permission map). |
| Service catalog + inspection templates | Canned jobs with default parts, fees, inspection requirements. |
| `invoice_status` on jobs | First-class invoices (numbered, issued, immutable once sent). |

### REPLACE (will cause long-term problems)
| Item | Replace with | When |
|---|---|---|
| `public/index.html` monolith (6,500 lines, inline handlers, global state) | Next.js + React + TypeScript (`apps/web`) | Screen by screen from Phase 4; the desktop keeps the old UI until retired |
| Synchronous SQLite as the SaaS database | PostgreSQL (Supabase) | Phase 2 |
| Base64 photos in the database (SaaS only) | Object storage + signed URLs | Phase 2 importer / Phase 8 |
| Fail-open tenancy | Fail-closed tenant context + RLS | Guard now (Phase 0), full in Phase 3 |
| HS256 shared-secret JWT verification | JWKS (asymmetric) verification | Phase 3 |
| Floating-point money columns | `numeric(12,2)` | Phase 2 |

### MISSING (required for web/mobile SaaS)
Monorepo tooling (npm workspaces); `apps/api` (NestJS); `apps/web` (Next.js); `apps/mobile` (Expo, later); shared `packages/` (types, validation, business-logic, api-client); PostgreSQL schema + migrations + seeds; SQLite → PostgreSQL importer; sign-in/sign-up/invite flows; role/permission guards; audit log; object storage; OpenAPI spec + generated client; hosting + environments (dev / staging / prod), secrets management, error logging/monitoring; customer portal token service; messaging (SMS/email) service; background jobs (reminders, notifications); rate limiting on public endpoints.

---

## 7. Proposed architecture

```
                 ┌───────────────┐  ┌──────────────────┐  ┌──────────────────────┐
                 │  apps/web     │  │  apps/mobile     │  │  Customer portal     │
                 │  Next.js (PWA)│  │  Expo (iOS/And.) │  │  (route group in web,│
                 │  shop staff   │  │  technicians     │  │  expiring links)     │
                 └──────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘
                        │     packages/api-client (generated from OpenAPI)      │
                        └────────────────────┼───────────────────────────────────┘
                                             ▼
                 ┌────────────────────────────────────────────────────────────┐
                 │ apps/api: NestJS (TypeScript)                              │
                 │  auth guard (Supabase JWT via JWKS) → tenant context →     │
                 │  role/permission guard → controllers → services            │
                 │  services use packages/business-logic (single source)      │
                 │  repositories (Kysely) always scoped by shop_id            │
                 │  audit log · notifications · portal tokens · media         │
                 │  [legacy Express routers mounted during migration]         │
                 └──────────────┬─────────────────────────┬───────────────────┘
                                ▼                         ▼
                 ┌──────────────────────────┐  ┌──────────────────────────┐
                 │ PostgreSQL (Supabase)    │  │ Object storage (Supabase)│
                 │ shop_id NOT NULL + RLS   │  │ photos, video, voice     │
                 └──────────────────────────┘  └──────────────────────────┘

  Desktop (Electron + Express + SQLite) continues unchanged for the existing shop
  until cut-over; its backup files feed the SQLite → PostgreSQL importer.
```

**Calculation rule:** the API computes every official number (line totals, tax, discounts, invoice totals, balances) and returns it. Clients render what the API returns. The same `packages/business-logic` code may run in the browser only for an instant preview while a user types; it is never saved as-is.

## 8. Entity mapping (current → target)

| Target entity | Current table(s) | Notes |
|---|---|---|
| Shop, User, Role | `shops`, `shop_memberships` | Add `users` (Supabase auth id), role enum, invites |
| Customer, Vehicle | `customers`, `vehicles` | Keep; `shop_id NOT NULL` |
| Appointment | `appointments` | Add location fields for dispatch later |
| RepairOrder, Job, LaborItem, PartItem | `jobs`, `job_items`, `job_tasks` | `jobs` = repair order; items typed labor/part/fee/sublet/discount |
| Estimate, EstimateItem | `estimates`, `estimate_items` | Keep |
| Customer approval | `service_authorizations` | Add portal-link approvals (token, IP, timestamp, signature) |
| DeferredService | `deferred_services` | Keep; add follow-up/reminder |
| Inspection, InspectionItem | `inspections`, `inspection_items`, `inspection_templates*` | Map pass/advisory/fail → GREEN/YELLOW/RED; add customer-facing note, link to estimate item |
| Media | `inspection_photos`, `vehicle_service_events.photos` | Becomes `media` rows pointing to object storage |
| Invoice | (status on `jobs`) | **New** table with numbering |
| Payment | `payments`, `payment_allocations`, `payment_plans`, `installments` | Keep |
| Technician, TechnicianAssignment | `employees`, `jobs.employee_id` | Link employee ↔ user; many-to-many assignments |
| TimeEntry | `time_logs` | Keep |
| InventoryItem | `parts_inventory`, `inventory_reservations`, `vendors`, `purchase_orders*` | Keep |
| Warranty | `warranties` | Keep |
| CannedJob | `service_catalog` | Extend with parts, fees, inspection requirements |
| Message, Notification | `customer_interactions`, `follow_ups`, `service_reminders` | Add outbound message log + notification queue |
| AuditLog | (none) | **New** |

## 9. Proposed folder structure

```
wrenchpro/                     (this repo, converted to npm workspaces)
├── apps/
│   ├── desktop/               ← current electron/, server/, public/ (moved in Phase 1, no behaviour change)
│   ├── api/                   NestJS (Phase 1)
│   ├── web/                   Next.js (Phase 4)
│   └── mobile/                Expo (Phase 12)
├── packages/
│   ├── business-logic/        pricing, line items, job finance, reports (from server/*.js)
│   ├── validation/            Zod schemas shared by api/web/mobile
│   ├── types/                 shared domain types
│   ├── api-client/            generated from the API's OpenAPI spec
│   └── ui/                    design tokens + components from the Claude Design handoff
├── database/
│   ├── migrations/            PostgreSQL migrations (Kysely)
│   ├── seeds/
│   └── importer/              SQLite backup → PostgreSQL
├── docs/                      incl. architecture/ (this audit, ADRs)
└── scripts/                   QA/contract tests
```

**Why a monorepo in this repo (not a new repo):** the business logic, tests, and data model being ported live here; keeping one repo lets contract tests run the old and new API side by side, and lets the desktop and SaaS share `packages/business-logic`. The move of existing code into `apps/desktop` is a pure relocation done in its own PR (release workflow and electron-builder paths updated, verified by the full QA suite and an installer build).

## 10. Database migration plan (SQLite → PostgreSQL)

1. **Schema:** write PostgreSQL migrations mirroring the 40 SQLite tables with corrected types (`numeric(12,2)` money; `date`/`timestamptz`; `boolean`; `jsonb` for JSON-in-TEXT such as checklists and markup tiers), `shop_id NOT NULL` on every tenant table, foreign keys, indexes, and a `legacy_id` column on imported tables for traceability.
2. **Importer (`database/importer`):** input is a **WrenchPro backup file** (validated with the existing backup inspection). Creates the shop, imports rows parent-first inside one transaction, maps old ids → new ids, uploads base64 photos to object storage and stores `media` rows, converts types, and records an import report.
3. **Verification:** row counts per table and **financial reconciliation**: total revenue, received, outstanding, and per-job balances computed from the source and target must match to the cent, using the same business-logic code. The import fails if anything differs.
4. **Dry runs:** run against copies of real backups (with the shop owner's permission) until clean, then a scheduled cut-over: final backup → import → owner verifies → desktop set to read-only/archive mode.
5. **No data loss:** the source backup file is never modified, and the desktop keeps its own backups.

## 11. Development roadmap (adjusted to what exists)

| Phase | Goal | Notes |
|---|---|---|
| **0: Audit & stabilize** | This audit; ADRs; remove duplicated pricing; fail-closed hosted guard; Electron 44 (PR #22) | **In progress** (this PR) |
| **1: API foundation** | npm workspaces; move desktop into `apps/desktop`; `packages/business-logic` (TypeScript + tests); `apps/api` NestJS skeleton with health, config, logging, error handling, OpenAPI; legacy routers mounted; HTTP QA suites runnable as contract tests against either server | No behaviour change for the desktop |
| **2: PostgreSQL** | Supabase project (dev/staging); migrations; Kysely repositories; importer + reconciliation | Port read paths first, then writes, module by module |
| **3: Auth, tenants, roles** | Sign-up/sign-in/invite; JWKS verification; mandatory tenant context; RLS; role guards; audit log | Security-reviewed before any real shop data goes hosted |
| **4: Web app foundation** | Next.js shell, design system from the handoff, auth screens, dashboard | Uses generated API client |
| **5–10: Port + enhance** | Customers/vehicles → scheduling → estimates/ROs → inspections (+media storage, inspection→estimate) → invoices (first-class) + payments → technician workflow | Each module ships when its contract tests pass on the new API |
| **Cut-over** | Migrate the existing desktop shop with the importer | When their daily workflow is covered on web |
| **11: PWA** | Installable, offline-tolerant web app | |
| **12: Expo mobile** | Technician "Today's jobs → inspection → photos → complete" | Camera, push later |
| **13: Customer portal** | Expiring links: estimate/inspection review, approve/decline, invoice, payment | Needs messaging + payments decisions |
| **14: Dispatch & routing** | Service-area pricing, maps, routing | |
| **15: AI assistance** | Voice note → structured finding, note rewriting, summaries (always editable) | |
| **16: Reporting & integrations** | Accounting export, parts suppliers, advanced reports | |

## 12. Decisions needed from the owner (later, not blocking Phase 0–1)

| Decision | Needed by | Options / default |
|---|---|---|
| ~~Hosting and monthly cost~~ | Decided | Supabase + Vercel + Render, see [ADR-0007](adr/0007-hosting-supabase-vercel-render.md). |
| When to move the existing shop to the web app | Before cut-over | Default: when their daily workflow is covered and they agree. |
| SMS/email provider and who pays | Phase 13 | Twilio/Telnyx for SMS, Resend/Postmark for email; pay-per-message. |
| Online payments provider | Phase 9/13 | Stripe (card fees per transaction). |
| Pricing/billing model | Before first paying hosted shop | |
