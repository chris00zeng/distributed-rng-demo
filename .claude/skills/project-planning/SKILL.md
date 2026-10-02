---
name: project-planning
description: Turn requirements and rough plans into three linked planning docs (a Product Requirements Doc, a Technical Plan and a Dev Plan), written in that order with the user's approval between each, and keep them in sync as the project changes. Use this skill whenever the user asks for a PRD, product requirements, tech plan, technical design, dev plan, implementation plan, PR breakdown, roadmap or milestones, or wants to "flesh out", "formalize" or "turn this into a plan". Also use it during implementation whenever a requirement, design or scope decision changes, a PR lands or is re-scoped, or the code diverges from what plans/ says, even if the user doesn't mention the plan docs, because they must stay current.
---

# Project Planning

This skill produces three documents, each building on the one before it:

| Doc | File | Answers | Audience |
|---|---|---|---|
| Product Requirements Doc | `plans/PRD.md` | *What* are we building, for whom, and how do we know it's done? | Anyone, no code knowledge needed |
| Technical Plan | `plans/TECH_PLAN.md` | *How* does it work? Architecture, data, algorithms, risks | Engineers |
| Dev Plan | `plans/DEV_PLAN.md` | In *what order* do we build it? PRs, milestones, verification | Whoever implements it, human or AI |

Each doc builds only on the docs above it. A PRD that names libraries, or a Dev Plan that adds features, puts the layers out of order, and that makes later changes hard to trace. Keep each doc at its own level.

If the project already keeps plans somewhere other than `plans/`, use that location. Otherwise use `plans/`.

## Part 1: Writing the docs

### Step 0: Gather sources

Read everything before writing anything:
- The requirements source, such as a spec, a ticket or a brief. These are the **hard constraints**.
- Any existing plan, brainstorm or notes. These record **decisions already made**. Treat them as the user's intent, not as suggestions to re-open.
- The current code and git history, if there is any.

Separate the sources in your head. The external requirements say what the project *must* do. The user's notes say what they've *chosen* to do. Your additions are proposals. Every doc should make clear which of the three each item is, because reviewers, including the user, need to see where decisions came from.

### Step 1: PRD, then stop for approval

Write `plans/PRD.md` using the template in `references/templates.md`. Key points:
- **Every requirement gets a stable ID** (`R1`, `R2`, …) and a priority. Use P0 (must ship), P1 (should ship) or P2 (stretch). The later docs cite these IDs, so a change can be traced through all three.
- **Acceptance criteria must be observable.** Write "A first-time user can complete checkout in under 2 minutes without help", not "checkout is easy".
- **Non-goals are as important as goals.** If the source mentions a time budget, the priority tiers must fit inside it. Say what gets cut first.
- **Trace external constraints.** Every hard requirement from the source document should map to at least one R-ID. Add a short traceability table at the end.

Then **stop**. Don't start the Technical Plan in the same turn. Present the PRD for approval as described in "Approval gates" below.

### Step 2: Technical Plan, then stop for approval

Only after the user has explicitly approved the PRD, write `plans/TECH_PLAN.md`. Key points:
- Tag every component or section with the R-IDs it satisfies. A component that serves no requirement is either scope creep or a missing requirement. Ask which.
- Record each significant choice as a decision, with the options considered and why this one won. Give each decision an ID (`D1`, `D2`, …).
- Call out correctness risks explicitly, and say how each one will be verified (tests, property checks, reference vectors). This matters most in areas where a subtle bug destroys credibility, such as crypto, concurrency or money.
- Include enough interface detail, such as types, module boundaries and message formats, for the Dev Plan to split the work into independent PRs.

Stop again for approval.

### Step 3: Dev Plan, then stop for approval

Only after the Technical Plan is approved, write `plans/DEV_PLAN.md`. Key points:
- Break the work into **PRs**. Each PR is a reviewable, independently mergeable unit that leaves the app working. For each one, give its goal, the R-IDs and D-IDs it covers, its scope, how to verify it and a time estimate.
- **Order by risk and value, not by layer.** Put a thin, end-to-end slice that validates the core idea first. If there's a "kill or commit" checkpoint, make it an explicit milestone.
- Make sure the time estimates add up and fit the budget, with the P0 work fitting comfortably. If they don't fit, say so and propose cuts. Don't quietly shrink the estimates.
- Track status with a checkbox per PR, so the Dev Plan doubles as a progress tracker.

Stop for approval.

### Step 4: Retire superseded plans

Once all three docs are approved, check whether any earlier rough plan or notes file is now fully absorbed. For every substantive item in it, find where it now lives, or note that it was deliberately dropped and why. Show the user that mapping. Delete the old file only after they confirm, because deleting it is hard to undo.

## Approval gates

The user wants to steer, not rubber-stamp. At each gate:
1. Write the doc to disk. Set its header to `Status: Draft`.
2. Reply in chat with a **short** summary, not the full doc. Cover:
   - the 3–5 most important things the doc commits to
   - anything you **added or changed** relative to the user's existing notes, and why
   - **open questions** that need the user's call, phrased as concrete choices with your recommendation
3. Ask for approval or changes, then wait.
4. Apply any requested edits, then set the header to `Status: Approved (YYYY-MM-DD)`. Approval of one doc is not approval of the next.

Don't settle judgment calls on the user's behalf. If you find yourself picking between two reasonable product or design options, put the choice in the open questions instead of choosing silently. When a choice has no real tradeoff, make it and mention it.

## Part 2: Keeping docs in sync during implementation

Plans that drift from reality are worse than no plans. Whenever something changes during implementation, update the docs **in the same change**: the same commit or PR as the code, never "later".

**Cascade from the highest affected layer down:**
- If a requirement or scope changed (new feature, cut feature, changed priority), update the PRD. Then check whether the Technical Plan and Dev Plan sections citing that R-ID still hold.
- If a design changed (new library, different algorithm, interface change) but the requirements are untouched, update the Technical Plan and its decision record. Then check the Dev Plan.
- If only the execution changed (a PR was split, merged, re-ordered, finished or re-estimated), update the Dev Plan.

**Changes to a document that's already approved need the user's sign-off.** You may correct typos or tick off finished PRs without asking. A change to what the product does, or a reversal of a recorded decision, should be proposed to the user before it is written in. Don't edit an approved doc silently to match code that has drifted. Drift is a signal that someone made a decision; surface it.

**Record every change.** Each doc ends with a `## Changelog` section. Add a dated one-line entry per meaningful change, saying what changed and why, for example `2026-10-03: Moved R7 (export to CSV) to P2 after PR3 ran 40 min over`. For a superseded decision in the Technical Plan, mark it as superseded and keep it. Don't delete it, because the history of tradeoffs is part of the record.

**Signs that you should check the docs** (do it even if the user doesn't mention them):
- The user says "actually, let's…", "skip X", "add Y" or "change how Z works".
- You're about to implement something that isn't in the Dev Plan, or in a different way than the Technical Plan describes.
- A PR is finished, so tick it off and record actual versus estimated time.
- The time spent is noticeably over the estimate, so re-check whether the remaining plan still fits the budget.

## Writing style for the docs

- Be concise and specific. Use tables for requirements, decisions and PRs, and prose only where you need to explain reasoning.
- Write so that a reader skimming headings and tables gets 80% of the content.
- Say "TBD" rather than invent detail. Track TBDs under the open questions.
- Use Markdown that renders on GitHub. These docs are likely to be read by reviewers in the repo.

See `references/templates.md` for the skeleton of each doc.
