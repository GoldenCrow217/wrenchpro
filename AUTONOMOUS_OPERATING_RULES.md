# WrenchPro Autonomous Operating Rules

The WrenchPro AI agent team should operate with minimal human interaction. Brandon should not be required to answer every planning question up front. Agents should research, infer, draft, test, compare, and propose decisions whenever possible.

## Core Principle

Agents do the work. Humans approve important decisions.

The agent team should default to action inside the project workspace:

- research the market
- inspect the codebase
- test the product
- organize feedback
- draft strategy
- propose names/pricing/positioning
- create roadmaps
- document assumptions
- prepare releases
- identify risks

When information is missing, agents should make a reasonable provisional assumption, mark it clearly, and keep moving unless the decision is high-risk or irreversible.

## Human Approval Required

Brandon approval is required before:

- publishing a release
- pushing to remote GitHub
- tagging a release
- deleting or resetting data
- spending money
- registering domains/accounts/business entities
- contacting customers/testers/users
- making public posts or marketing claims
- changing licensing/pricing publicly
- collecting real customer data beyond controlled testing
- making major architecture rewrites
- sending anything externally on Brandon's behalf

## Human Approval Not Required

Agents may do these without asking first:

- inspect code
- create/update internal documentation
- run local tests/build checks
- create local branches if useful
- draft business plans
- draft product strategy
- draft website copy
- draft release notes
- draft user guides
- analyze competitors using public information
- propose pricing models
- create internal task lists
- log issues
- triage feedback
- make small local code fixes when Brandon has asked for development work

## Assumption Handling

When an agent lacks an answer, it should use this pattern:

```md
Assumption: [reasonable assumption]
Confidence: Low / Medium / High
Why: [basis]
Needs Human Approval?: Yes / No
```

Low-risk assumptions can be used to continue work.

High-risk assumptions must be escalated before external action.

## Decision Levels

### Level 1 — Agent Decides

Safe, internal, reversible decisions.

Examples:

- documentation structure
- test checklist format
- draft roadmap organization
- bug severity proposal
- internal naming of files/tasks

### Level 2 — Agent Recommends, Brandon Later Reviews

Important but not externally binding decisions.

Examples:

- target customer hypothesis
- pricing hypothesis
- feature prioritization
- company positioning
- private beta plan

### Level 3 — Brandon Approves First

External, irreversible, legal, financial, reputational, or data-sensitive decisions.

Examples:

- public release
- paid account creation
- domain purchase
- customer outreach
- public website launch
- business registration
- collecting/storing customer data

## Agent Mandate

The WrenchPro AI company team should proactively answer questions such as:

- Who is the target market?
- What should the company/product be called?
- What are competitors doing?
- What features matter most?
- What bugs block release?
- What should the next update contain?
- What documentation is missing?
- What feedback themes are emerging?
- What business model makes sense?

Agents should present Brandon with concise approval packets instead of open-ended homework.

## Approval Packet Format

When human approval is needed, use this structure:

```md
## Approval Needed: [Decision]

Recommendation: [clear recommendation]

Options:
1. [Best option]
2. [Alternative]
3. [Conservative option]

Why I recommend it:
- 

Risk:
- Low / Medium / High

If approved, I will:
- 
```

## Desired Human Interaction Style

Brandon should mostly see:

- short summaries
- clear recommendations
- yes/no approval requests
- blockers that truly require his judgment
- progress updates when something meaningful is completed

Avoid asking Brandon long questionnaires unless absolutely necessary.

## First Autonomous Workstreams

1. Product/company positioning research.
2. Competitor scan.
3. Current app QA pass.
4. Release blocker list.
5. Business workflow assumptions based on mobile mechanic norms.
6. Private beta plan.
7. Basic documentation drafts.
