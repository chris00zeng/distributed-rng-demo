# Plan Doc Templates

These are skeletons, not forms to fill in. Drop sections that don't apply, and add sections the project needs. Keep the ID schemes (R/D/PR) and the header and changelog conventions, because the sync process depends on them.

## Contents
- [PRD](#prd)
- [Technical Plan](#technical-plan)
- [Dev Plan](#dev-plan)

---

## PRD

```markdown
# <Product name> — Product Requirements

Status: Draft | Approved (YYYY-MM-DD)
Sources: <links to requirements doc, brainstorm notes>
Related: [Technical Plan](TECH_PLAN.md) · [Dev Plan](DEV_PLAN.md)

## Summary
2–4 sentences: what it is, who it's for, why it matters.

## Problem & context
What's hard or interesting here, and what constraints we're operating under
(time budget, deployment, audience).

## Users & scenarios
Who uses it and the 1–3 core journeys, written as short narratives
("A new user lands on the home page, …").

## Goals / Non-goals
- Goals: outcomes, not features.
- Non-goals: things a reader might expect that we're deliberately not doing, and why.

## Requirements
| ID | Requirement | Priority | Acceptance criteria | Source |
|----|-------------|----------|---------------------|--------|
| R1 | …           | P0       | observable check    | External / User decision / Proposed |

## Experience & content
Key screens, interactions or narrative beats at the product level (no
implementation). Include copy or tone notes if they matter.

## Success criteria
How we'll judge the finished thing as a whole.

## Scope vs. budget
Which priority tiers fit in which time budget; what gets cut first.

## Risks (product)
Risks to the product succeeding (confusing, boring, off-theme), not technical risks.

## Open questions
- [ ] Q1: <choice> — options A / B, recommend A because …

## Traceability
| External requirement | Covered by |
|----------------------|------------|

## Changelog
- YYYY-MM-DD: Initial draft.
```

---

## Technical Plan

```markdown
# <Product name> — Technical Plan

Status: Draft | Approved (YYYY-MM-DD)
Implements: [PRD](PRD.md) (approved YYYY-MM-DD)
Related: [Dev Plan](DEV_PLAN.md)

## Overview
One paragraph plus an architecture diagram (ASCII or Mermaid).

## Stack & hosting
| Choice | Why | Alternatives considered |

## Architecture
Components and their responsibilities, each tagged with the R-IDs it serves.

## Data model & interfaces
Key types, module boundaries, message formats, as signatures or TypeScript
interfaces where helpful.

## Core algorithms
Detailed enough to implement and to review for correctness.

## Decisions
| ID | Decision | Options considered | Rationale | Status |
|----|----------|--------------------|-----------|--------|
| D1 | …        | …                  | …         | Active / Superseded by Dn |

## Correctness & verification
Risk → how it's verified (unit tests, property tests, known-answer vectors,
manual checks).

## Technical risks
| Risk | Likelihood | Impact | Mitigation |

## Open questions

## Changelog
```

---

## Dev Plan

```markdown
# <Product name> — Dev Plan

Status: Draft | Approved (YYYY-MM-DD)
Implements: [PRD](PRD.md) · [Technical Plan](TECH_PLAN.md)

## Strategy
How the work is ordered and why (e.g. validate the core idea first, then
build out). Name any go/no-go checkpoint.

## Milestones
| Milestone | PRs | Exit criteria | Budget |

## PRs
### PR1 — <title>  `[ ]`
- **Goal:** one sentence
- **Covers:** R1, R3 · D2
- **Scope:** bullet list of what's in (and notably out)
- **Verify:** how the reviewer and the author confirm it works
- **Estimate:** 30 min · **Actual:** —

(repeat per PR)

## Budget check
| Tier | PRs | Estimated total | Fits budget? |

## Deliverables outside code
Deployment, docs, demos and other non-code deliverables: each with an owner
and the point in the plan where it happens.

## Changelog
```
