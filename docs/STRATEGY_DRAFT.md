# WrenchPro Internal Strategy Draft

Date: 2026-04-29
Owner: Founder / Company CEO Agent
Status: Internal draft for Brandon review; not public positioning.

## Executive Summary

WrenchPro should be built first as a reliable, practical desktop operating system for a small mobile mechanic business, then expanded cautiously into a private beta with 1-3 trusted mechanics. The near-term company strategy is not growth-at-all-costs; it is trust, workflow fit, data safety, and repeatable release/support processes.

The strongest initial path is to win one real workflow deeply: customer call -> vehicle/job intake -> estimate -> work order/inspection -> parts/time tracking -> payment/expense record -> warranty/follow-up. Once that workflow works reliably for Brandon's brother in daily use, WrenchPro can test whether similar solo or small mobile mechanics have the same pain.

## Target Customer Hypothesis

### Primary Early Customer

Solo mobile mechanics or very small mobile mechanic businesses, especially owner-operators who currently manage work through a mix of texts, paper notes, spreadsheets, generic invoicing tools, and memory.

### Likely Traits

- 1-3 workers.
- Mostly local service calls.
- Needs simple customer, vehicle, job, estimate, parts, payment, warranty, and follow-up tracking.
- Not ready for heavy shop-management software.
- Values practical reliability over complex enterprise features.
- May prefer local/offline-capable desktop software before trusting a cloud system.

### Assumption

Assumption: The best initial market is solo/small mobile mechanics, not full brick-and-mortar repair shops.
Confidence: Medium
Why: Current product goals and documents repeatedly reference mobile mechanic workflows, simple operations, and one real business user.
Needs Human Approval?: No for internal planning; yes before public positioning.

## Positioning Hypothesis

### Short Positioning

WrenchPro is practical business software for mobile mechanics who need to keep customers, vehicles, jobs, estimates, parts, payments, and follow-ups organized without adopting bloated shop software.

### Differentiation Angles to Test

- Built around mobile mechanic workflow, not generic shop counter workflow.
- Simple enough for an owner-operator.
- Reliable local desktop app first; no premature cloud complexity.
- Helps mechanics look more professional and avoid missed details.
- AI-assisted product development: feedback can turn into rapid, organized improvements, while releases remain controlled and tested.

### Avoid Saying Publicly Yet

- Do not claim it is production-ready until QA, backup, install/update, and daily workflow are verified.
- Do not promise cloud sync, payments, SMS, online booking, or accounting integrations until intentionally scoped.

## Product Milestones

### Milestone 1: Internal Alpha

Goal: Brandon and brother can test without risking business data.

Exit criteria:
- Core workflows tested manually.
- Known issues documented.
- Database backup/export behavior confirmed.
- Installer/update path verified locally.
- Release blockers identified.

### Milestone 2: Real Business Beta

Goal: Brother uses WrenchPro in normal work with controlled expectations.

Exit criteria:
- Daily job lifecycle is usable.
- Critical bugs fixed.
- Feedback capture process active.
- Update process tested.
- Basic support/debug workflow exists.

### Milestone 3: Small Private Beta

Goal: 1-3 trusted mobile mechanics test with Brandon approval.

Exit criteria:
- Installer is understandable.
- Setup and workflow docs exist.
- Backup/update guide exists.
- Release notes are consistent.
- Support process is manageable.

### Milestone 4: Public Product Decision

Goal: Decide whether WrenchPro should become a broader paid product.

Exit criteria:
- Target customer validated beyond one business.
- Pricing/business model hypothesis selected.
- Support burden understood.
- Competitive research completed.
- Privacy/legal/business setup considered.

## Business Model Hypotheses

These are hypotheses only; no public pricing decision should be made yet.

### Option A: Paid Desktop License

One-time license for the desktop app, possibly with optional paid upgrade/support.

Pros:
- Simple for mechanics to understand.
- Good fit for local-first desktop software.
- Lower expectation of always-on cloud service.

Risks:
- Revenue may be uneven.
- Ongoing support and updates need funding.

### Option B: Subscription With Updates + Support

Monthly or annual subscription for continued updates/support.

Pros:
- Better long-term company economics.
- Aligns revenue with ongoing maintenance.

Risks:
- Harder sell if product is local-only and early.
- Users may expect cloud/mobile features.

### Option C: Free/Early Access + Paid Setup/Customization

Controlled free testing for early users, with optional paid onboarding/customization later.

Pros:
- Helps validate workflow before monetization.
- Keeps early adoption friction low.
- Good fit while the product is still stabilizing.

Risks:
- Can create custom-work distractions.
- Must avoid promising custom features that damage the core roadmap.

### Initial Recommendation

Use a free controlled internal/private beta first. Do not price publicly until Milestone 4. For later monetization, test a simple paid desktop license plus optional annual support/update plan before attempting SaaS pricing.

## Key Risks

### Product Reliability Risk

If the app loses data, fails to install/update, or breaks core workflows, trust will be hard to recover.

Mitigation:
- Finish QA pass.
- Verify backup/export.
- Keep releases small.
- Document known limitations honestly.

### Workflow Fit Risk

A mechanic may not use the app if it slows down field work or requires too much admin.

Mitigation:
- Map the real job lifecycle.
- Observe feedback from brother's actual use.
- Prioritize speed and practical defaults.

### Scope Creep Risk

Advanced features like payments, SMS, portals, cloud sync, and accounting integrations can distract from the core product.

Mitigation:
- Keep Phase 1-3 focused on stability and core workflow.
- Park advanced features until daily use is proven.

### Support Burden Risk

Even a small private beta can generate support load if install, backup, and workflow docs are weak.

Mitigation:
- Create basic docs before inviting testers.
- Track repeated questions.
- Avoid public support channels until ready.

### Data/Privacy Risk

Customer and vehicle/job records are sensitive business data.

Mitigation:
- Avoid collecting real customer data centrally until there is a privacy/security plan.
- Keep beta controlled.
- Be explicit about backup and data ownership.

### Business Validation Risk

One mechanic's workflow may not represent the broader market.

Mitigation:
- Treat brother's workflow as the first anchor, not universal truth.
- Use 1-3 trusted private beta testers to compare patterns.
- Categorize feedback by common need vs one-off request.

## First 30-Day Priorities

### Priority 1: Stabilize the Current App

- Inventory all existing screens/features.
- Complete the manual QA pass.
- Log bugs in `KNOWN_ISSUES.md`.
- Identify release blockers.
- Fix only the issues that block safe real use.

### Priority 2: Prove Data Safety

- Confirm where data is stored.
- Confirm backup/export behavior.
- Test reinstall/update persistence.
- Draft a backup/export guide.

### Priority 3: Map the Real Mobile Mechanic Workflow

- Draft the assumed job lifecycle from lead/contact through follow-up.
- Compare app screens against that lifecycle.
- Identify missing or confusing steps.
- Keep assumptions explicit instead of waiting on long questionnaires.

### Priority 4: Prepare Internal Alpha Package

- Verify app build/install path.
- Draft short release notes.
- Draft first-time setup guide.
- Draft known limitations.
- Prepare Brandon approval packet before any release/push/tag.

### Priority 5: Create Feedback Discipline

- Use `FEEDBACK_INBOX.md` for all comments.
- Categorize feedback into bug, workflow gap, usability, documentation, or feature request.
- Convert high-value feedback into roadmap items only after triage.

### Priority 6: Delay Public Company Decisions

- Do not launch website, pricing, public GitHub releases, public support channels, or customer outreach yet.
- Start competitor research internally, but do not let it derail stabilization.

## 30-Day Success Definition

At the end of 30 days, WrenchPro should have:

- A known list of screens/features.
- A documented QA pass.
- A clear release-blocker list.
- Verified backup/update behavior or documented gaps.
- A draft internal alpha release package.
- A mapped real-world mechanic workflow.
- A working feedback intake process.
- A recommendation on whether to move from Internal Alpha to Real Business Beta.

## Decision Recommendations for Brandon Later

No approval is required for this internal draft. Future approval will be needed before:

- Publishing or tagging a release.
- Sending WrenchPro to any tester outside Brandon/brother.
- Making public pricing/positioning claims.
- Creating public support channels.
- Collecting real customer data beyond controlled testing.

## Bottom Line

WrenchPro's best near-term company strategy is to become boringly reliable for one real mobile mechanic business before trying to become exciting to the market. If the app can safely run daily work, preserve data, and reduce admin pain, the company has a credible foundation. If it cannot do those things yet, marketing and pricing are premature.
