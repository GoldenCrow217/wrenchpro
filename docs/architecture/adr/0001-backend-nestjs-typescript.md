# ADR-0001: Backend is NestJS + TypeScript, ported incrementally from Express

- Status: Accepted (2026-09-26)

## Context

The brief allows FastAPI or NestJS. The existing backend is Node/Express JavaScript: 20 routers, 105 endpoints, pure business modules (`server/pricing.js` etc.), and 24 QA suites that encode shop behaviour. The web (Next.js) and mobile (Expo) clients will be TypeScript.

## Decision

Use **NestJS with TypeScript** for `apps/api`, on Nest's Express adapter. Port module by module (strangler pattern): the legacy Express routers are mounted inside the Nest app, and each module (customers, vehicles, estimates, …) moves to a Nest controller → service → repository when its contract tests pass against the new implementation.

## Alternatives considered

- **FastAPI:** a good framework, but it requires rewriting all business rules and tests in Python and prevents sharing types, validation, and calculations with the TypeScript clients.
- **Keep plain Express, add TypeScript:** lowest effort, but lacks the module/guard/dependency-injection structure needed to apply auth, tenant, and role rules consistently across 100+ endpoints.

## Consequences

One language across API, web, mobile, and shared packages. No big-bang rewrite; the API is deployable at every step.
