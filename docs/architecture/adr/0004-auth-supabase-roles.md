# ADR-0004: Supabase Auth, fail-closed tenant context, server-side roles

- Status: Accepted (2026-09-26)

## Context

`server/tenant.js` verifies Supabase JWTs with the legacy HS256 shared secret and checks shop membership, but tenancy is opt-in (no shop context means all rows) and roles are never enforced.

## Decision

- **Supabase Auth** for sign-in. The API verifies access tokens with the project's **JWKS** (asymmetric keys), checking issuer, audience, and expiry.
- **Tenant context is mandatory** in hosted mode and resolved only from verified membership; repositories refuse to run without it. PostgreSQL row-level security adds a second layer.
- **Roles:** OWNER, MANAGER, SERVICE_ADVISOR, TECHNICIAN (CUSTOMER later, for the portal), mapped from today's owner / admin / service_writer / mechanic. Permissions are enforced by API guards, never only by hiding UI.
- **Phase 0 guard:** requests that arrive through a hosted domain are refused unless membership enforcement is enabled, so a misconfigured deployment fails closed.

## Consequences

Customer-portal access uses separate short-lived, single-purpose signed links, not user accounts.
