# WrenchPro Telegram Bot Plan

A dedicated Telegram bot may become the communication channel between Brandon and the WrenchPro AI-assisted software company/team.

## Purpose

The bot should give Brandon a clean place to receive WrenchPro-specific updates, approvals, summaries, and alerts without mixing everything into general assistant chat.

## Recommended Timing

Do not make the Telegram bot a blocker for early product work.

Use the current Telegram conversation for now. Create a dedicated bot after the first autonomous workstream identifies what notifications and approval flows are actually needed.

## Possible Bot Uses

### Approval Requests

- approve/reject release publishing
- approve/reject GitHub push/tag
- approve/reject customer outreach
- approve/reject public website/marketing updates
- approve/reject pricing/product decisions

### Status Updates

- QA pass completed
- release candidate ready
- new critical issue found
- competitor research completed
- feedback triage completed
- roadmap updated

### Feedback Intake

- quick feedback from Brandon
- copied feedback from brother/testers
- bug reports
- feature requests

### Command Interface

Possible future commands:

- `/status` — WrenchPro project status
- `/issues` — open release blockers
- `/roadmap` — current roadmap priorities
- `/qa` — latest QA summary
- `/release` — current release readiness
- `/feedback` — submit new feedback

## BotFather Needed?

Eventually yes, if Brandon wants a dedicated Telegram bot account.

BotFather would be used to create a new bot token. That should only happen once we decide:

- bot name
- bot username
- what notifications it sends
- who can use it
- what approval actions it supports

## Security / Safety

- Only authorized users should interact with the bot.
- Bot should not publish releases or push code without explicit approval.
- Bot should not expose secrets, customer data, or private repo details.
- Bot should log approval decisions.

## Recommendation

Start with internal docs and current Telegram updates.

Create the dedicated bot when one of these becomes true:

- project updates become frequent enough to clutter normal chat
- Brandon wants structured approval buttons
- private beta users/testers need a feedback channel
- release management needs a clearer approval trail
