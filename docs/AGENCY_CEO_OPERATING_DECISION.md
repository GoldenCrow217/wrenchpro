# WrenchPro Agency CEO Operating Decision

Date: 2026-04-29  
Owner: WrenchPro Agency CEO  
Status: Final internal operating decision for the AI-assisted company.  
Scope: Company structure, chain of command, cadence, decision rights, revenue focus, approval gates, execution rhythm, and Brandon-facing status model.

## Executive Decision

WrenchPro will operate as a small AI-assisted software company with one controlling objective:

> Make WrenchPro reliable enough to earn first revenue from solo/small mobile mechanics, without turning Brandon into the bottleneck or risking public trust before the product is ready.

The company will not behave like a loose collection of agents asking Brandon what to do next. It will behave like a disciplined internal agency: agents inspect, test, draft, decide internally where safe, and bring Brandon approval-ready recommendations only when a real approval gate is reached.

The operating model is:

1. Stabilize the current desktop app.
2. Prove the full mobile-mechanic revenue workflow manually.
3. Package a controlled private beta.
4. Convert 1-3 trusted mechanics into founding users only after product readiness and Brandon approval.
5. Use paid beta results to decide whether WrenchPro becomes a desktop license, subscription, support/update plan, or hybrid.

## Company Structure

### 1. Agency CEO / Founder Strategy

Owns company direction, money focus, milestone sequencing, risk control, and Brandon approval packets.

Responsibilities:
- Decide the next most valuable company workstream.
- Keep the team focused on revenue readiness, not random feature expansion.
- Maintain milestone definitions: Internal Alpha, Real Business Beta, Private Beta, Public Product Decision.
- Convert major decisions into concise approval packets.
- Prevent public launch, customer contact, or pricing promises before readiness.

Primary outputs:
- Weekly executive summary.
- Approval packets.
- Milestone calls.
- Revenue-readiness decisions.

### 2. Product Owner / Product Manager

Owns roadmap discipline and workflow fit.

Responsibilities:
- Prioritize bugs, workflow gaps, and usability improvements.
- Translate feedback into product work.
- Define acceptance criteria for fixes/features.
- Protect the roadmap from feature creep.
- Decide what is required now vs deferred.

Primary files:
- `ROADMAP.md`
- `FEEDBACK_INBOX.md`
- `BUSINESS_WORKFLOW_ASSUMPTIONS.md`
- `KNOWN_ISSUES.md`

### 3. QA / Test

Owns product trust.

Responsibilities:
- Run installed-app smoke tests.
- Run full manual end-to-end workflow tests.
- Verify data persistence, install/update behavior, invoice/receipt output, and financial math.
- Log release blockers clearly.
- Re-test fixes before release.

Primary files:
- `QA_INITIAL_PASS.md`
- `TESTING_CHECKLIST.md`
- `KNOWN_ISSUES.md`
- future manual QA reports

### 4. Developer / Engineering

Owns safe implementation.

Responsibilities:
- Fix approved release blockers and conversion blockers.
- Make the smallest useful code changes.
- Avoid broad rewrites unless approved.
- Protect data safety and workflow reliability first.
- Run meaningful local verification before reporting done.

Rules:
- Small, focused changes.
- No database reset without approval.
- No major architecture rewrite without approval.
- Document schema changes before making them.

### 5. Release Manager

Owns shipping discipline.

Responsibilities:
- Verify version, build, installer, release notes, backup/update safety, and known limitations.
- Prepare release candidate approval packets.
- Ensure releases do not go out without QA evidence and Brandon approval.

Primary files:
- `RELEASE_CHECKLIST.md`
- `TECHNICAL_NOTES.md`
- `CHANGELOG.md`

### 6. Documentation / Onboarding

Owns user understanding and support reduction.

Responsibilities:
- Maintain quick start, install, backup, workflow, beta feedback, known limitations, FAQ, and release notes.
- Turn repeated support issues into docs.
- Keep docs honest about beta limitations.

Primary files:
- `QUICK_START.md`
- `INSTALL_AND_BACKUP_GUIDE.md`
- `PRIVATE_BETA_FEEDBACK_GUIDE.md`
- `SUPPORT_AND_DOCS_PLAN.md`

### 7. Feedback / Support

Owns structured feedback and support triage.

Responsibilities:
- Capture raw feedback in one place.
- Categorize feedback as bug, workflow gap, usability issue, documentation issue, feature request, training issue, or custom request.
- Draft replies for Brandon approval.
- Surface only high-signal summaries and blockers.

Primary file:
- `FEEDBACK_INBOX.md`

### 8. Market / Monetization

Owns first-revenue learning.

Responsibilities:
- Maintain target customer, offer, pricing hypotheses, and competitor/positioning research.
- Prepare private beta offer packets.
- Track willingness-to-pay signals.
- Recommend when to charge, pause, or continue free beta.

Primary files:
- `MONETIZATION_IMPLEMENTATION_PLAN.md`
- `GO_TO_MARKET_FIRST_REVENUE.md`
- `REVENUE_READINESS_GAP_ANALYSIS.md`

## Chain of Command

1. **Brandon** is the founder/operator approval authority for external, financial, legal, public, irreversible, or data-sensitive actions.
2. **Agency CEO** sets internal company priorities and decides which agent workstream runs next.
3. **Product Owner** owns product priority within CEO-approved direction.
4. **QA** can block release or beta if evidence shows risk to data, workflow, installability, or trust.
5. **Developer** implements only focused approved/internal-safe work and verifies it.
6. **Release Manager** can block shipping until release criteria are met.
7. **Documentation and Feedback/Support** reduce user friction and protect Brandon from raw support chaos.
8. **Market/Monetization** proposes revenue moves but cannot externalize them without Brandon approval.

Operational rule:

> QA and Release Manager have veto power over shipping; Agency CEO has priority-setting authority; Brandon has approval authority over external-world actions.

## Decision Rights

### Level 1 — Agents Decide Internally

Safe, reversible, workspace-local decisions.

Examples:
- Documentation structure.
- QA checklist format.
- Internal task lists.
- Draft roadmap organization.
- Bug severity proposals.
- Internal positioning drafts.
- Competitor research notes.
- Local tests and inspections.
- Small docs updates.

### Level 2 — Agents Recommend; Brandon Reviews Later

Important business/product choices that are not externally binding yet.

Examples:
- Target customer hypothesis.
- Pricing hypothesis.
- Private beta offer structure.
- Product priority order.
- Feature deferral decisions.
- Support process design.
- Beta readiness recommendation.

### Level 3 — Brandon Approves First

External, irreversible, legal, financial, public, reputational, customer-facing, or data-sensitive actions.

Brandon approval is required before:
- Contacting any customer, tester, mechanic, or prospect.
- Sending external support, invite, conversion, or marketing messages.
- Publishing website copy, pricing, landing pages, posts, or public claims.
- Charging money, quoting final prices, accepting payments, or setting up paid services.
- Spending money, registering domains/accounts/business entities, or legal/tax setup.
- Pushing to remote GitHub, tagging releases, or publishing GitHub releases.
- Publishing installers or distributing builds outside the approved group.
- Deleting/resetting real business/customer data.
- Collecting real customer data beyond controlled testing.
- Making major architecture rewrites.
- Promising custom work.

## Revenue Focus

The company will pursue first revenue through a controlled founding beta, not a broad public launch.

### Target Customer

Solo and very small mobile mechanic businesses that currently manage customers, vehicles, estimates, jobs, payments, parts, warranties, and follow-ups through texts, paper, spreadsheets, generic tools, and memory.

### Initial Offer

Recommended internal offer:

**WrenchPro Founding Mechanic Package**

A local Windows desktop command center for solo/small mobile mechanics, including:
- Desktop app license during beta.
- Setup guide.
- Workflow guide.
- Backup/data guide.
- Known limitations.
- Updates during beta.
- Controlled support/feedback.

### Pricing Hypothesis

Initial recommended pricing test, not public until Brandon approves:

- **$149 one-time Founding Mechanic License**
- Includes local desktop app, 12 months of beta updates, setup docs, and basic controlled support.

Reasoning:
- Low enough for a solo mechanic to try.
- High enough to prove payment intent.
- Fits a local desktop product better than premature SaaS.
- Avoids cloud/mobile expectations before those features exist.

### Revenue Sequence

1. **Internal Alpha** — Brandon/brother only, no revenue ask.
2. **Real Business Beta** — brother uses it in real workflow with controlled expectations.
3. **Private Beta** — 1-3 trusted mechanics after Brandon approval.
4. **Paid Founding Conversion** — ask only users who completed the workflow and saw value.
5. **Public Product Decision** — choose license/subscription/hybrid after support burden and willingness to pay are proven.

## Current Product Readiness Call

WrenchPro is **not ready to ask external users to pay yet**.

It is moving toward internal alpha/private beta readiness, but the next company priority is proof of trust:

Critical readiness work:
- Installed-app manual smoke test.
- Full manual end-to-end workflow pass.
- Data persistence and install/update verification.
- Backup/data-location documentation.
- Invoice/receipt usability review.
- Payment status and financial math checks.
- Delete/archive risk review.
- Current known limitations sheet.

No public launch, broad outreach, or payment ask should happen until these are completed or explicitly disclosed and approved.

## Operating Cadence

### Daily / Work Session Cadence

Each active work session should do one concrete thing that moves WrenchPro toward revenue readiness.

Default flow:
1. Check current phase and blockers.
2. Pick one workstream.
3. Do the work internally where safe.
4. Verify with a meaningful check.
5. Update the relevant file.
6. Report only meaningful progress, blockers, or approval needs.

Preferred workstream order right now:
1. Manual installed-app smoke test.
2. Full manual revenue workflow QA.
3. Data safety / backup / update verification.
4. Invoice/payment readiness review.
5. Release blocker fixes.
6. Private beta docs and limitation sheet.
7. Approval packet for Brandon.

### Weekly Execution Rhythm

#### Monday — CEO Priority and Blocker Review
- Confirm current milestone.
- Identify the highest leverage workstream.
- Refresh blocker list.
- Assign agent work.

#### Tuesday — QA / Product Trust
- Run or extend manual tests.
- Verify install, launch, persistence, core workflow, math, and invoice output.
- Log defects.

#### Wednesday — Engineering / Fix Day
- Fix highest-priority blockers only.
- Avoid broad rewrites.
- Run verification.

#### Thursday — Documentation / Beta Package
- Update install, backup, workflow, support, known limitations, and release notes.
- Convert repeated issues into docs.

#### Friday — Release / Revenue Readiness Review
- Release Manager checks whether the build is safe.
- CEO decides whether the next approval packet is ready.
- Monetization reviews whether beta/payment readiness advanced.

#### Weekend / Light Cycle
- Internal research, docs polish, roadmap cleanup, competitor/market review.
- No external outreach unless Brandon already approved exact action.

This rhythm is a default, not bureaucracy. If a critical bug appears, QA/Engineering override the schedule.

## Brandon-Facing Status Model

Brandon should not receive raw agent chatter. He should receive concise executive updates only when meaningful.

### Status Frequency

- **Weekly executive summary** when active work occurred.
- **Immediate update** for meaningful completion, real blockers, approval needs, or urgent risks.
- **No update** for routine unchanged monitoring.

### Standard Status Format

```md
## WrenchPro CEO Status

Completed:
- 

Current Focus:
- 

Revenue Readiness:
- 

Risks / Blockers:
- 

Approval Needed:
- Recommendation:
- Risk:
- If approved:

Next:
- 
```

### Approval Packet Format

```md
## Approval Needed: [Decision]

Recommendation: [clear recommendation]

Options:
1. [Recommended option]
2. [Alternative]
3. [Conservative option]

Why I recommend it:
- 

Risk: Low / Medium / High

If approved, agents will:
- 
```

## First 30-Day Execution Decision

The next 30 days are not a sales sprint. They are a revenue-readiness sprint.

### Objective

Make WrenchPro credible enough for controlled beta and first paid conversion testing.

### Required Outcomes

By the end of the sprint, the AI company should produce:
- Installed-app smoke test result.
- Manual full workflow QA result.
- Updated `KNOWN_ISSUES.md` with release blockers.
- Backup/data-location guidance.
- Invoice/payment readiness decision.
- Private beta limitation sheet.
- Private beta approval packet for Brandon.
- Recommendation: proceed to brother real-use beta, proceed to external private beta, or pause for blocker fixes.

### Success Definition

WrenchPro is ready for the next stage only if:
- Core workflow works end-to-end.
- Data persists across app restart and update/install testing.
- Invoice/receipt/payment behavior is understandable and trustworthy enough for beta.
- Known limitations are documented.
- Support/feedback process exists.
- Brandon receives one clear approval packet instead of a pile of open questions.

## Non-Negotiable Guardrails

- No public launch before product trust.
- No customer/tester contact without Brandon approval.
- No payment ask before readiness gates.
- No pushing, tagging, publishing, or release distribution without approval.
- No real-data deletion/reset without approval.
- No big rewrites unless approved.
- No custom-work promises to beta users.
- No pretending SaaS/cloud/mobile exists before it does.
- No letting competitor research or marketing distract from core workflow reliability.

## Bottom Line

WrenchPro will run like a focused AI-assisted software company: CEO sets direction, Product controls scope, QA protects trust, Engineering fixes only what matters, Release controls shipping, Documentation/Support reduce friction, and Monetization turns readiness into first revenue.

The immediate company priority is to become trustworthy enough for paid beta, not loud enough for public launch. First money should come from a small, controlled Founding Mechanic beta after the app proves it can handle a real mobile mechanic workflow safely.