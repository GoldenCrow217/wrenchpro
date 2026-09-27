# ADR-0002: PostgreSQL on Supabase, Kysely for data access, versioned migrations

- Status: Accepted (2026-09-26)

## Context

All data access today is 538 synchronous, inline SQLite statements. PostgreSQL drivers are asynchronous and the SQL dialect differs. A Supabase project already exists (see `.env`), and Supabase provides PostgreSQL, auth, and object storage as one managed service.

## Decision

- **PostgreSQL on Supabase** for hosted data; Supabase Storage for media.
- **Kysely** (typed SQL builder) for repositories. It supports both SQLite and PostgreSQL, so repositories can be introduced and tested against today's SQLite before the PostgreSQL switch, and it keeps SQL explicit (close to the existing code) instead of hiding it behind an ORM.
- **Versioned migrations** (Kysely migrator) for PostgreSQL: money as `numeric(12,2)`; real `date`/`timestamptz`/`boolean`/`jsonb` types; `shop_id NOT NULL` on tenant tables; row-level security as defense in depth.

## Alternatives considered

- **Prisma:** strong tooling, but schema-first code generation and weaker SQLite↔PostgreSQL parity make an incremental port of hand-written SQL harder.
- **Drizzle:** a good option, but its dialect-specific schema definitions make the dual-dialect transition clumsier than Kysely.
- **Self-hosted PostgreSQL:** more operational work (backups, auth, storage) for a small team.

## Consequences

The API talks to the database only through repositories that require a tenant context. The desktop keeps SQLite until it is retired.
