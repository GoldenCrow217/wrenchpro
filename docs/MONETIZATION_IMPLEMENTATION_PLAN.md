# WrenchPro Monetization Implementation Plan

Date: 2026-04-29  
Owner: WrenchPro Monetization CEO Agent  
Status: Internal implementation plan; not public pricing or positioning.  
Goal: Make money with WrenchPro while minimizing Brandon/human bottlenecks.

## Executive Recommendation

WrenchPro should monetize first as a **paid local desktop operating system for solo/small mobile mechanics**, not as a broad SaaS product yet.

The first sellable offer should be a tightly scoped **Private Beta Founding Mechanic Package**: a local desktop app license, setup help, updates during the beta window, basic support, and a clear promise that feedback influences the roadmap. The product should remain controlled and invite-only until reliability, backup/update behavior, documentation, and core workflow are proven.

Do not launch public sales yet. The near-term money path is:

1. Stabilize the app for Brandon/brother.
2. Convert brother into the first real workflow proof point.
3. Recruit 1-3 trusted mechanics only after Brandon approval.
4. Offer a low-friction paid beta/founding license once the app can safely run the daily workflow.
5. Use paid beta learning to decide whether WrenchPro becomes a one-time license, subscription, setup/service package, or hybrid.

## Target Paying Customer

### Primary Customer

Solo mobile mechanics and very small mobile mechanic businesses that currently manage work through texts, phone calls, paper notes, spreadsheets, generic invoices, and memory.

### Best Early Fit

- 1 owner/operator, possibly 1-2 helpers.
- Local customer-pay repair, maintenance, and diagnostic work.
- Not ready for heavy shop-management software.
- Needs help organizing customers, vehicles, leads, estimates, jobs, parts, payments, warranties, follow-ups, and expenses.
- Values simple, practical, reliable software more than advanced integrations.
- Comfortable using a Windows desktop/laptop as the business command center.

### Poor Early Fit

Avoid selling early to:

- Multi-location shops.
- Large fleets or enterprise accounts.
- Shops needing cloud sync, customer portals, online booking, payment processing, accounting integrations, or SMS automation immediately.
- Mechanics who require mobile-first field entry before they can use the app.

## First Sellable Offer

### Offer Name

**WrenchPro Founding Mechanic Package**

### Offer Promise

A practical local desktop command center that helps a mobile mechanic organize customers, vehicles, leads, estimates, jobs, payments, expenses, warranties, and follow-ups in one place — without adopting bloated shop software.

### What Is Included

- Local WrenchPro desktop app installer.
- Single-business use license during beta.
- Basic setup guide.
- Standard mobile-mechanic workflow guide.
- Backup/data-location guide.
- Known limitations list.
- Updates during the beta period.
- Basic support through a controlled channel approved by Brandon.
- Feedback influence on the roadmap, with no promise of custom work unless separately approved.

### What Is Explicitly Not Included Yet

- Cloud sync.
- Multi-device sync.
- Mobile app.
- Online booking.
- Payment processing.
- SMS/email automation.
- Customer portal.
- Accounting integration.
- Guaranteed custom feature development.

## Pricing Hypotheses

These are internal hypotheses only. Brandon approval is required before quoting or publishing prices.

### Hypothesis A — Founding Beta One-Time License

- **$99-$199 one-time founding beta license** per business.
- Includes beta updates for 6-12 months.
- Best for reducing friction and validating willingness to pay.
- Risk: weak recurring revenue.

### Hypothesis B — Desktop License + Annual Updates/Support

- **$199-$399 one-time desktop license**.
- Optional **$99-$199/year updates/support plan** after the first year.
- Best fit for local-first desktop software.
- Risk: support expectations must be carefully scoped.

### Hypothesis C — Subscription

- **$19-$39/month** or **$199-$399/year**.
- Includes updates and support while active.
- Better long-term economics.
- Risk: harder to justify before cloud/mobile features exist.

### Hypothesis D — Setup/Onboarding Service

- **$149-$499 paid setup/onboarding** for importing starting customers/services, configuring business settings, and training the user.
- Can pair with any license model.
- Risk: could create Brandon bottlenecks unless agents prepare most materials and Brandon only approves/handles external touchpoints.

### Recommended Initial Pricing Test

For the first 1-3 paid beta users, test:

- **$149 Founding Mechanic License**
- Includes local desktop app, 12 months of beta updates, setup docs, and basic support.
- Optional later upgrade path to a full license/subscription once public product direction is decided.

This is low enough for a solo mechanic to try, high enough to prove payment intent, and simple enough to explain.

## Packaging

### Package 1 — Internal Alpha

Audience: Brandon and brother only.  
Price: Free.  
Goal: prove daily workflow and reliability.

Required before moving on:

- Core workflow tested.
- Data persistence verified.
- Backup/update behavior documented.
- Known issues tracked.
- Feedback process active.

### Package 2 — Private Beta / Founding Mechanic

Audience: 1-3 trusted mechanics after Brandon approval.  
Price hypothesis: $149 one-time founding license.  
Goal: validate value, support burden, and willingness to pay.

Includes:

- Installer.
- Setup guide.
- Standard workflow guide.
- Backup guide.
- Known limitations.
- Controlled support/feedback.
- Updates during beta.

### Package 3 — Early Commercial Desktop Product

Audience: validated solo/small mobile mechanics.  
Price hypothesis: $199-$399 license plus optional annual support/updates, or $19-$39/month subscription if beta users prefer recurring support.

Only consider after:

- At least 2-3 mechanics have used the product in real workflow.
- Support burden is understood.
- App reliability is proven.
- Pricing feedback exists.
- Brandon approves public positioning/pricing.

## Beta-to-Paid Conversion Path

### Stage 1 — Internal Alpha Proof

Brother uses WrenchPro in controlled real or near-real workflow. No money collected.

Success signals:

- Can create lead/customer/vehicle.
- Can create estimate and convert to job.
- Can schedule/track job.
- Can record payment/expense.
- Can print usable invoice/receipt.
- Can track warranty/follow-up.
- Data persists and backup process is understood.
- App is useful enough that the mechanic wants to keep using it.

### Stage 2 — Free Private Beta

Invite 1-3 trusted mechanics only after Brandon approval. Short trial window: 14-30 days.

Goal: learn whether the workflow generalizes beyond brother.

Trial rules:

- Controlled expectations.
- Known limitations disclosed.
- No public promises.
- Feedback goes into `FEEDBACK_INBOX.md`.
- Bugs and workflow blockers are triaged before feature requests.

### Stage 3 — Paid Founding Conversion

At the end of the trial, offer:

> Continue with WrenchPro as a founding mechanic for $149. You get the desktop app, beta updates for 12 months, and basic support while helping shape the product.

Conversion success threshold:

- At least 1 of 3 private beta mechanics pays.
- Better signal: 2 of 3 pay or strongly request continued use.

### Stage 4 — Early Commercial Decision

After paid beta:

- Analyze which features drove value.
- Document support burden.
- Choose license/subscription path.
- Prepare public product decision approval packet for Brandon.

## 30/60/90 Day Revenue Plan

## First 30 Days — Revenue Readiness, Not Sales

Objective: become sellable enough for controlled beta.

Agent work:

- Complete or coordinate manual QA pass.
- Maintain `KNOWN_ISSUES.md` and release blockers.
- Verify data location, persistence, backup, and update/reinstall behavior.
- Draft setup guide, workflow guide, backup guide, known limitations, and beta support process.
- Define the exact beta offer and pricing approval packet.
- Draft private beta landing copy internally only.
- Draft a beta user agreement / expectation sheet internally only; Brandon/legal review needed before use.

Product readiness target:

- No critical workflow or data-loss blockers.
- Install/build verified.
- Core workflow usable end-to-end.
- Basic documentation exists.

Revenue target:

- $0 expected.
- Success is having a paid-beta-ready package and Brandon approval packet.

## Days 31-60 — Controlled Beta and First Paid Conversion

Objective: get 1-3 trusted beta users approved and move at least one toward paid use.

Required Brandon approvals before external action:

- Who to invite.
- What message to send.
- Whether to charge during or after trial.
- Final beta price.

Agent work:

- Prepare invite scripts for Brandon approval.
- Prepare onboarding checklist.
- Prepare feedback triage workflow.
- Convert feedback into bug/workflow/doc/feature categories.
- Recommend fixes that improve conversion.
- Draft conversion message and invoice/payment instructions for Brandon approval.

Revenue target:

- Conservative: $0-$149.
- Target: 1 paid founding license at $149.
- Stretch: 2 paid founding licenses at $149 each = $298.

## Days 61-90 — Validate Repeatability

Objective: prove WrenchPro can repeatedly attract and support paying users without overloading Brandon.

Agent work:

- Analyze first beta outcomes.
- Identify repeated pain points and objections.
- Recommend top conversion-improving product fixes.
- Draft pricing model decision packet.
- Draft simple public positioning and FAQ internally.
- Prepare support macros and troubleshooting docs.
- Recommend whether to continue private beta, raise price, or pause sales until readiness improves.

Revenue target:

- Conservative: $149 total cumulative.
- Target: 3 founding licenses at $149 each = $447 cumulative.
- Stretch: 5 founding licenses at $149 each = $745 cumulative, only if support burden remains manageable.

## Required Product Readiness Before Charging

Do not charge external users until these are satisfied or explicitly disclosed and approved.

### Must-Have

- App installs and launches reliably on target Windows machine.
- Data persists after app close/reopen.
- Backup/data-location process documented.
- Core customer/vehicle/estimate/job/payment flow works end-to-end.
- Estimate totals and payment records are accurate in normal cases.
- Usable invoice/receipt print flow exists.
- Critical navigation/buttons are not broken.
- Known issues and limitations are documented.
- Support/feedback process exists.

### Strongly Recommended

- Safer archive/void behavior for business-critical records instead of hard deletes.
- Clear job/estimate/payment status model.
- Appointment linkage or documented scheduling workaround.
- Basic reporting/date filtering for payments and expenses.
- Backup/restore test completed.
- Installer/update persistence verified.

### Not Required for First Paid Beta If Disclosed

- Cloud sync.
- Mobile companion app.
- Payment processing.
- SMS/email automation.
- Photo attachments.
- Route optimization.
- Accounting integration.

## Key Monetization Risks and Mitigations

### Risk: Product reliability damages trust

Mitigation:

- Do not sell before QA and data persistence checks.
- Keep beta small.
- Publish no broad claims.
- Maintain known limitations honestly.

### Risk: Brandon becomes the bottleneck

Mitigation:

- Agents draft all customer-facing materials for approval.
- Agents triage feedback before Brandon sees it.
- Agents produce yes/no approval packets.
- Support should use templates/macros where possible.
- No long questionnaires unless a decision cannot be inferred.

### Risk: Customization requests derail product roadmap

Mitigation:

- Founding package does not include custom development.
- Feedback influences roadmap but does not guarantee features.
- Product Owner categorizes common needs vs one-off requests.

### Risk: Pricing is too early or too high

Mitigation:

- Start with controlled beta and low founding price.
- Measure continued-use intent before raising price.
- Ask for payment only after demonstrated usefulness.

### Risk: Local desktop app makes subscription harder

Mitigation:

- Lead with license + optional support/updates.
- Consider subscription later if users value ongoing improvements/support.
- Avoid SaaS expectations until cloud/mobile exists.

### Risk: Legal/privacy/business setup is not ready

Mitigation:

- Keep early beta private and controlled.
- Do not collect customer data centrally unless approved and planned.
- Prepare terms/privacy/support expectations before broader launch.
- Brandon approval required for business/legal/public actions.

## Autonomous Agent Responsibilities

Agents should do the following without requiring Brandon to manage details.

### Monetization CEO Agent

- Maintain this plan.
- Turn pricing/business decisions into approval packets.
- Track revenue-readiness milestones.
- Recommend when to move from free beta to paid beta.
- Keep the company focused on money-making steps that do not outrun product trust.

### Product Owner Agent

- Prioritize fixes that unlock beta conversion.
- Maintain roadmap discipline.
- Prevent advanced feature creep before paid beta validation.
- Convert feedback into clear product decisions.

### QA Agent

- Run full manual workflow pass.
- Verify install/update/data persistence.
- Identify blockers before beta/paid use.
- Re-test fixes that affect money workflows.

### Developer Agent

- Fix release blockers and conversion blockers.
- Prefer small, testable changes.
- Avoid major rewrites unless approved.
- Protect data safety and workflow reliability first.

### Documentation Agent

- Draft setup guide.
- Draft standard workflow guide.
- Draft backup/restore guide.
- Draft known limitations.
- Draft FAQ and support macros.

### Feedback / Support Agent

- Maintain `FEEDBACK_INBOX.md`.
- Categorize feedback as bug, workflow gap, usability issue, documentation issue, feature request, or training issue.
- Draft replies for Brandon approval.
- Surface only high-value summaries and blockers.

### Release Manager Agent

- Verify version/build/install readiness.
- Prepare release notes.
- Confirm installer output.
- Confirm backup/update safety.
- Prepare release approval packets for Brandon.

## Brandon Approval Gates

Brandon must approve before:

- Contacting any beta user.
- Sending invite/conversion/support messages externally.
- Charging money or quoting a price.
- Publishing public pricing or website copy.
- Releasing/tagging/pushing to GitHub.
- Collecting real customer data beyond controlled testing.
- Spending money, registering accounts/domains, or setting up payment tools.
- Promising custom work.

## Approval Packet to Prepare Next

Agents should prepare this as the next business-facing artifact after product readiness is clearer:

```md
## Approval Needed: WrenchPro Paid Beta Offer

Recommendation: Offer a $149 Founding Mechanic License to 1-3 trusted mobile mechanics after a 14-30 day controlled private beta.

Options:
1. $149 one-time founding beta license — recommended.
2. Free beta only until public product decision — safest but delays revenue validation.
3. $19/month beta subscription — better recurring revenue but harder to justify before cloud/mobile.

Why I recommend it:
- Simple to explain.
- Low-friction for solo mechanics.
- Tests willingness to pay without overpromising SaaS features.
- Keeps support expectations controlled.

Risk: Medium

If approved, agents will:
- Draft invite and conversion messages.
- Prepare onboarding/support materials.
- Track feedback and conversion signals.
- Avoid external contact until Brandon approves each step.
```

## Bottom Line

WrenchPro should make its first money through a controlled, paid founding beta for solo/small mobile mechanics — but only after the app is reliable enough to protect trust. The fastest path to revenue is not public marketing; it is a narrow, credible offer attached to a stable daily workflow, with agents doing nearly all preparation, triage, documentation, and decision packaging so Brandon only has to approve key moves.
