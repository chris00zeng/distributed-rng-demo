# Fair Rooms — Dev Plan

Status: Approved (2026-10-02)
Implements: [PRD](PRD.md) (approved 2026-10-02) · [Technical Plan](TECH_PLAN.md) (approved 2026-10-02)

## Strategy

Build the thinnest slice that proves the idea first: rung 2 with the real commit-reveal protocol, Dave aborting, and the 1,000-round chart. That is the PRD's **validation gate** (end of PR3). Only when that chart is visibly compelling does the UI get its panels and timeline, and only then does rung 3 (the core insight) land. Crypto modules ship with their tests in the same PR, never after, because a wrong number on a rung is the one failure the demo cannot survive.

Order is by risk and value, not by layer:

1. Deploy pipeline first, so every later PR is live within minutes and the "no local install" requirement is never at risk.
2. Crypto core with tests, because everything downstream trusts it.
3. Engine + rungs 0 to 2 + chart: the validation gate.
4. Panels, timeline, role picker: the Theme 1 half of the product.
5. Rung 3: the core insight. P0 is done here.
6. The written rationale is drafted at P0 completion and revised at each later milestone, not written at the end.
7. P1 and P2 in cut-order reverse: the things cut last are built first.

Every PR leaves `main` deployable and green. Each PR records actual time so the rationale can state the total honestly (R22).

## Milestones

| Milestone | PRs | Exit criteria | Budget (cumulative) |
|---|---|---|---|
| **M1 Validation gate** | PR1 to PR3 | Deployed page shows rungs 0 to 2 with a 1,000-round chart. Rung 2 aborter at 100%. The author judges the chart compelling enough to continue. | 1.5 h |
| **M2 P0 complete** | PR4 to PR6, PR11, PR15, PR16 | Panels, timeline, role picker, rung 3 with dropout recovery and the core insight on screen; intro story, floorplan, arrangements grid, one view at a time, Dave's decisions overridable. All P0 statistical tests green. Rationale drafted. | 5.9 h (incl. 0.5 h rationale draft) |
| **M3 P1 complete** | PR7 to PR10 | Rungs 4 to 6 explainer, polynomial visual, math toggle. | 8.5 h |
| **M4 P2 complete** | PR12 to PR13 | Sandbox with per-roommate roles and pinned comparisons. | 8.0 h |
| **Submit** | PR14 + video | Rationale final, video recorded, transcripts exported, email sent. | +0.5 h video (see budget check) |

## Dependencies and parallel work

Each PR lists only its direct prerequisites. Anything not listed can proceed alongside it. The three lanes after the validation gate touch different directories (`ui/`, `protocol/` + `crypto/`, `ui/urlState`), so they can run in separate worktrees or subagents with little merge conflict.

| PR | Needs | Can run alongside |
|---|---|---|
| PR1 scaffold | — | — (everything waits on it) |
| PR2 crypto core | PR1 | The non-crypto half of PR3 (bus, party, driver, `trusted` and `announce`) can start on a branch; `commitReveal` and the shuffle wait for PR2. |
| PR3 engine + rungs 0 to 2 (gate) | PR1, PR2 | — |
| PR4 panels + timeline | PR3 | PR5, PR11 |
| PR5 Shamir + rung 3 | PR3 | PR4, PR11 |
| PR6 P0 wrap | PR4, PR5 | PR7, PR8, PR11 (the rationale draft is writing, not code) |
| PR7 rung 4 strategies | PR5 | PR8 (both touch `protocol/`; keep `strategies/` and `protocols/shared` edits separate), PR9, PR10, PR11 |
| PR8 Feldman + rung 5 | PR5 | PR7, PR9, PR11. The `crypto/feldman` module alone needs only PR2 and can be written and tested any time after it. |
| PR9 polynomial visual + math toggle | PR4, PR5 | PR7, PR8, PR10, PR11. The rung 4 "two intercepts" and rung 5 "✗" marks land when PR7 and PR8 are in; the base visual does not wait. |
| PR10 rung 6 explainer | PR8 (verified `shared` with a *t* parameter); the phase chart itself needs only PR3 | PR7, PR9, PR11 |
| PR11 shareable URLs | PR3 | Everything from PR4 onward |
| PR15 explainer polish (arrangements, story, floorplan, one view) | PR4, PR5, PR11 | — (touches engine combination and most of the UI; run alone) |
| PR16 Dave's decision points | PR15 | PR9 (polynomial visual touches different UI) |
| PR7, PR8 | now also PR16 (strategies become policies) | as before |
| PR12 Sandbox | PR4, PR8 | PR9, PR10 if still open; PR11 should land first so roles serialise |
| PR13 pin and compare | PR12 | PR14 drafting |
| PR14 final rationale | All merged PRs | — (the video follows it) |

**Lanes after the validation gate (PR3):**

```
PR1 ─ PR2 ─ PR3 ─┬─ A (UI):        PR4 ──────── PR9 ─── PR10 ─┐
                 ├─ B (protocol):  PR5 ─┬─ PR7 ────────────────┤
                 │                      └─ PR8 ───────────────┤
                 ├─ C (state):     PR11 ──────────────────────┤
                 └─ D (writing):   PR6 (after PR4+PR5) ───────┴─ PR12 ─ PR13 ─ PR14 ─ video
```

The critical path is PR1 → PR2 → PR3 → PR5 → PR8 → PR12 → PR13 → PR14, about 5 hours of the 8. Everything else fits beside it. With one author and AI assistance, "parallel" means a second worktree or subagent on lane A or C while lane B is in progress, with the author reviewing each merge.

## PRs

### PR1 — Scaffold and deploy pipeline  `[x]`
- **Goal:** An empty but deployed app, so every later PR is live on push.
- **Covers:** R15, R17, R18 · D1, D2, D3, D15
- **Scope:** Vite + React + TypeScript; Vitest with one trivial test; GitHub Actions workflow building to GitHub Pages on push to `main`; `base` path set; README with live link placeholder; `.gitignore` for `node_modules`/`dist`. Placeholder page with the title and ladder header. Pin `@noble/curves` and `@noble/hashes` versions (installed, not yet used).
- **Verify:** Actions run green; the Pages URL renders the placeholder in Chrome, Safari and Firefox; `npm test` passes.
- **Estimate:** 20 min · **Actual:** 25 min (plus ~10 min deciding on repo visibility; Pages requires a public repo, so the repo went public on 2026-10-02)

### PR2 — Crypto core with tests  `[x]`
- **Goal:** Field, PRNG, hash commitments and the room shuffle, each proven before any protocol uses them.
- **Covers:** R5 · D5, D6, D7, D8
- **Scope:** `crypto/field` (mod ℓ add/sub/mul/inv/pow, 64-byte reduce sampling), `crypto/prng` (sfc32 from string seed), `crypto/commit` (SHA-256 `H(value ‖ nonce)` + open), `crypto/shuffle` (SHA-256 stream, rejection-sampled Fisher–Yates over the four rooms). Tests: field known-answer values from Python `pow(a, -1, ℓ)`, `a·inv(a)=1`, commitment open/fail, shuffle chi-square over 20,000 seeds, rejection threshold unit test, sampling range test.
- **Verify:** All tests green; no protocol code yet.
- **Estimate:** 25 min · **Actual:** 10 min

### PR3 — Engine, rungs 0 to 2, simulation and chart (validation gate)  `[x]`
- **Goal:** The thin end-to-end slice: real protocols, Dave cheating, measured bias on screen.
- **Covers:** R1, R5, R9, R10, R14 (copy for rungs 0 to 2), R15 · D9, D10 (presets), D12, D13, D18, D19
- **Scope:** `protocol/bus` (seeded order, `drop`), `protocol/party`, `protocol/driver` (restart on abort, 64-attempt cap, `RoundLog` + `RoundResult`), protocols `trusted`, `announce`, `commitReveal`; strategies `liar`, `lastMover`, `aborter`; `Scenario` with `ProtocolConfig` and per-party roles plus `RUNG_PRESETS` and `rolesFor`; `sim/simulate` chunked with progressive tally; `content/rungs` for 0 to 2; UI: rung nav, Dave role dropdown, "Run 1,000 rounds" button, SVG bar chart with the 1/4 line, named rooms. No panels or timeline yet. Tests: rung 0 liar 100%, rung 1 lastMover 100%, rung 2 aborter 100% with mean attempts ≈ 4, honest ≈ 25% on all three, determinism (same seed → deep-equal log).
- **Verify:** Deployed; the author runs rung 2 and decides whether the chart earns the rest of the build. Record the decision in this doc's changelog.
- **Estimate:** 45 min · **Actual:** 35 min. Gate result: Dave 100% on rung 2 at 4.0 tries per round, chart streams in; author to confirm it reads as compelling. 1,000 rounds of the slowest rung-0-to-2 case take ~0.2 s in Node after removing a deep-clone from the driver's hot loop.

### PR4 — Roommate panels, message timeline, step-through  `[x]`
- **Goal:** Make the information asymmetry visible: who knows what, message by message.
- **Covers:** R6, R7, R8 (P0 roles), R14 · D17
- **Scope:** `RoundLog.views` snapshots per step; four panel components rendering a `PartyView` in plain words; SVG sequence-diagram timeline with lifelines, arrows, phase markers, a gap for dropped messages; next / previous / next-phase / reset; role picker wired to re-run; rung copy (title, protocol, attack, outcome, lesson) laid out per R14. Test: no `PartyView` contains another party's `myValue` before the reveal phase, across rungs 0 to 2 and all roles.
- **Verify:** Step through rung 2 aborter on the deployed site: Dave's panel shows the outcome before his reveal; the others' do not; the abort and restart are visible in the timeline.
- **Estimate:** 45 min · **Actual:** 10 min

### PR5 — Shamir and rung 3 (the core insight)  `[x]`
- **Goal:** Dropout recovery works and the ladder's central sentence is on screen.
- **Covers:** R2, R5, R8 (dropout toggle) · D5, D10, D11, D14 (structure only; no verify yet)
- **Scope:** `crypto/shamir` (polynomial sampling, evaluation at 1..4, Lagrange at 0) with property tests (any *t*-subset reconstructs; *t*−1 shares reveal nothing); protocol `shared` with `verify=false`, `t=2`: deal after commit, reconstruct a silent party's value in the reveal phase using lowest-indexed *t* shares (D11), exclude a party that goes silent before dealing finishes; `dropout` fault injection; rung 3 copy including the core insight. Tests: rung 3 aborter ≈ 25% ± 5.5%, rung 3 honest dropout ≈ 25%, panels hold at most one share per dealer before reveal.
- **Verify:** Deployed; step through rung 3 with Dave aborting: his message is missing, three reconstruction messages follow, the round completes, and the 1,000-round chart is flat at 25%.
- **Estimate:** 40 min · **Actual:** 10 min (engine only; the step-through check waits on PR4's timeline)

### PR15 — Explainer polish: arrangements, story, floorplan, one view at a time  `[x]`
- **Goal:** Make the mechanism legible: add the picks, wrap at 24, look up the arrangement.
- **Covers:** R9, R10, R24, R25, R26 · D21, D22
- **Scope:** `crypto/arrangements` (24 permutations, winning sets) replaces `crypto/shuffle`; picks `0..23` on rungs 0 to 4 and integer-sum-mod-24 combination in the protocols; steering by direct computation; `content/rooms` with the new names, descriptions and colours; `ui/Floorplan` (one house, colour-coded, to scale) and `ui/ArrangementGrid` (24 mini floorplans with initials; highlight one or shade by frequency); intro story section (collapsible); segmented control switching the step view and the simulation view; panels and timeline show picks as small numbers. Tests: arrangement table is a permutation set of size 24 with 6 wins per party; sum-mod-24 uniformity; all existing statistical tests still pass with the new combination; steering always lands in the winning set.
- **Verify:** Deployed; a first-time visitor reads the intro, sees the house, picks rung 2, steps a round and sees arrangement #k highlighted; switches to 1,000 rounds and sees the grid shaded. Before/after screenshots in the PR.
- **Estimate:** 60 min · **Actual:** 70 min (incl. ~10 min of plan amendments and ~10 min chasing a false perf alarm: background-tab timer throttling)

### PR16 — Dave's decision points: highlight deviations, let the user choose  `[x]`
- **Goal:** Every point where Dave can cheat is visible, labelled, and the user's to decide.
- **Covers:** R27 · D24
- **Scope:** `ctx.decide(point)` in the honest parties for trusted, announce, commitReveal and shared; `Policy` per role replacing the strategy subclasses; `decision` events with `deviates`; `RunOptions.overrides`; timeline rows for decisions highlighted when deviating; Dave's panel shows the pending decision with buttons for each option in step-through; choosing replays the round with the override and keeps the step cursor. Tests: every statistical test unchanged with policies; overriding "quit" to "reveal" on rung 2 yields a one-attempt round; overriding "reveal" to "quit" on rung 3 still ends with Dave's reconstructed value; decision events appear exactly at the documented points.
- **Verify:** Deployed; on rung 2 make an honest Dave quit and watch the restart; on rung 3 make him quit and watch it change nothing.
- **Estimate:** 60 min · **Actual:** 25 min

### PR6 — P0 wrap: README, rationale draft, time log  `[ ]`
- **Goal:** P0 is submittable as-is.
- **Covers:** R18, R19 (draft), R22
- **Scope:** README with live link, what it is, how to run and test; `RATIONALE.md` first draft covering all six required items with the time spent so far; actuals filled in for PR1 to PR5 in this doc. No feature work.
- **Verify:** A reader of the README alone can find the demo and understand the ladder. Rationale draft covers every R19 item, marked where later milestones will change it.
- **Estimate:** 30 min · **Actual:** —

**M2 checkpoint.** If actual time at this point exceeds 6.5 h, re-plan P1 before continuing: drop R12 first per the PRD cut order, then rung 4.

### PR7 — Rung 4: the bad dealer and the fake share  `[x]`
- **Goal:** Show plain secret sharing broken by one cheater.
- **Covers:** R3 (rung 4 half), R8 (P1 roles) · D11
- **Scope:** Strategies `badDealer` (two polynomials, same `a_0`; A/B choice at reveal) and `fakeShare` (forged reconstruction share during a dropped party's reconstruction); rung 4 preset and copy, including the "why not just check all shares" line. Tests: rung 4 badDealer ≈ 43.75% ± 6.3%; rung 4 fakeShare + dropout = 100%.
- **Verify:** Deployed; chart shows ≈44% for the bad dealer; polynomial visual not yet, so the timeline must make the two reconstructions legible.
- **Estimate:** 25 min · **Actual:** 30 min (incl. the D11 → D25 correction and plan amendments)

### PR8 — Feldman VSS and rung 5  `[x]`
- **Goal:** Catch the cheat before anything is revealed.
- **Covers:** R3 (rung 5 half), R5 · D4, D14
- **Scope:** `crypto/feldman` (commitments `a_j·G`, share check) with tests (honest verifies, +1 tamper fails, inconsistent dealing fails exactly at the right recipients, known-answer `BASE·2 = BASE+BASE`); protocol `shared` with `verify=true`: `C_0` replaces the hash commitment, complaint phase, `publishShare`, disqualification and exclusion from `S`, verified reconstruction shares with rejection; rung 5 preset and copy. Tests: rung 5 badDealer ≈ 25% with Dave disqualified every round; rung 5 fakeShare ≈ 25% with the share rejected; benchmark 1,000 rounds of rung 5 under 3 s in Node, with the browser time recorded here.
- **Verify:** Deployed; step through rung 5 bad dealer: complaint messages appear before any reveal, Dave is marked disqualified, the round completes. Record the measured 1,000-round wall time; if over 3 s in the browser, open a follow-up PR for the Worker fallback (D13).
- **Estimate:** 45 min · **Actual:** 8 min (PR8a, crypto) + 40 min (PR8b, protocol, UI, worker pool)

### PR9 — Polynomial visual and "show the math" toggle  `[x]`
- **Goal:** Make shares, bad shares and verification visible as geometry.
- **Covers:** R11, R12
- **Scope:** SVG line-through-points visual for rungs 3 to 5: share points, y-intercept as the secret, off-line bad share, two intercepts from two pairs on rung 4, ✗ mark from verification on rung 5. Real-number metaphor by default; the math toggle shows hashes, nonces, field values, commitments in the panels and the visual.
- **Verify:** On rung 4 the two reconstructions visibly give two intercepts; on rung 5 the bad share is marked before reveal. Toggle shows real values that match the timeline.
- **Estimate:** 40 min · **Actual:** 25 min (rung 3 geometry and toggle; the rung 4 two-intercept and rung 5 ✗ marks are wired as props for PR7/PR8 to feed)

### PR10 — Rung 6 explainer: threshold slider and phase chart  `[ ]`
- **Goal:** End the ladder on the limit.
- **Covers:** R4a
- **Scope:** `t` slider (2 to 4), SVG *t*-versus-*f* grid coloured by the two inequalities (secrecy *t* ≥ *f*+1, liveness *n*−*f* ≥ *t*), rung 6 copy with the *n* ≥ 2*f*+1 conclusion, and a pointer to the Sandbox for the live version. The rung runs honest `shared` with `verify=true` and the chosen *t* so the step-through still works.
- **Verify:** Dragging *t* recolours the grid; no *t* is safe at *f* = 2 with *n* = 4; copy reads in 30 seconds.
- **Estimate:** 30 min · **Actual:** —

### PR11 — Shareable URLs  `[x]`
- **Goal:** Reproduce any run from a link.
- **Covers:** R13 · D16
- **Scope:** `ui/urlState` serialising `Scenario` (protocol, flags, roles as one letter each, seed, dropout) to the query string and back; "copy link" button; seed shown and editable.
- **Verify:** Paste a URL into a fresh tab: identical timeline and identical 1,000-round tally.
- **Estimate:** 15 min · **Actual:** 15 min (built in parallel with PR4 and PR5 right after PR3; URL carries rung, roles, seed, and reserved `t`/`drop` for the Sandbox)

**M3 checkpoint.** If actual time exceeds 7 h here, skip PR12 and PR13 and go to PR14.

### PR12 — Sandbox  `[ ]`
- **Goal:** Let the reviewer break it themselves.
- **Covers:** R23 (core), R4b (absorbed), R8 (colluder) · D19, D20
- **Scope:** Strategy `colluder` (share forwarding between colluders, early reconstruction, deal-last steering, honest fallback when *t* > *f*); `ui/Sandbox` tab: protocol picker (kind, verify, *t*), role dropdown per roommate from `rolesFor`, dropout picker, run; reuses chart, timeline and panels. Copy for the multi-cheater table rows (stuck, "needs a dead phone", "pick two"). Tests: colluders at *t*=2 → 100%; *t*=3 → ≈25%; both colluders drop at *t*=3 → 100% stuck; two aborters → 100% stuck; fakeShare without dropout → identical tally to honest for the same seed.
- **Verify:** Deployed; the R23 acceptance scenarios run from the UI and match the tests.
- **Estimate:** 60 min · **Actual:** —

### PR13 — Sandbox: pin and compare  `[ ]`
- **Goal:** Side-by-side answers to "what changed".
- **Covers:** R23 (compare)
- **Scope:** Pin the current tally with its scenario label; render up to three pinned charts beside the live one; unpin; in-memory only.
- **Verify:** Pin honest, pin two aborters, pin colluders; three charts, correctly labelled, until reload.
- **Estimate:** 30 min · **Actual:** —

### PR14 — Final rationale, time log, submission  `[ ]`
- **Goal:** Everything the brief asks for, honestly reported.
- **Covers:** R19, R20 (script), R21, R22
- **Scope:** `RATIONALE.md` final: both themes and why, the prior-work link, the core insight as the non-obvious part, decisions D1 to D20 distilled to the ones that mattered, the three limitations, the four extensions, total time from this doc. Video outline (5 beats: thesis, rung 2, rung 3, rung 5, rung 6 wall) kept in `RATIONALE.md`. Transcript export checklist. README final.
- **Verify:** Every R19 item present; total time matches the sum of actuals below; links resolve.
- **Estimate:** 30 min · **Actual:** —

## Budget check

| Tier | PRs | Estimated | Cumulative | PRD budget | Fits? |
|---|---|---:|---:|---:|---|
| Validation gate | PR1 to PR3 | 1.5 h | 1.5 h | 0.5 h | Over. The PRD gate assumed less infrastructure; the deploy pipeline and crypto tests are front-loaded here deliberately. See note. |
| P0 build | PR4 to PR5 | 1.4 h | 2.9 h | 2.5 h (gate + core) | 0.4 h over |
| P0 shareable URLs (pulled forward) | PR11 | 0.25 h | 3.15 h | — | Done |
| P0 polish | PR15 to PR16 | 2.0 h | 5.15 h | 2.0 h | Within |
| P0 rationale draft | PR6 | 0.5 h | 5.65 h | 1.0 h (all rationale) | Within, with PR14 + video below |
| P1 | PR7 to PR10 | 2.35 h | 8.0 h | 2.6 h | At the limit on estimates; actuals are running at ~50% of estimates |
| P2 | PR12 to PR13 | 1.5 h | 9.5 h | 1.5 h | **Cut** unless actuals keep beating estimates |
| Final rationale + video | PR14 + recording | 0.5 h + 0.5 h | 9.0 h without P2 | — | Over on estimates, inside on current actuals |

**Reading this honestly (revised 2026-10-02).** On estimates, P0 with the polish tier plus P1 and the final rationale and video comes to about 9 hours, over the limit, and the Sandbox is out. On actuals so far (1.7 h spent against 3.4 h estimated for PR1 to PR5 and PR11) the same scope projects to about 5 hours. The plan therefore keeps P1 in and treats the Sandbox as cut, re-checking at the M2 checkpoint with real numbers.

The PRD's scope table was refreshed to these figures on approval, so there is one set of numbers.

## Time log

Filled in as PRs land. The rationale's "time spent" is the sum of this column plus the video recording.

| PR | Estimate | Actual | Notes |
|---|---:|---:|---|
| PR1 | 20 min | 25 min | Node installed via Homebrew; repo made public for Pages |
| PR2 | 25 min | 10 min | 29 tests; noble-hashes v2 has no `equalBytes`, wrote one |
| PR3 | 45 min | 35 min | Validation gate: chart compelling (Dave 100%, 4.0 tries/round); perf fix: no `view()` clones in the hot loop |
| PR4 | 45 min | 10 min | Panels render `PartyView` generically so rung 3+ fields appear without UI changes |
| PR5 | 40 min | 10 min | 58 tests; dropout = `ctx.dropout()` after dealing; bus `drop` now keeps in-flight envelopes |
| PR6 | 30 min | — | |
| PR7 | 25 min | 30 min | D11 replaced by D25; rung 4 = 100% for both attacks; `void` event |
| PR8 | 45 min | 48 min | Rung 5 1,000 rounds: 3.4 s serial in Node, 1.46 s in the browser with the worker pool (15 cores) |
| PR9 | 40 min | 25 min | Lane A, parallel with PR16; god-view pools each roommate's held share; math toggle hides hex via CSS hooks |
| PR10 | 30 min | — | |
| PR11 | 15 min | 15 min | Lane C, parallel with PR4/PR5; 8 tests on encode/decode |
| PR15 | 60 min | 70 min | Arrangements replace shuffle; intro + floorplan + grid + view toggle; chunk yield moved off setTimeout |
| PR16 | 60 min | 25 min | Roles are policies; decision events logged after their trigger; Dave-only move box |
| PR12 | 60 min | — | |
| PR13 | 30 min | — | |
| PR14 | 30 min | — | |
| Video | 30 min | — | |

## Deliverables outside code

| Deliverable | Where in the plan | Owner |
|---|---|---|
| Deployed URL (R17) | PR1 creates it; every PR redeploys | Author |
| README (R18) | Placeholder PR1, full PR6, final PR14 | Author |
| Written rationale `RATIONALE.md` (R19) | Draft PR6, final PR14 | Author |
| ~5 min video (R20) | After PR14, from the outline in `RATIONALE.md`; link in README | Author |
| AI transcripts (R21) | Exported after the last commit; checklist in PR14 | Author |
| Time reporting (R22) | Time log above; total quoted in `RATIONALE.md` | Author |
| Retire `plans/PLAN.md` | Done 2026-10-02, after the mapping was reviewed | Author + Claude |
| Submission email | After video and transcripts: repo link, live link, transcripts, video, `RATIONALE.md` | Author |

## Changelog
- 2026-10-02: PR8b done. Rung 5 wired: Feldman commitments carried as bytes plus decoded points, padded picks, a complaint phase before any reveal, verified reconstruction shares, one aggregate reveal check per party. First cut ran 7.2 s per 1,000 rounds; dropping a weighted batch check (slower than per-share checks), skipping decompression and aggregating the reveal check brought it to 3.4 s serial, and the D13 fallback (a pool of Web Workers splitting the rounds) to 1.46 s in the browser. Also fixed an idle-ordering race: the party in the earliest phase now gets its idle turn first.
- 2026-10-02: PR7 done. Found that the planned fake-share attack was impossible under D11 (Dave's share never among the lowest two); replaced with D25 (check all shares, void on disagreement), which also corrects rung 4's PRD outcome from ≈44% to 100%. Proposed PRD/Tech Plan amendments ride in the PR.
- 2026-10-02: PR16 done. Decision events are queued and logged right after the event that triggered them, so panel snapshots at a decision step show what the party knew when deciding. The move box is Dave-only (`playable` prop) for the ladder.
- 2026-10-02: PR9 done (parallel with PR16). The visual pools every roommate's held share of a dealer (the dealer's view does not record what it sent), draws a metaphorical straight line with the pick as intercept, dashed until the secret is public. Math toggle hides nonce and commitment rows by CSS position hooks until explicit hooks exist.
- 2026-10-02: PR8a (crypto half of PR8, parallel lane): `crypto/feldman` (commitments, share verification, opening, byte encoding) and `crypto/padding` (D23) with 14 tests; Node benchmark for 1,000 rounds of commit + verify recorded in the PR. PR8 itself stays open for the protocol wiring.
- 2026-10-02: PR15 done. Simulation chunks now yield via `scheduler.yield`/MessageChannel instead of `setTimeout(0)`: background tabs clamp timers to 1 s, which made a run look 30× slower than it was.
- 2026-10-02: User feedback after P0 code landed: added PR15 (explainer polish) and PR16 (Dave's decision points) to M2 ahead of P1; PR7/PR8 now depend on PR16. Budget: P0 ≈ 5.9 h incl. rationale draft, P1 would reach ≈ 8.5 h, so the Sandbox (PR12/13) is cut unless actuals keep beating estimates (so far 1.7 h actual vs 3.4 h estimated).
- 2026-10-02: Initial draft from the approved PRD and Technical Plan. Flags that P0 + P1 + P2 + video totals ≈ 8.5 h, so P2 is conditional on checkpoints.
- 2026-10-02: Approved. PRD scope table refreshed to match.
- 2026-10-02: PR4 done (parallel lane A). Panels, SVG sequence-diagram timeline grouped by broadcast, step controls with "next phase" and arrow keys; leak test over rungs 0 to 2 and every Dave role.
- 2026-10-02: PR5 done (parallel lane B). Rung 3 live in the engine and copy; UI step-through verification deferred to PR4's merge.
- 2026-10-02: PR11 done early (lane C, parallel with PR4 and PR5). URL format is `?rung=&roles=&seed=&t=&drop=`; Technical Plan D16 updated to match.
- 2026-10-02: Default seed changed from `fair-rooms` to `roommates` so a first visitor stepping through sees Dave quit on rung 2 and get reconstructed into the closet on rung 3 (user decision, found by seed search during the PR11 rebase).
- 2026-10-02: PR3 done. Added `onIdle` to the Party interface (a party acts when the bus is empty: how two last movers resolve, and how rung 3 will detect dropouts) and cheap `phase()`/`assignment()` accessors beside `view()`. Both are Technical Plan interface additions; recorded there too.
- 2026-10-02: PR2 done. Added `sampleNonZeroScalar` and `deriveSeed` to the crypto core (needed by PR3/PR5) beyond the listed scope.
- 2026-10-02: PR1 done. Repo made public because GitHub Pages on the free plan needs it (the brief requires a shareable repo link anyway).
- 2026-10-02: Added "Dependencies and parallel work": per-PR prerequisites, four lanes after the gate, critical path (user request).
