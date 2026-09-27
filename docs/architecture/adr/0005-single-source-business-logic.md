# ADR-0005: One implementation of business calculations; the API is authoritative

- Status: Accepted (2026-09-26)

## Context

`public/index.html` contained hand copies of `server/pricing.js` functions (`calculateEstimateTotals`, `calculateJobTotals`, `markupForCost`). They matched only by manual discipline.

## Decision

- Every calculation (line totals, markup, discounts, tax, invoice totals, balances) has **one implementation**: today `server/pricing.js`, later `packages/business-logic`.
- The **API computes and returns official totals**; clients display them. Clients may run the same shared module only for an instant preview while editing, and previews are never saved as-is.
- Phase 0: the desktop browser UI loads the server's `pricing.js` (served at `/shared/pricing.js`) instead of keeping copies.

## Consequences

A pricing fix lands in one place and reaches the API, web, mobile, and desktop together.
