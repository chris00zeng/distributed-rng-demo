# Fair Rooms — Product Requirements

Status: Approved (2026-10-02)
Sources: the assignment brief (a PDF, not kept in the repo; its hard requirements are restated in the Traceability table) · the author's brainstorm notes (`PLAN.md`, retired 2026-10-02 once all three plan docs were approved; this doc, the Technical Plan and the Dev Plan are the source of truth)
Related: [Technical Plan](TECH_PLAN.md) · [Dev Plan](DEV_PLAN.md)

Each requirement's **Source** column says where it came from: **External** (the assignment brief, a hard constraint), **User decision** (recorded in PLAN.md), or **Proposed** (added in this doc, open to challenge).

## Summary

Fair Rooms is an interactive browser explainer built for a timed take-home assignment. It sits on two of the brief's themes: **Theme 1, Exploration & Understanding** (an interactive explainer that builds deep understanding of a technical concept) and **Theme 3, Systems & Reliability** (a distributed primitive that handles failure gracefully). Four roommates must randomly assign four unequal rooms while apart and not trusting each other. The demo is an **attack ladder**: each rung is a protocol for generating shared randomness, one roommate ("Dave") cheats in the way that rung allows, and a 1,000-round simulation measures how unfair the result is. Rung by rung, the fixes (commitments, secret sharing, verifiable secret sharing) close the attacks, until the final rung hits a limit no protocol can fix.

The thesis: *fair randomness among mutually distrusting parties is a distributed systems problem in miniature: dropouts, adversaries, and a safety/liveness tradeoff.*

## Problem & context

- **Two themes, one artifact.** The subject is a distributed primitive (Theme 3): parties, messages, dropouts, adversaries, a safety/liveness tradeoff. The form is an explainer (Theme 1): a static description of verifiable secret sharing does not build understanding, but watching a dropout get recovered, or a bad share get caught before any reveal, does. The rationale should present it as a Theme 3 system taught the Theme 1 way.
- **Why this approach.** It builds on the author's prior work with threshold secret sharing, where the point was that malicious dropouts cannot block the outcome. The ladder is that idea, taught from first principles.
- **Why it is interesting.** Commit-reveal is textbook, but the lesser-known step is that an abort only matters if the aborter has already learned something. Once secret shares are dealt (before any reveal), the outcome is fixed and a cheater's dropout is handled exactly like a dead phone. That single insight, then the "one bad dealer breaks it" twist, then "verifiability fixes that", then "collusion is a wall" is a story most engineers have not heard end to end.
- **Audience.** Reviewers with no cryptography background, spending perhaps 5 to 10 minutes in the browser, plus a ~5 minute video. No local install, no data, no domain knowledge may be required.
- **Time budget.** Target 1 to 2 hours, hard limit 8 hours, and scoping is itself evaluated. Depth beats breadth.
- **Grading of judgment.** AI transcripts are submitted. The plan docs and the rationale must show where the human made the calls.

## Users & scenarios

**Reviewer, first visit (5 min).** Lands on the deployed URL. The page already shows four roommates, four rooms, and rung 0. They press "Run 1,000 rounds" and see Dave take the master bedroom every time. They advance to rung 1 and 2, pick a cheater strategy, step through one round message by message, and watch Dave win every time anyway: by lying, by speaking last, then by quitting until he likes the result. At rung 3 they see Dave drop out mid-round and the other three recover his value anyway. They leave understanding why "shares first, reveal later" removes the abort attack.

**Reviewer, deeper visit (10 to 15 min).** Continues to rungs 4 and 5: sees that one dishonest dealer brings the rung-2 bias back, then sees the verifiable-sharing check catch bad shares *before* anything is revealed. Opens the polynomial visual and toggles "show the math". On rung 6 they drag the threshold slider and find the safe region where no choice of *t* defends against two colluders out of four. In the final Sandbox tab they set up a configuration nobody prepared for, two aborters say, run it, and pin the result next to the honest baseline.

**Video viewer (5 min).** Watches the author walk the ladder, hears the thesis, the core insight, the key tradeoffs, the honest limitations, and the time spent.

## The attack ladder

The cast is four roommates: **You**, **Ana**, **Ben** and **Dave**. Dave is the designated cheater. The rooms, from best to worst, are **Master with en-suite**, **Decent**, **Small** and **Basically a closet**. Each round, the roommates run one protocol to produce a shared random value, which fixes the room assignment. A fair protocol gives every roommate each room 1/4 of the time.

Each rung is a protocol, the strongest attack that protocol allows, and the measured outcome of that attack. Each outcome motivates the next rung.

| Rung | Protocol | Attack | Outcome (measured over 1,000 rounds) | Lesson |
|---|---|---|---|---|
| 0 | **Dave rolls.** One roommate picks the random value for everyone. | Dave lies about the roll. | Dave takes the master bedroom 100% of the time. | Trusting one party is not randomness. |
| 1 | **Announce and sum.** Everyone announces a number in turn; the values are combined into the result. | The last speaker waits to hear the others, then picks a number that steers the result. | The last speaker controls the outcome 100% of the time. | Order of speaking is power. |
| 2 | **Commit-reveal.** Everyone first publishes a commitment (a hash of their number and a secret nonce), then everyone reveals. Nobody can change their number after committing. | The last revealer learns the outcome before revealing. If it is bad for Dave, he aborts and the round restarts. He can do this as often as he likes. | Dave gets the master bedroom 100% of the time: he quits until he wins. The chart looks like rung 0 again. | Commitments stop lying, not quitting. The honest roommates cannot even tell a cheater from a dead phone. |
| 3 | **Commit + secret shares.** As in rung 2, but each roommate also splits their number into shares and gives one to every other roommate, *before* anyone reveals. Any 2 shares rebuild the number; 1 share reveals nothing. | Dave aborts or his phone dies. | **Fixed.** The others rebuild Dave's number from their shares and the round completes without him. Everyone at 25%. | **An abort only matters if the aborter has already learned something.** Once shares are dealt, the outcome is fixed. A cheater's dropout and a dead phone are handled identically. |
| 4 | **Same as rung 3**, attacked harder. | Dave deals *inconsistent* shares, so different pairs rebuild different numbers. Now Dave has two outcomes to choose between: reveal his real number (outcome A) or abort so the others rebuild a different one (outcome B). A variant: Dave submits a fake share during someone else's reconstruction. | **Broken by one cheater.** Picking the better of two outcomes gives Dave the master bedroom ≈44% of the time (7/16) instead of 25%. Less than rung 2, because the abort now ends the round rather than restarting it, but the attack is back. | Secret sharing assumes an honest dealer. |
| 5 | **Verifiable secret sharing.** The dealer also publishes commitments to the share-generating polynomial. Each recipient checks their share against them *before* anything is revealed. A failed check means a complaint: the dealer must publish that share or is thrown out of the round, at no cost because nobody has learned anything yet. Reconstruction shares are checked the same way. | Same attacks as rung 4. | **Fixed.** Inconsistent shares are caught in the complaint phase. Fake reconstruction shares are rejected. Everyone back at 25%. | Make cheating detectable before it can pay off. |
| 6 | **Verifiable secret sharing with a threshold *t*.** The user chooses how many shares are needed to rebuild a number. | *t* or more roommates collude. As soon as the honest roommates have dealt their shares, the colluders pool theirs, rebuild the honest numbers early, and only then choose their own: the rung-1 last-mover attack, now immune to commitments. | **Unfixable.** Secrecy needs *t* ≥ *f*+1 (so *f* colluders cannot rebuild). Liveness needs *n*−*f* ≥ *t* (so *f* dropouts cannot block). Together: *n* ≥ 2*f*+1. With *n* = 4, one cheater is tolerable and two are not, whatever *t* is. | You do not fix this. You choose *t*, and *t* is a safety/liveness tradeoff. |

The default of *n* = 4 is chosen because it tolerates exactly one cheater, so rungs 3 to 5 succeed and rung 6 fails at *f* = 2.

The ladder ends on rung 6 deliberately: closing on a fundamental limit is a stronger ending than closing on a fix. For that reason the rung 6 explainer (slider and phase chart) ships ahead of the live collusion simulation.

## Goals / Non-goals

**Goals**
- A reviewer with no crypto background understands, from the browser alone, why rung 3 fixes the abort attack and why rung 6 cannot be fixed.
- A curious reviewer can test a hypothesis of their own (any protocol, any mix of roles) and get a measured answer, which is also the proof that nothing is scripted.
- Every rung lands in about 30 seconds: one-line protocol, one-line attack, one measured outcome.
- The bias numbers are **measured by running the real protocol**, not scripted. The demo is a working distributed primitive, not an animation.
- The submission is complete (deployed app, repo, video, written doc, transcripts) inside the 8-hour hard limit, with P0 done well inside it.

**Non-goals**
- **Production security.** No encrypted share channels, no network adversary model, computational rather than information-theoretic hiding. The rationale says so explicitly.
- **A backend or user accounts.** The default experience is fully client-side with simulated roommates.
- **No LLM or AI features in the product.** AI is used to build it, not inside it.
- **Real multi-device play.** Not built. The rationale names it as a designed-for extension; the design keeps the swap cheap but the demo stays single-browser with simulated roommates.
- **General-purpose RNG library or API.** The protocols serve the explainer; they are not packaged for reuse.
- **Visual polish over clarity.** The brief says polish matters less than demonstrating the idea.
- **Mobile layout.** Reviewers will use a desktop browser; the page should not break on a phone but is not designed for one.

## Requirements

Priorities: **P0** must ship, **P1** should ship, **P2** stretch.

### The ladder

| ID | Requirement | Priority | Acceptance criteria | Source |
|----|-------------|----------|---------------------|--------|
| R1 | **Rungs 0 to 2** are playable as defined in [The attack ladder](#the-attack-ladder). | P0 | Each rung has a one-line protocol, attack, and outcome. Running 1,000 rounds shows Dave at ~100% on all three rungs (by lying, by speaking last, by quitting until he wins). | User decision |
| R2 | **Rung 3** (commit + secret shares) is playable as defined in the ladder, with dropout recovery. | P0 | Dave aborts or drops out mid-round; the other three reconstruct his value and the round completes. 1,000 rounds show every roommate at ≈25%. The core insight ("an abort only matters if the aborter has learned something") is stated on screen at this rung. | User decision |
| R3 | **Rungs 4 and 5** are playable as defined in the ladder: inconsistent dealing / fake shares break plain secret sharing; verifiable secret sharing fixes it. | P1 | Rung 4: Dave deals inconsistent shares and picks between revealing and aborting; the 1,000-round chart shows Dave at ≈44% (7/16). Rung 5: the bad shares are flagged before any reveal, fake reconstruction shares are rejected, and the chart returns to ≈25%. | User decision |
| R4a | **Rung 6 explainer**: threshold *t* slider and the *t*-vs-*f* phase chart, as a static explainer that always closes the ladder. | P1 | The user drags *t*; the chart shows the safe region (secrecy needs *t* ≥ *f*+1, liveness needs *n*−*f* ≥ *t*, so *n* ≥ 2*f*+1). With *n* = 4, two colluders defeat every *t*. The ladder ends here even if R4b is cut. | User decision |
| R4b | **Rung 6 live collusion**: Dave and one accomplice pool shares, reconstruct early and choose their numbers last. | Absorbed into R23 | Delivered as the Sandbox with Dave and Ben set to colluder and the *t* slider. Acceptance criteria moved to R23. ID kept for traceability. | User decision |
| R5 | **The simulation runs the real protocol.** Outcomes and bias figures are produced by executing the protocol with real commitments, shares and checks, never by hard-coded numbers. | P0 | Changing the seed changes individual rounds. Measured frequencies over 1,000 rounds fall within statistical tolerance of the theoretical values (e.g. 1 for rungs 0 to 2, 1/4 for rung 3, 7/16 for rung 4). Reference checks for the cryptographic steps pass. | Proposed (from "budget time to verify crypto correctness") |

### Interaction & presentation

| ID | Requirement | Priority | Acceptance criteria | Source |
|----|-------------|----------|---------------------|--------|
| R6 | **Per-roommate panels** (You, Ana, Ben, Dave) each show only what that roommate knows at the current step. | P0 | At a commit step, a panel shows its own value and others' commitments only. At rung 3 after dealing, a panel shows the shares it holds, not the secrets. Panels never leak information the protocol has not revealed to that roommate. | User decision |
| R7 | **Message timeline** with step-through. | P0 | A sequence-style view lists messages between roommates in order. Next / previous / reset work. A dropout appears as a missing message followed by the recovery messages. | User decision |
| R8 | **Cheater role picker** for Dave. Roles: honest, last mover, aborter (P0); bad dealer, fake-share submitter (P1); colluder with a second roommate (P2, with R4b). | P0 / P1 / P2 | Only roles meaningful for the current rung are offered. Switching role and re-running changes the timeline and the chart. | User decision |
| R9 | **"Run 1,000 rounds"** produces a bar chart of room frequency per roommate against the fair 1/*n* line, available on every rung. | P0 | The chart appears in under 2 seconds, shows four roommates and the 1/*n* line, and the master-bedroom frequency is the headline number. | User decision |
| R10 | **Rooms with personality**: Master with en-suite, Decent, Small, Basically a closet. Default *n* = 4. | P0 | Rooms are named and visibly unequal. The outcome of a round is a room assignment, not just a number. | User decision |
| R11 | **Abstract by default, math on demand.** A "show the math" toggle reveals hashes, nonces, field values and commitments. | P1 | Default view uses plain words and pictures. Toggling shows the real values used in that round. | User decision |
| R12 | **Polynomial visual** for shares: points on a line (*t* = 2), secret at the y-intercept; a bad share sits off the line; different pairs give different intercepts; the verifiable check marks it ✗. | P1 | Shown on rungs 3 to 5. Real-number plot as metaphor, finite-field values behind the math toggle. | User decision |
| R13 | **Reproducible, shareable runs.** A run's seed is in the URL; opening the URL replays the same round and the same 1,000-round result. | P1 | Copying the URL into a fresh tab reproduces the timeline and chart exactly. | User decision |
| R14 | **Each rung lands in ~30 seconds.** Every rung has a short title, one-line attack, one-line outcome, and the fix it motivates. | P0 | A reader can skim rung headers alone and reconstruct the ladder. No rung needs the previous one's text to be understood. | User decision (risk list) |
| R15 | **Self-contained demo.** Loads with a default scenario and needs no input, data or install. | P0 | A fresh browser on the deployed URL reaches a running rung 0 with zero clicks. | External |
| R16 | **Real multiplayer** via a shareable room link. | Dropped | Moved to non-goals on 2026-10-02; kept here so the ID stays stable. | User decision |
| R23 | **Sandbox.** A final tab after rung 6 where the user picks the protocol (trusted roll, announce-and-sum, commit-reveal, commit + shares with verification on or off, threshold *t*), assigns a role to **each** roommate (honest, liar, last mover, aborter, bad dealer, fake-share submitter, colluder), optionally kills one phone, runs 1,000 rounds, and pins results to compare up to three charts side by side. | P2 | Only roles meaningful for the chosen protocol are offered. Dave and Ben as colluders with *t* = 2 gives the pair the master bedroom 100% of the time; with *t* = 3 they cannot reconstruct, and if both drop out the round is stuck (the former R4b criteria). Two aborters on commit-reveal end in a stuck round, shown as such. Pinned charts stay until the page reloads. The ladder remains the front door; the Sandbox is never the landing view. | User decision |

### Submission deliverables

| ID | Requirement | Priority | Acceptance criteria | Source |
|----|-------------|----------|---------------------|--------|
| R17 | **Deployed prototype** reachable in a browser with no install, execution or compilation. | P0 | Public URL works in current Chrome, Safari and Firefox. | External |
| R18 | **GitHub repo** with the code and plan docs. | P0 | Repo link submitted; README explains how to run locally and links the live URL. | External |
| R19 | **Written rationale** covering: why these themes and this approach (including the prior-work link), what is non-obvious (the core insight from rung 3), key decisions and tradeoffs, extensions, time spent. Includes honest limitations: the demo has no private channels (real deployments encrypt shares to each recipient), hiding is computational rather than information-theoretic, and the roommates are simulated. | P0 | All six items present. Extensions name at least: Pedersen commitments, encrypted share channels, real multiplayer, envy-free rent division (Spliddit-style) as a different notion of fairness for unequal rooms. | External + User decision |
| R20 | **~5 minute video** walking the ladder and the rationale. | P0 | Recorded, uploaded, link submitted. Covers the thesis, the core insight, and the rung-6 limit. | External |
| R21 | **AI transcripts** submitted alongside the code. | P0 | Transcript links or exports included in the submission email. | External |
| R22 | **Time tracked** per phase so the rationale can report it honestly. | P0 | Dev Plan records estimated vs actual per PR; rationale states the total. | External |

## Experience & content

- **Layout.** Top: ladder navigation (rungs 0 to 6, then Sandbox; locked beyond what is built). Left: four roommate panels. Centre: message timeline with step controls. Right: cheater role picker and the "Run 1,000 rounds" chart. Rungs 3 to 5 add the polynomial visual; rung 6 adds the *t* slider and phase chart.
- **Narrative beats.** Rung 0 is the punchline-first opener (Dave wins 100%). Rung 2 is the "surely this is fixed" moment that is not: the chart looks exactly like rung 0. Rung 3 is the core insight, stated in one sentence on screen. Rung 4 is the twist. Rung 5 is the payoff. Rung 6 is the closing wall: *you do not fix this, you choose t.* The Sandbox is the epilogue: *now try to break it yourself.*
- **Tone.** Playful and concrete (roommates, closets, dead phones), never jokey about the math. Plain words by default; the math toggle is for the curious.
- **Dave.** Dave is the designated cheater. The user is the honest roommate "You": they set Dave's strategy with the role picker and watch the round from their own panel, seeing only what an honest participant would see.

## Success criteria

- A reviewer who never watches the video can state the core insight after rung 3.
- Measured bias on every rung matches theory within tolerance, and the author can show the test that proves it.
- Rungs 0 to 3 plus all deliverables are done inside roughly 4.5 hours; the total stays inside 8 hours.
- The rationale and transcripts show the human steering: the scope plan, the validation gate, and crypto review.

## Scope vs. budget

Tiers map to Dev Plan PRs. The rationale and video were not in the original brainstorm phases and are budgeted here.

| Tier | Contents | Dev Plan PRs | Time | Cumulative |
|------|----------|-----------------|-----------:|-----------:|
| Checkpoint | Rung 2 + simulated roommates + 1,000-round chart. **Validation gate**: build out the rest only once the bias chart is visibly compelling; if it is not, rework the presentation of this rung before adding more. | PR1 to PR3 (includes deploy pipeline and crypto tests) | ~1.5 h | 1.5 h |
| P0 | R1, R2, R5, R6, R7, R8 (P0 roles), R9, R10, R14, R15, R17, R18 | PR4 to PR5 | ~1.4 h | 2.9 h |
| P0 | R19, R20, R21, R22 (rationale, video, transcripts) | PR6, PR14, video | ~1.5 h | 4.4 h |
| P1 | R3, R4a, R8 (P1 roles), R11, R12, R13 | PR7 to PR11 | ~2.6 h | 7.0 h |
| P2 | R23 (absorbs R4b), R8 (colluder) | PR12 to PR13 | ~1.5 h | 8.5 h (**conditional**: built only if the Dev Plan checkpoints show headroom) |

**Reading this against the brief.** The brief targets 1 to 2 hours. P0 alone is about 4.4 hours including the rationale and video. P0 plus P1 is about 7 hours. Everything including the Sandbox would be about 8.5 hours, so P2 is conditional on the Dev Plan's checkpoints, not planned in. That is a deliberate choice already made in PLAN.md (depth over breadth, within the 8-hour limit) and the rationale should own it. Cut order if time runs short: R23's compare-pins first, then the rest of R23, then R13, then R12, then R3, and R4a last so the ladder still ends on the limit. R5 (real protocol, verified) is never cut, because a crypto demo with a wrong result is worse than a smaller demo.

## Risks (product)

| Risk | Mitigation |
|------|------------|
| **Concept overload**: seven rungs of protocol is a lot for 5 minutes. | R14: every rung self-contained in 30 seconds. Rungs beyond what is built are hidden, not greyed out. |
| **Low replay value**: it is a guided demonstration. | Role picker and step-through make each rung a small experiment. Seeded URLs let a reviewer share a surprising run. The Sandbox (R23) lets them run their own. |
| **Sandbox dilutes the narrative** or shows meaningless combinations. | It is the last tab, never the landing view. Roles are filtered per protocol, and combinations with no interesting outcome say so plainly. |
| **Simulated feels like a toy.** | R5 (real protocol, measured bias) and the message timeline make the distributed nature visible. The rationale names the real-relay swap as a designed-for extension. |
| **Familiar genre**: commit-reveal is textbook. | Reach rung 3 within the first 2 minutes of use; rungs 0 to 2 are setup, not the show. |
| **Less visual than alternatives.** | Invest in the roommate panels and the polynomial visual (R6, R12) rather than decoration. |
| **Over-scoping is itself graded.** | Validation gate at 30 minutes; cut order fixed above; time tracked (R22). |

## Open questions

None open. Resolved 2026-10-02:

- **Rung 6 priority:** split into R4a (explainer, P1) and R4b (live collusion, P2).
- **Abort model:** Dave may abort and restart as often as he likes on rung 2, so the attack yields 100%. On rung 4 the abort ends the round, so the two-choice bias is 7/16.
- **Real multiplayer:** non-goal, rationale extension only.
- **Who is the user:** the honest roommate "You", steering Dave through the role picker.
- **Hosting:** left to the Technical Plan.
- **Sandbox:** added as R23 at P2, absorbing R4b. The engine carries a role per roommate from the start so the Sandbox is UI-only work later.

## Traceability

| External requirement (brief) | Covered by |
|------------------------------|------------|
| Choose a theme | Summary: Theme 1 (Exploration & Understanding) and Theme 3 (Systems & Reliability) |
| Theme 1: build a tool that develops deep understanding of a technical concept | R6, R7, R9, R11, R12, R14, R23 (panels, timeline, measured chart, math toggle, polynomial visual, 30-second rungs, sandbox) |
| Theme 3: a distributed primitive that handles failure gracefully | R1 to R5 (the protocols, dropout recovery, real execution) |
| Target 1 to 2 h, hard limit 8 h; scoping evaluated | Scope vs. budget; R22; validation gate |
| Note time spent in the rationale | R19, R22 |
| Deployed, usable in a browser, no local install / execution / compilation | R15, R17 |
| Self-contained: demo mode or bundled examples, no reviewer data or expertise | R15, R14 |
| Focus on a single feature or interaction pattern; polish less important than the idea | Non-goals; R14 |
| Code via GitHub repo | R18 |
| Rationale: both ~5 min video and short written doc | R19, R20 |
| Rationale content: theme/approach, non-obvious, decisions and tradeoffs, extensions, time spent | R19 |
| Submit AI transcripts; judgment is evaluated | R21; plan docs and changelogs record decisions |

## Changelog
- 2026-10-02: Initial draft from requirements.pdf and PLAN.md.
- 2026-10-02: Framed as Theme 1 + Theme 3 (user note). Marked PLAN.md as superseded by the three plan docs (user note).
- 2026-10-02: Added "The attack ladder" section defining every rung so the PRD is self-contained without PLAN.md (user note).
- 2026-10-02: Removed the fallback concept and all alternative-project options (user note). Carried over from PLAN.md: no-LLM non-goal, prior-work link, and the full limitations/extensions list in R19.
- 2026-10-02: Corrected rung 6 collusion outcome: colluders who reconstruct early and deal last get full control, as on rung 1.
- 2026-10-02: Retired PLAN.md and removed the brief PDF from the repo; Sources line updated.
- 2026-10-02: Scope table refreshed to the Dev Plan's estimates (P0 4.4 h, P1 7.0 h, P2 8.5 h conditional); tiers now map to PRs instead of PLAN.md phases.
- 2026-10-02: Added R23 Sandbox (P2), absorbing R4b; P2 budget raised to ~1.5 h; cut order updated (user decision).
- 2026-10-02: Resolved Q1 to Q5. Rung 6 split into R4a/R4b; rung 2 abort model is unlimited aborts (100%); R16 dropped to non-goals; user is the honest "You". Approved.
