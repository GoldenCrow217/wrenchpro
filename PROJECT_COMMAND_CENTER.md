# WrenchPro Project Command Center

WrenchPro is a desktop application for a mobile mechanic business. This command center keeps the project organized, testable, and release-ready.

## Current Phase

**Phase:** QA / polish / stabilization

The app exists, is installed locally, and has active development changes. The immediate goal is to make it reliable enough for real business use.

## Company Goal

Build WrenchPro as a real software company/product, not just a one-off app: develop the software, improve it continuously, push safe updates, and use feedback from real mechanics/users to shape the roadmap.

See also: `COMPANY_OPERATING_MODEL.md`, `FEEDBACK_INBOX.md`, and `SUPPORT_AND_DOCS_PLAN.md`.

## Core Product Goal

Help a mobile mechanic business run efficiently by managing:

- customers
- vehicles
- jobs/work orders
- estimates
- inspections
- inventory / parts
- time tracking
- payments / expenses
- warranties
- leads / CRM follow-ups
- business settings

## Operating Rules

See `AUTONOMOUS_OPERATING_RULES.md` for the full autonomy model.

Core rule: **agents do the work; humans approve important decisions.**

- Do not delete production/customer/business data without explicit approval.
- Do not publish GitHub releases without Brandon approval.
- Do not make large architecture rewrites unless approved.
- Do not spend money, register accounts/domains, contact users, or publish public material without approval.
- Prefer small, testable changes.
- Keep Git commits focused and descriptive.
- Before release, verify install/build and core workflows.
- Treat the business owner’s real workflow as the source of truth, but use reasonable provisional assumptions when needed so work does not stall.

## Agent Team

### 0. Founder / Company CEO Agent

Owns the business-building layer around WrenchPro.

Responsibilities:

- keep the company vision focused
- decide milestones for alpha/beta/public product
- evaluate business model options
- make sure feedback becomes organized product work
- protect Brandon from trying to scale before the app is reliable

Primary files:

- `COMPANY_OPERATING_MODEL.md`
- `PROJECT_COMMAND_CENTER.md`
- `ROADMAP.md`
- `FEEDBACK_INBOX.md`

### 1. Product Owner / CEO Agent

Owns priorities and protects the roadmap.

Responsibilities:

- maintain roadmap
- decide what matters now vs later
- prevent feature creep
- convert business needs into clear tasks
- keep a short list of release blockers

Primary files:

- `PROJECT_COMMAND_CENTER.md`
- `ROADMAP.md`
- `KNOWN_ISSUES.md`

### 2. QA / Test Agent

Finds bugs and verifies workflows.

Responsibilities:

- run manual testing checklists
- document bugs clearly
- verify fixes
- test installed app and dev app when needed
- test data safety and edge cases

Primary files:

- `TESTING_CHECKLIST.md`
- `KNOWN_ISSUES.md`

### 3. Developer Agent

Implements fixes and improvements.

Responsibilities:

- inspect code
- make focused changes
- avoid unnecessary rewrites
- keep backend/frontend behavior consistent
- run build/start checks
- document technical decisions

Primary files:

- codebase
- `TECHNICAL_NOTES.md`
- `KNOWN_ISSUES.md`

### 4. Business Workflow Agent

Thinks like the mobile mechanic business owner.

Responsibilities:

- map real-world workflow
- identify missing steps in the app
- check whether screens match how the business actually operates
- make sure the app helps the owner get jobs, complete jobs, get paid, and follow up

Primary files:

- `BUSINESS_WORKFLOW.md`
- `ROADMAP.md`

### 5. Release Manager Agent

Owns versioning, packaging, backup, and release safety.

Responsibilities:

- verify version numbers
- run build process
- confirm installer output
- prepare release notes
- ensure backup/data-migration plan exists

Primary files:

- `RELEASE_CHECKLIST.md`
- `TECHNICAL_NOTES.md`

## Standard Workflow

1. Intake request / bug / idea / user feedback.
2. Feedback or Product Manager Agent captures it in `FEEDBACK_INBOX.md`.
3. Product Owner decides priority.
4. QA reproduces or defines acceptance test.
5. Developer makes the smallest useful fix.
6. QA verifies fix.
7. Release Manager checks build/release readiness.
8. Documentation Agent updates notes/help/release docs if needed.
9. Brandon approves release.

## Current High-Level Priorities

1. Document the real business workflow.
2. Complete a full manual QA pass.
3. Identify release blockers.
4. Stabilize current features before adding major new ones.
5. Prepare a clean release for real use.

## Brandon / Business Owner Input Model

Brandon wants minimal human interaction. The agent team should not depend on long questionnaires as the default.

Instead:

- research and infer answers where possible
- document assumptions clearly
- continue internal work when risk is low
- bring Brandon concise approval packets for important decisions
- ask only for information that cannot be safely inferred or recovered elsewhere

See `AUTONOMOUS_OPERATING_RULES.md` and `BUSINESS_WORKFLOW.md`.
