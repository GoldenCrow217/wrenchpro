# ADR-0006: Desktop stays supported until the existing shop is migrated by importer

- Status: Accepted (2026-09-26)

## Context

A real shop runs the offline desktop app (v1.1.x) daily, with automatic verified backups.

## Decision

- The desktop app remains supported in **maintenance mode** (security and bug fixes) during the SaaS build.
- The shop moves to the hosted product with a **SQLite → PostgreSQL importer whose input is a WrenchPro backup file**, verified by row counts and cent-exact financial reconciliation.
- Cut-over happens when the web app covers the shop's daily workflow and the owner agrees. Afterwards the desktop can be kept read-only as an archive.

## Consequences

No forced migration and no data loss. The desktop and SaaS share `packages/business-logic`, so both compute money the same way during the overlap.
