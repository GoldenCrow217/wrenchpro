# Architecture Decision Records

Short records of significant technical decisions: context, decision, consequences. Add a new numbered file for each decision; supersede rather than rewrite old ones.

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-backend-nestjs-typescript.md) | Backend: NestJS + TypeScript, ported incrementally from Express | Accepted |
| [0002](0002-postgres-supabase-kysely.md) | Database: PostgreSQL on Supabase, Kysely for data access, versioned migrations | Accepted |
| [0003](0003-monorepo-npm-workspaces.md) | Monorepo in this repository with npm workspaces | Accepted |
| [0004](0004-auth-supabase-roles.md) | Auth: Supabase Auth (JWKS), fail-closed tenant context, server-side roles | Accepted |
| [0005](0005-single-source-business-logic.md) | One implementation of business calculations; API is authoritative | Accepted |
| [0006](0006-desktop-transition.md) | Desktop app stays supported until the existing shop is migrated by importer | Accepted |
| [0007](0007-hosting-supabase-vercel-render.md) | Hosting: Supabase (data/auth/storage), Vercel (web), Render (API) | Accepted |
