# WrenchPro Access and Bot Request Plan

Date: 2026-04-29

## Purpose

Define what access the AI-assisted WrenchPro company needs, when it needs it, and what Brandon should not provide yet.

Core principle: provide the minimum useful access needed for the current stage. Expand only when the company reaches the next gate.

## Recommended Telegram Bot

### Bot Display Name

**WrenchPro HQ**

### Preferred Username

**WrenchProHQBot**

Telegram bot usernames must end in `bot`. If unavailable, fallback options:

1. `WrenchProHQBot`
2. `WrenchProOpsBot`
3. `WrenchProCompanyBot`
4. `WrenchProCommandBot`
5. `WrenchProUpdatesBot`

### Bot Purpose

The bot should become the command/approval channel for the WrenchPro AI company.

Initial use cases:

- approval requests
- daily/weekly status summaries
- QA/release blocker alerts
- feedback intake
- release readiness summaries
- company operating updates

### BotFather Info Needed Later

When ready, Brandon should create the bot through BotFather and provide:

- bot token
- bot username
- confirmation of the Telegram account/channel where updates should go

Do not request this until we are ready to configure it.

## Access Needed by Stage

## Stage 1 — Current Internal Build/Company Setup

Needed now or soon:

- Local repo access: already available.
- Ability to run tests/builds locally: already available.
- Ability to create local commits: approved by operating mandate.
- Web research access: available.
- Current Telegram chat for status: available.

Not needed yet:

- bank/payment access
- public customer contact
- domain/account purchase
- business legal setup
- public support inbox

## Stage 2 — Repo Operations

Needed when Brandon approves GitHub sync:

- GitHub push permission for `GoldenCrow217/wrenchpro`
- Ability to create branches/PRs/issues/releases when explicitly approved

Recommended permissions model:

- Agent may prepare commits/branches locally.
- Brandon approves first push until trust is established.
- Releases/tags always require explicit approval.

## Stage 3 — Dedicated Company Communications

Needed when bot implementation begins:

- Telegram bot token from BotFather
- allowed Telegram user/chat IDs
- decision on whether bot talks only to Brandon or later to beta testers

Recommendation:

Start with Brandon-only bot. Do not expose it to testers until approval workflows are proven.

## Stage 4 — Website / Landing Page

Needed before private beta outreach:

- domain decision
- hosting choice
- landing page repo or platform access
- permission to publish public-facing copy

Agent can prepare copy/design internally before access is granted.

## Stage 5 — Payments

Needed only after product is ready to charge:

- payment platform selection: Stripe, Lemon Squeezy, Gumroad, or similar
- account owner setup by Brandon
- pricing approval
- refund/support terms approval

Recommendation:

Do not create payment accounts yet. Prepare pricing/offer first.

## Stage 6 — Support / Feedback

Needed before private beta:

- support email or form
- feedback intake process
- private beta tester list approved by Brandon

Recommendation:

Start with repo docs + Telegram; add support inbox when testers exist.

## Access Not Needed / Not Recommended

Do not provide:

- bank account access
- personal email access unless explicitly scoped
- unrestricted spending authority
- legal filing authority
- permission to contact customers without approval
- permission to publish releases without approval
- permission to collect real customer data without privacy/security plan

## Next Access Request

The next likely access request is **Telegram bot creation**.

Recommended request wording when ready:

> Brandon, please create a Telegram bot through BotFather named WrenchPro HQ with username WrenchProHQBot if available. If unavailable, use WrenchProOpsBot. Send me the bot token privately in this chat.

Do not ask until the bot wiring plan is ready.
