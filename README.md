# WrenchPro

WrenchPro is a desktop business manager for mobile mechanics and small mechanic operations.

Current status: **early/internal alpha moving toward private beta**.

## What WrenchPro Helps Manage

- Customers
- Vehicles
- Leads
- Estimates / quotes
- Jobs / work orders
- Appointments
- Inspections
- Parts / inventory
- Payments and expenses
- Warranties
- CRM follow-ups and service reminders
- Basic business settings and reporting

## Tech Stack

- Electron desktop app
- Express local backend
- SQLite database through `better-sqlite3`
- Static frontend in `public/index.html`
- Windows installer through `electron-builder`

## Development Setup

Recommended: use Node 20 for development/release parity with GitHub Actions.

```bash
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

## Useful Scripts

```bash
npm start              # Start local Express server
npm run dev            # Start server with nodemon
npm run electron:dev   # Start Electron app locally
npm run smoke          # Start server with temp data and check /api/dashboard
npm test               # Alias for smoke test
npm run qa:api         # API workflow QA: lead -> customer/vehicle -> estimate -> job
npm run rebuild-node   # Rebuild better-sqlite3 for local Node after Electron builds
npm run electron:build # Build Windows installer
npm run rebuild-native # Rebuild native deps for Electron packaging
```

## Data Safety

WrenchPro stores business data locally in SQLite.

Before real business use, confirm:

- active database location
- backup process
- restore process
- update/reinstall data persistence

See `INSTALL_AND_BACKUP_GUIDE.md` and `RELEASE_CHECKLIST.md`.

## Project Operating Docs

This repo includes internal company/product workflow docs:

- `PROJECT_COMMAND_CENTER.md`
- `COMPANY_OPERATING_MODEL.md`
- `COMPANY_AGENT_ORG.md`
- `AUTONOMOUS_OPERATING_RULES.md`
- `ROADMAP.md`
- `KNOWN_ISSUES.md`
- `TESTING_CHECKLIST.md`
- `RELEASE_CHECKLIST.md`

## Release Policy

Do not publish releases, push tags, or distribute builds without Brandon approval.

Release candidates should pass at minimum:

```bash
npm test
npm run qa:api
npm run electron:build
```

Note: `npm run electron:build` may rebuild native modules for Electron. If local `npm start`, `npm test`, or `npm run qa:api` fails afterward with a `better-sqlite3` Node ABI mismatch, run:

```bash
npm run rebuild-node
```

## License

UNLICENSED / proprietary unless Brandon chooses a public license later.
