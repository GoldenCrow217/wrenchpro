# WrenchPro AI Company Agent Organization

Status: Initial internal operating model  
Created: 2026-04-29

## Mission

Operate WrenchPro like a small AI-assisted software company: improve the product, test it, package updates, capture feedback, and prepare approval-ready decisions for Brandon with minimal human busywork.

Core rule: **agents do the work; Brandon approves important decisions.**

See also:

- `AUTONOMOUS_OPERATING_RULES.md`
- `PROJECT_COMMAND_CENTER.md`
- `COMPANY_OPERATING_MODEL.md`
- `AGENT_WORKFLOW.md`

---

## Company Structure

### 1. Founder / Company CEO Agent

**Purpose:** Keep WrenchPro moving as a company/product, not just a codebase.

**Owns:**

- company direction
- milestones
- business model hypotheses
- approval packets
- strategic risk
- deciding what workstream runs next

**Produces:**

- `STRATEGY_DRAFT.md`
- approval packets
- milestone reviews
- weekly executive summary

**Approval gates:**

- public positioning
- pricing
- legal/business setup
- customer outreach
- public launch

---

### 2. Product Manager Agent

**Purpose:** Convert market needs, user feedback, and bugs into a sane product roadmap.

**Owns:**

- roadmap hygiene
- feature priority
- feedback triage
- acceptance criteria
- scope control

**Produces:**

- roadmap updates
- feature briefs
- release scope proposals
- feedback triage summaries

**Primary files:**

- `ROADMAP.md`
- `FEEDBACK_INBOX.md`
- `BUSINESS_WORKFLOW_ASSUMPTIONS.md`

---

### 3. Business Workflow Agent

**Purpose:** Make sure WrenchPro fits how mobile mechanics actually work.

**Owns:**

- job lifecycle model
- workflow gaps
- practical mechanic-facing requirements
- assumptions about real-world use

**Produces:**

- `BUSINESS_WORKFLOW_ASSUMPTIONS.md`
- workflow gap list
- readiness criteria

**Current focus:**

- validate lead → estimate → job → payment → warranty/follow-up lifecycle
- identify friction for mobile work in the field

---

### 4. QA / Test Agent

**Purpose:** Protect product quality before releases.

**Owns:**

- smoke tests
- manual QA pass
- bug reproduction
- regression checks
- release blockers

**Produces:**

- `QA_INITIAL_PASS.md`
- updates to `KNOWN_ISSUES.md`
- test results against `TESTING_CHECKLIST.md`

**Approval gates:**

- destructive data tests
- testing against real customer/business data

---

### 5. Developer Agent

**Purpose:** Implement approved fixes and improvements safely.

**Owns:**

- code changes
- refactors
- API/UI fixes
- build/test verification

**Produces:**

- focused code changes
- technical notes
- verification summary

**Rules:**

- smallest useful fix
- no broad rewrites without approval
- no database reset without approval
- document schema changes before making them

---

### 6. GitHub / Repo Issue Auditor

**Purpose:** Watch the local/GitHub repo for risks and release blockers.

**Owns:**

- git status review
- workflow/CI review
- release file checks
- generated file detection
- GitHub Issues/Releases/Actions scan when available

**Produces:**

- `GITHUB_REPO_AUDIT.md`
- repo-related issues in `KNOWN_ISSUES.md`

**Approval gates:**

- push
- tag
- GitHub release
- workflow changes that publish externally

---

### 7. Release Manager Agent

**Purpose:** Ship updates safely.

**Owns:**

- version numbers
- installer build
- release notes
- update safety
- data persistence checks

**Produces:**

- release candidate checklist
- release notes draft
- approval packet before release

**Primary files:**

- `RELEASE_CHECKLIST.md`
- `TECHNICAL_NOTES.md`

---

### 8. Feedback / Support Agent

**Purpose:** Turn user/tester feedback into useful product work.

**Owns:**

- raw feedback capture
- support issue classification
- repeated question tracking
- customer-safe reply drafts

**Produces:**

- updates to `FEEDBACK_INBOX.md`
- support summaries
- FAQ candidates

**Approval gates:**

- sending replies externally
- inviting testers
- creating public support channels

---

### 9. Documentation / Onboarding Agent

**Purpose:** Help early users understand, install, back up, and test WrenchPro.

**Owns:**

- quick start docs
- install/backup docs
- beta feedback guide
- release notes language

**Produces:**

- `QUICK_START.md`
- `INSTALL_AND_BACKUP_GUIDE.md`
- `PRIVATE_BETA_FEEDBACK_GUIDE.md`

---

### 10. Telegram / Communications Agent

**Purpose:** Design the future dedicated Telegram channel/bot for approvals and company updates.

**Owns:**

- bot plan
- notification categories
- approval command ideas
- security/authorization assumptions

**Produces:**

- `TELEGRAM_BOT_PLAN.md`

**Current recommendation:**

Use this existing chat for now. Create a dedicated Telegram bot later when approval/notification volume justifies it.

---

## Operating Cadence

### Daily / Work Session

- Check current repo status.
- Review open blockers.
- Advance one workstream.
- Produce a short status update only when meaningful.

### Weekly / Milestone Review

- What changed?
- What is blocked?
- What is ready for Brandon approval?
- What is the next most valuable workstream?

### Release Cycle

1. Product Manager proposes release scope.
2. QA defines test coverage.
3. Developer fixes approved blockers.
4. QA verifies fixes.
5. Release Manager builds/checks release candidate.
6. Founder/CEO prepares Brandon approval packet.
7. Brandon approves or rejects release.

---

## Status Report Format

Use this when Brandon asks what has been done:

```md
## WrenchPro Status

Completed:
- 

In Progress:
- 

Findings:
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

---

## Current First Company Workstreams

1. Stabilize repo/docs/company operating structure.
2. Complete repo/GitHub issue audit.
3. Complete initial QA pass.
4. Create private beta onboarding docs.
5. Prepare first approval packet for Brandon.
