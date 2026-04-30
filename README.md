# WrenchPro

WrenchPro is a desktop business manager for mobile mechanics and small mechanic operations. It runs fully offline — no subscription, no cloud, no account required.

Current status: **private beta**.

---

## Features

### Pipeline
| Feature | Description |
|---|---|
| **Leads** | Track prospects by source and status (New → Contacted → Quoted → Scheduled → Won/Lost). Convert to customer with one click. |
| **Estimates / Quotes** | Line-item builder with labor, parts, fees, diagnostic, and sublet types. Discount, tax, expiration date, PDF print, and one-click convert to work order. |

### Operations
| Feature | Description |
|---|---|
| **Jobs / Work Orders** | Customer complaint → diagnosis → approved services → labor/parts → 7 status levels (Pending, Confirmed, En Route, In Progress, Waiting on Parts, Done, Canceled) → invoice status. |
| **Schedule** | Monthly calendar with appointments and job overlay. |
| **Inspections** | 50-item vehicle checklist across 10 categories. Each item rated Pass / Advisory / Fail / N/A. |
| **Quick Entry** | Enter a historical job in one shot — auto-creates customer and vehicle if they don't exist. |

### Customers & Vehicles
| Feature | Description |
|---|---|
| **Customers** | Name, phone, email, service address, billing address, customer type (Personal/Fleet/Dealership/Commercial), preferred contact, status, tags. |
| **CRM** | Interaction log (call, text, email, visit, note), follow-up reminders, service reminders, overdue alerts. Customer lifetime value and job history. |
| **Vehicles** | Year, make, model, trim, engine, fuel type, transmission, VIN, plate, mileage, next oil change. Oil-soon and oil-overdue badges. |

### Resources
| Feature | Description |
|---|---|
| **Parts / Inventory** | Name, part number, vendor, cost, retail price, quantity on hand, reorder level, location. Low-stock row highlighting and dashboard alert. |
| **Service Catalog** | Reusable service templates with default hours, price, category, and taxable flag. Available in the estimate builder. |
| **Warranties** | Labor and parts warranty periods, mileage limits, expiration dates, and status (Active/Expired/Voided) — linked per job. |

### Team
| Feature | Description |
|---|---|
| **Employees** | Role, pay rate, assigned jobs, total labor revenue. |
| **Time Tracking** | Clock in/out entries by employee, job, and type (general, travel, diagnostic, repair, admin). Duration and estimated labor cost summary. |

### Finance
| Feature | Description |
|---|---|
| **Payments** | Cash, card, Venmo, CashApp, Check, Zelle. Partial payments, deposits, tips. |
| **Payment Plans** | Fixed installments or custom amounts. Overdue tracking, auto-log payment on mark-paid. |
| **Expenses** | Categorized expense log (parts, fuel, tools, insurance, marketing, other). |
| **P&L Report** | Income vs. expenses by period. Export as plain-text report for accountant. |

### Settings
- Business name, logo, phone, email, address, website, business hours, service area
- Standard labor rate, diagnostic rate, fleet rate, emergency/after-hours rate, mobile service fee
- Tax rate, currency symbol, payment terms, invoice footer
- Oil change warning threshold
- Warranty terms, estimate terms

---

## Technology

| Layer | Stack |
|---|---|
| Desktop shell | Electron 29 |
| Backend | Node.js · Express |
| Database | SQLite via `better-sqlite3` |
| Frontend | Vanilla HTML/CSS/JS — single file, no build step |
| Auto-update | `electron-updater` → GitHub Releases |
| CI/CD | GitHub Actions → `electron-builder` |

---

## Development Setup

**Requirements:** Node.js 20 (matches CI and Electron's bundled Node)

```bash
git clone https://github.com/GoldenCrow217/wrenchpro.git
cd wrenchpro
npm install
```

### Run in browser (Express only)
```bash
npm start
# Open http://localhost:3000
```

### Run as Electron app
```bash
npm run electron:dev
```

---

## Scripts

```bash
npm start              # Start local Express server (port 3000)
npm run dev            # Start server with nodemon (auto-restart on changes)
npm run electron:dev   # Launch Electron app in dev mode
npm test               # Run smoke test (alias for npm run smoke)
npm run smoke          # Start server, hit /api/dashboard, verify 200
npm run qa:api         # Full API workflow: lead → customer → estimate → job
npm run electron:build # Build Windows installer → dist/
npm run rebuild-native # Rebuild better-sqlite3 for Electron packaging
npm run rebuild-node   # Rebuild better-sqlite3 for local Node (run after electron:build breaks npm start)
```

> **Note:** `npm run electron:build` rebuilds native modules for Electron's Node ABI. If `npm start` or `npm test` fails with a `better-sqlite3` ABI mismatch afterward, run `npm run rebuild-node` to restore local dev.

---

## Building a Release

### Manual (local)
```bash
# 1. Bump version in package.json
# 2. Rebuild and build
npm run rebuild-native
GH_TOKEN=your_token npm run electron:build
# Installer is created at dist/WrenchPro Setup x.x.x.exe
```

### Automated (CI — recommended)

Pushing a `v*` tag triggers `.github/workflows/release.yml`, which:
1. Installs dependencies (`npm ci`)
2. Runs the smoke test (`npm test`)
3. Rebuilds native modules for Electron
4. Builds the Windows installer via `electron-builder`
5. Publishes the installer and `latest.yml` as a GitHub Release

```bash
# Bump "version" in package.json, commit, then:
git tag v1.x.x
git push origin main
git push origin v1.x.x
```

**Required repo secret:** `GH_TOKEN` with `repo` + `workflow` scopes  
→ `Settings → Secrets and variables → Actions → New repository secret`

After the release is published, installed apps detect the update within 8 seconds of next launch and prompt the user to restart.

---

## Auto-Update Behaviour

The installed app uses `electron-updater` to check GitHub Releases on startup:

1. **8 seconds after launch** — silent background check
2. **Update available** — dialog notifies the user, download begins automatically
3. **Download complete** — user is prompted to **Restart Now** or **Later**
4. **On restart** — new version installs and launches

Manual check: **Help → Check for Updates**

---

## Data Storage

All data is stored locally in SQLite. No account or internet connection required for normal use.

| Environment | Database path |
|---|---|
| Installed (Electron) | `%APPDATA%\wrenchpro\wrenchpro.db` (Windows) |
| Development | `wrenchpro.db` in project root |

Migrations run automatically on startup — no manual SQL required and existing data is never lost on upgrade.

**Before real business use, confirm:**
- Active database location
- Backup process (copy the `.db` file)
- Restore process
- Data persistence across reinstalls

See `INSTALL_AND_BACKUP_GUIDE.md` and `RELEASE_CHECKLIST.md`.

---

## Project Structure

```
wrenchpro/
├── .github/
│   └── workflows/
│       └── release.yml      # CI: build + publish on v* tag push
├── electron/
│   ├── main.js              # App entry, window, auto-updater, menu
│   └── preload.js           # Context bridge (exposes version/platform)
├── server/
│   ├── index.js             # Express app, route registration, dashboard API
│   ├── database.js          # SQLite schema, migrations
│   └── routes/
│       ├── customers.js
│       ├── vehicles.js
│       ├── jobs.js
│       ├── estimates.js
│       ├── inspections.js
│       ├── inventory.js
│       ├── catalog.js
│       ├── warranties.js
│       ├── leads.js
│       ├── time.js
│       ├── payments.js
│       ├── plans.js
│       ├── expenses.js
│       ├── employees.js
│       ├── appointments.js
│       ├── settings.js
│       └── crm.js
├── public/
│   └── index.html           # Entire frontend (HTML + CSS + JS, no build step)
├── scripts/
│   ├── smoke.js             # Startup smoke test
│   └── api-qa.js            # API workflow QA
└── package.json
```

---

## Operating Docs

Internal workflow and product docs in this repo:

- `PROJECT_COMMAND_CENTER.md`
- `COMPANY_OPERATING_MODEL.md`
- `ROADMAP.md`
- `KNOWN_ISSUES.md`
- `TESTING_CHECKLIST.md`
- `RELEASE_CHECKLIST.md`
- `INSTALL_AND_BACKUP_GUIDE.md`

---

## Release Policy

Do not publish releases, push tags, or distribute builds without Brandon's approval.

Release candidates must pass at minimum:

```bash
npm test
npm run qa:api
npm run electron:build
```

---

## License

UNLICENSED — proprietary. All rights reserved.
