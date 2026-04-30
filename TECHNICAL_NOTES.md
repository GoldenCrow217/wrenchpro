# WrenchPro Technical Notes

## Stack

Known from current repo:

- Electron desktop app
- Express backend
- SQLite via `better-sqlite3`
- Static frontend in `public/index.html`
- Installer/build via `electron-builder`

## Important Commands

From `package.json`:

```bash
npm start
npm run dev
npm run electron:dev
npm run electron:build
npm run electron:build:mac
npm run electron:build:linux
npm run rebuild-native
```

## Repo Notes

- Main app entry: `electron/main.js`
- Backend entry: `server/index.js`
- Database setup: `server/database.js`
- Routes: `server/routes/`
- Frontend: `public/index.html`
- Build output: `dist/`

## Current Development State Notes

As of initial workflow setup, the repo had active uncommitted changes in multiple backend routes and frontend files. Treat this as an active development workspace and inspect Git status before making changes.

## Technical Guardrails

- Do not delete or reset the database without approval.
- Before database schema changes, inspect existing schema and migration needs.
- Prefer backwards-compatible schema changes.
- Keep route changes focused.
- Avoid large frontend rewrites unless needed.
- Run at least a smoke test before claiming a fix is complete.

## Future Technical Improvements To Consider

- Split the large frontend file into smaller modules.
- Add automated API tests.
- Add database backup/export feature.
- Add sample/test database mode.
- Add structured logging.
- Add error boundary/user-friendly error messages.
