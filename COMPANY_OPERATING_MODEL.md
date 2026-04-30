# WrenchPro Company Operating Model

WrenchPro is not just a one-off app. The long-term goal is to become a software company that develops, maintains, improves, and supports WrenchPro for mobile mechanic businesses.

## Company Vision

Build practical software that helps mobile mechanics run their business more professionally, efficiently, and profitably.

WrenchPro should help mechanics:

- manage customers
- track vehicles
- create estimates
- manage jobs/work orders
- document inspections
- track parts/inventory
- collect payments
- manage warranties
- follow up with customers
- understand their business performance

## Business Model Direction

Possible future models:

- free local desktop version for early testing
- paid desktop license
- subscription with updates/support
- premium business features
- paid setup/onboarding
- paid customizations for shops/mechanics
- future cloud/mobile companion features

No final pricing decision yet.

## Product Philosophy

- Start with one real user/business and make it genuinely useful.
- Use feedback from real mechanics to improve the app.
- Release updates in small, stable increments.
- Keep the app practical, not bloated.
- Prioritize reliability, data safety, and workflow fit.
- Build trust before trying to scale.
- Let AI agents do the research, analysis, drafting, testing, and planning work by default.
- Bring Brandon approval-ready recommendations instead of raw homework.

## AI-Assisted Company Team

### CEO / Founder Strategy Agent

Purpose: help Brandon think and operate like a software company founder.

Responsibilities:

- maintain company direction
- identify next milestones
- prioritize product/business work
- avoid distraction and scope creep
- decide what feedback matters
- recommend when the product is ready for wider testing

### Product Manager Agent

Purpose: turn user feedback into product decisions.

Responsibilities:

- collect feedback
- group feedback into themes
- turn needs into feature requests
- write acceptance criteria
- maintain roadmap

### QA Agent

Purpose: protect product quality.

Responsibilities:

- run test passes
- reproduce bugs
- document issues
- verify fixes
- protect against regressions

### Developer Agent

Purpose: implement approved changes.

Responsibilities:

- fix bugs
- build features
- improve code safely
- run meaningful checks
- keep changes small and reviewable

### Release Manager Agent

Purpose: ship updates safely.

Responsibilities:

- version management
- release notes
- build verification
- installer checks
- update safety
- GitHub release preparation

### Customer Feedback / Support Agent

Purpose: help manage feedback from users/testers.

Responsibilities:

- turn user comments into structured feedback
- identify bugs vs feature requests vs training issues
- draft support replies for Brandon approval
- maintain FAQ/help notes
- flag urgent customer-impacting issues

### Documentation Agent

Purpose: make the software easier to learn and trust.

Responsibilities:

- user guides
- setup instructions
- release notes
- feature explainers
- onboarding checklists

## Feedback Loop

1. User/tester gives feedback.
2. Feedback Agent captures it in `FEEDBACK_INBOX.md`.
3. Product Manager categorizes it.
4. CEO/Product Owner prioritizes it.
5. Developer fixes/builds if approved.
6. QA verifies it.
7. Release Manager ships it.
8. Documentation Agent updates help/release notes.

## Release Strategy

Early releases should be conservative:

- fix bugs first
- improve usability second
- add major new features only after core workflows are stable
- release notes should clearly explain what changed
- every release should preserve existing data

## Near-Term Company Milestones

### Milestone 1 — Internal Alpha

Used by Brandon and brother only.

- [ ] Core workflows tested
- [ ] Known issues documented
- [ ] Database backup plan exists
- [ ] Release process works

### Milestone 2 — Real Business Beta

Used by brother in normal work.

- [ ] Daily workflow is usable
- [ ] Critical bugs fixed
- [ ] Feedback process in place
- [ ] Update process tested

### Milestone 3 — Small Private Beta

Used by 1-3 trusted mechanics.

- [ ] Installer is easy enough
- [ ] Basic documentation exists
- [ ] Feedback inbox process works
- [ ] Support process exists
- [ ] Release notes are consistent

### Milestone 4 — Public Product Decision

Decide whether to turn it into a broader paid product.

- [ ] Clear target customer
- [ ] Pricing hypothesis
- [ ] Support burden understood
- [ ] Competitive research completed
- [ ] Legal/business setup considered

## Important Guardrails

- Do not overpromise features.
- Do not collect customer data casually without a privacy/security plan.
- Do not publish releases without testing.
- Do not scale before the product is reliable.
- Keep Brandon in approval control for business-facing actions.
- Agents should operate autonomously internally, but external actions require approval.
