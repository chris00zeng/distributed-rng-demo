# Fair Rooms — Technical Plan

Status: Approved (2026-10-02)
Implements: [PRD](PRD.md) (approved 2026-10-02)
Related: [Dev Plan](DEV_PLAN.md)

Decisions marked **(PLAN.md)** were recorded in the brainstorm notes before this doc and are carried over, not re-opened. Decisions marked **(new)** are proposed here.

## Overview

A static single-page app. Four simulated parties run one of a small family of randomness protocols over an in-memory message bus whose delivery order is deterministic for a given seed. The bus can be stepped one message at a time (for the timeline and panels) or run to completion thousands of times (for the fairness chart). Dave is an ordinary party whose behaviour is replaced by an attack strategy. All share arithmetic happens in one prime field, the scalar field of ristretto255, so the same Shamir code serves rungs 3 to 6 and Feldman commitments drop in without a second field.

```
                 ┌──────────────────────────────────────────────────┐
                 │ UI (React + SVG)                                  │
                 │  Ladder nav · Roommate panels · Timeline          │
                 │  Role picker · 1,000-round chart · Poly visual    │
                 │  t-slider / phase chart · Math toggle · URL state │
                 │  Sandbox (per-roommate roles, pinned tallies)      │
                 └──────────▲───────────────────────▲───────────────┘
                   step()   │ RoundLog, PartyView    │ Tally (streamed)
                 ┌──────────┴───────────┐  ┌─────────┴───────────────┐
                 │ Driver               │  │ Simulator               │
                 │ runs one round:      │  │ runs N rounds via the   │
                 │ restart on abort,    │  │ Driver, chunked so the  │
                 │ emits events         │  │ UI stays responsive     │
                 └──────────▲───────────┘  └─────────────────────────┘
                            │ send / deliverNext
                 ┌──────────┴──────────────────────────────────────┐
                 │ Bus (simulated, seeded order, drops)             │
                 └──┬──────────┬──────────┬──────────┬─────────────┘
                 ┌──┴──┐    ┌──┴──┐    ┌──┴──┐    ┌──┴──────────┐
                 │ Zoe │    │ Ana │    │ Ben │    │ Dave        │
                 │honest    │honest   │honest   │ + Strategy   │
                 └──┬──┘    └──┬──┘    └──┬──┘    └──┬──────────┘
                    └──────────┴──────────┴──────────┘
                 ┌──────────────────────────────────────────────────┐
                 │ Crypto: field (Z_ℓ, BigInt) · shamir · feldman    │
                 │ (noble ristretto255) · commit (SHA-256) · shuffle │
                 │ (rejection-sampled Fisher–Yates) · seeded PRNG    │
                 └──────────────────────────────────────────────────┘
```

## Stack & hosting

| Choice | Why | Alternatives considered |
|---|---|---|
| **TypeScript + Vite** (PLAN.md: static TS frontend, no backend) | Zero-config bundling, fast dev loop, `BigInt` and ES modules out of the box. | Plain `tsc` + script tag (no HMR, manual bundling of noble). |
| **React** for UI, **plain SVG in JSX** for the bar chart, polynomial visual, phase chart and timeline (new) | Panels, timeline and chart all derive from one `RoundLog` plus a step index; a component model keeps that cheap, and React is the one the author knows best. Three of the four visuals (polynomial, phase chart, sequence diagram) are custom shapes no chart library draws, and the fourth is one bar chart with a reference line. | Preact (smaller bundle; irrelevant for a demo loaded by a few reviewers); vanilla DOM (more boilerplate for re-rendering four panels per step); Canvas (harder to style, no DOM for tooltips); Recharts for the bar chart (more API than the bars themselves). |
| **@noble/curves** ristretto255 for Feldman commitments (PLAN.md) | Audited, pure TS, prime-order group so no cofactor pitfalls. Never hand-roll primitives. | secp256k1 from the same library (also fine; ristretto chosen for prime order and the 252-bit scalar field). |
| **@noble/hashes** SHA-256 for commitments and the shuffle seed (new, replaces PLAN.md's WebCrypto) | Synchronous, so the driver and 1,000-round loop stay synchronous and trivially deterministic. Same vendor as the curve library. Works identically in Vitest under Node. | WebCrypto `subtle.digest` (async; forces the whole step engine to be async for no gain). |
| **Vitest** for unit, property and statistical tests (new) | Native to Vite, fast, runs the same TS. | Jest (needs extra config for ESM + TS). |
| **GitHub Pages via GitHub Actions** (PLAN.md listed Vercel or GitHub Pages) | The repo link is already a deliverable, so one hosting origin for code and demo. A 20-line workflow builds and deploys on push to `main`. | Vercel (equally easy; adds a second account/dashboard for no benefit). |

No backend, no LLM, no analytics. The deployed artefact is `dist/` from `vite build`.

## Architecture

### Components

| Component | Responsibility | Serves |
|---|---|---|
| `crypto/field` | Arithmetic mod ℓ (the ristretto255 group order) on `bigint`: add, sub, mul, inv, pow, uniform sampling. | R2, R3, R4, R5 |
| `crypto/shamir` | Polynomial sampling, share evaluation at *x* = 1..*n*, Lagrange reconstruction at 0. Field-agnostic over `field`. | R2, R3, R4, R5, R12 |
| `crypto/feldman` | Commitments `C_j = a_j·G`, share verification `f(i)·G == Σ i^j·C_j`. | R3, R4a, R4b, R5 |
| `crypto/commit` | `H(value ‖ nonce)` commitments and opening check. | R1, R5 |
| `crypto/shuffle` | SHA-256-seeded byte stream → rejection-sampled uniform indices → Fisher–Yates permutation of the four rooms. | R5, R10 |
| `crypto/prng` | Seeded PRNG (sfc32 seeded from a string) for all demo randomness. | R5, R13 |
| `protocol/bus` | `send`, `deliverNext`, `pending`. Breadth-first delivery, deterministic order from the seed. Supports dropping a party's outbound messages. | R7, R2 |
| `protocol/party` | Party interface: `onStart`, `onMessage`, `view()`. Honest implementation for each protocol. | R6 |
| `protocol/protocols` | Four protocols: `trusted` (rung 0), `announce` (rung 1), `commitReveal` (rung 2), `sharedCommitReveal({ verify, t })` (rungs 3 to 6). | R1, R2, R3, R4a, R4b |
| `protocol/strategies` | Attack strategies as wrappers over the honest party, attachable to **any** party: `liar`, `lastMover`, `aborter`, `badDealer`, `fakeShare`, `colluder`. Plus `honestDropout` fault injection for any party. The ladder only ever attaches them to Dave (and Ben as accomplice); the Sandbox attaches them freely. | R8, R23 |
| `protocol/driver` | Runs one round: starts parties, pumps the bus, handles abort (restart or reconstruct per protocol), produces a `RoundLog` and `RoundResult`. | R1, R2, R7, R5 |
| `sim/simulate` | Runs *N* rounds through the driver with derived seeds, tallies room-per-party, streams partial tallies in chunks. | R9, R5 |
| `ui/*` | React components listed in the diagram. State = `{ scenario, roundLog, stepIndex, tally, pinned: Tally[] }`. | R6, R7, R8, R9, R10, R11, R12, R4a, R14, R15 |
| `ui/Sandbox` | Protocol picker (kind, verify, *t*), a role dropdown per roommate filtered by `rolesFor(protocol)`, dropout picker, run button, up to three pinned tallies rendered as side-by-side charts. Reuses the chart, timeline and panels unchanged. | R23 |
| `ui/urlState` | Serialises `Scenario` to the query string and back. | R13 |
| `content/rungs` | Copy for each rung: title, protocol line, attack line, outcome line, lesson. | R14 |

### One protocol family, not seven

Rungs 3, 4, 5 and 6 are the **same protocol** with two flags: `verify` (Feldman on or off) and `t`. Rung 4 differs from rung 3 only in Dave's strategy. This keeps the rung story honest ("same protocol, harder attack") and keeps the code to four protocol implementations.

| Rung | Protocol | Flags | Dave strategy offered |
|---|---|---|---|
| 0 | `trusted` | — | honest, liar (always) |
| 1 | `announce` | — | honest, lastMover |
| 2 | `commitReveal` | — | honest, aborter |
| 3 | `sharedCommitReveal` | verify=false, t=2 | honest, aborter (also: honest dropout toggle) |
| 4 | `sharedCommitReveal` | verify=false, t=2 | honest, badDealer, fakeShare (needs an honest dropout) |
| 5 | `sharedCommitReveal` | verify=true, t=2 | honest, badDealer, fakeShare |
| 6 | `sharedCommitReveal` | verify=true, t=slider | honest (explainer only; live collusion lives in the Sandbox) |
| Sandbox | any of the four | user-chosen | any role per roommate, filtered by protocol |

## Data model & interfaces

```ts
type PartyId = 0 | 1 | 2 | 3;            // Zoe, Ana, Ben, Dave
type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6;
type Room = 'master' | 'decent' | 'small' | 'closet';
type Role = 'honest' | 'liar' | 'lastMover' | 'aborter' | 'badDealer' | 'fakeShare' | 'colluder';

type ProtocolConfig =
  | { kind: 'trusted' }                                   // rung 0; dealer is Dave
  | { kind: 'announce' }                                  // rung 1
  | { kind: 'commitReveal' }                              // rung 2
  | { kind: 'shared'; verify: boolean; t: number };       // rungs 3–6

interface Scenario {
  protocol: ProtocolConfig;
  roles: Record<PartyId, Role>;   // a role per roommate; the ladder sets Dave only
  seed: string;                   // drives every random choice in the round
  dropout?: PartyId;              // fault injection: this party stops sending after dealing
}

const RUNG_PRESETS: Record<Rung, (daveRole: Role, t?: number) => Scenario>;  // ladder → Scenario
function rolesFor(p: ProtocolConfig): Role[];                                // what the pickers offer

type Scalar = bigint;        // element of Z_ℓ

type Msg =
  | { kind: 'announce'; value: Scalar }
  | { kind: 'commit'; commitment: Uint8Array }                       // rung 2
  | { kind: 'commit'; commitment: Point[] }                          // rungs 3–6: Feldman C_0..C_{t-1} (C_0 alone when verify=false)
  | { kind: 'share'; dealer: PartyId; x: number; y: Scalar }         // private to one recipient
  | { kind: 'complaint'; dealer: PartyId }
  | { kind: 'publishShare'; x: number; y: Scalar }                   // dealer answers a complaint
  | { kind: 'reveal'; value: Scalar; nonce?: Uint8Array }
  | { kind: 'reconstructShare'; dealer: PartyId; x: number; y: Scalar }
  | { kind: 'abort' };

interface Envelope { seq: number; from: PartyId; to: PartyId | 'all'; msg: Msg }

interface Bus {
  send(from: PartyId, to: PartyId | 'all', msg: Msg): void;
  deliverNext(): Envelope | null;   // null when idle
  pending(): number;
  drop(party: PartyId): void;        // party goes dark: outbound discarded from now on
}

interface Party {
  readonly id: PartyId;
  onStart(ctx: Ctx): void;
  onMessage(env: Envelope, ctx: Ctx): void;
  onIdle?(ctx: Ctx): boolean;        // bus is empty and the round is unfinished: "waited long enough"; return true after acting
  view(): PartyView;                 // exactly what this party knows right now (deep copy; recorded per event for the UI)
  phase(): Phase;                    // cheap accessors for the driver's hot loop
  assignment(): Record<PartyId, Room> | undefined;
}

interface Ctx { send: Bus['send']; rng: Prng; scenario: Scenario; phase(): Phase }

type Phase = 'commit' | 'deal' | 'complain' | 'reveal' | 'reconstruct' | 'done';

interface PartyView {
  myValue?: Scalar;
  myNonce?: Uint8Array;
  commitments: Partial<Record<PartyId, Uint8Array | Point[]>>;
  sharesHeld: Array<{ dealer: PartyId; x: number; y: Scalar; verified?: boolean }>;
  revealed: Partial<Record<PartyId, Scalar>>;
  reconstructed: Partial<Record<PartyId, Scalar>>;
  complaints: PartyId[];
  disqualified: PartyId[];
  combined?: Scalar;
  assignment?: Record<PartyId, Room>;
}

type Event =
  | { kind: 'deliver'; env: Envelope }
  | { kind: 'drop'; party: PartyId }
  | { kind: 'phase'; phase: Phase }
  | { kind: 'abort'; by: PartyId; restart: boolean }
  | { kind: 'outcome'; assignment: Record<PartyId, Room> }
  | { kind: 'stuck'; reason: string };

interface RoundLog { scenario: Scenario; events: Event[]; views: PartyView[][] }  // views[step][party]
interface RoundResult { outcome: 'assigned' | 'stuck'; assignment?: Record<PartyId, Room>; attempts: number }
interface Tally { rounds: number; stuck: number; roomCounts: Record<PartyId, Record<Room, number>> }
```

The ladder UI never builds a `Scenario` by hand: it calls the rung's preset with Dave's role. The Sandbox builds one directly. Everything below the UI sees only `Scenario`, so the Sandbox is UI-only work (D19).

`RoundLog.views` is the source for the roommate panels: the UI never computes knowledge, it displays the snapshot a party itself produced after each step (R6).

### Module boundaries

- `crypto/*` has no knowledge of parties or messages. Pure functions over `bigint`, `Uint8Array` and `Point`.
- `protocol/*` has no knowledge of the DOM. It is the unit under statistical test.
- `ui/*` imports from `protocol` and `content` only.
- `Bus` is the only seam between parties. A real relay (PartyKit, Durable Objects) would implement the same interface. That is the extension argument in the rationale, and nothing more is built for it.

## Core algorithms

### Field and sampling

ℓ = 2²⁵² + 27742317777372353535851937790883648493 (the ristretto255 group order). Uniform scalars are sampled by drawing 64 bytes from the PRNG and reducing mod ℓ; the bias is below 2⁻²⁶⁰ and this is the standard technique for this field. Nonces are 32 raw bytes.

### Combination and room assignment (all rungs)

**Superseded on 2026-10-02 by D21 (below). Kept for the record.**

1. Each party *i* contributes `s_i ∈ Z_ℓ`. Combined value `S = Σ s_i mod ℓ` over the parties that remain (disqualified dealers excluded).
2. `seed = SHA-256(S as 32 bytes)`. A byte stream is `SHA-256(seed ‖ counter)` for counter 0, 1, 2…
3. Fisher–Yates over the four rooms. For each step needing a uniform index in `[0, k)`, read 32-bit words from the stream and **reject** any word ≥ `floor(2³² / k) · k`. No modulo bias.
4. Room list order is [master, decent, small, closet]; party *i* gets permutation[*i*].

Rung 1's "announce and sum" is literally this with announced `s_i`. Rung 0 is Dave announcing `S` directly.

### Arrangements and picks (D21, replaces the shuffle)

- `ARRANGEMENTS`: the 24 permutations of the four rooms in lexicographic order; `arrangement(k)` gives party *i* room `ARRANGEMENTS[k][i]`. Exactly 6 of the 24 give any one party the Royal Suite.
- Rungs 0 to 4: a contribution is a **pick** `p ∈ {0..23}`, drawn with `rng.below(24)`, carried as a `Scalar` (`0n..23n`). Combination `k = (Σ picks) mod 24` over integers, not mod ℓ.
- Rungs 5 and 6 (Feldman on): the dealt secret is `s = p + 24·r` with `r` uniform in `[0, 2^240)`, so `s < 2^245` and any sum of four secrets stays below ℓ ≈ 2^252 (no wraparound). The pick is `s mod 24`; combination is `(Σ s_i) mod 24` over integers. Without padding `C_0 = p·G` is brute-forceable in 24 guesses. The UI renders `s` as the pick plus a visibly distinct padding block.
- Shamir shares are of `s` (small on rungs 3 and 4, padded on 5 and 6) in Z_ℓ as before; reconstruction returns `s` exactly.
- Steering (D22): a cheater who knows the others' total `T` and wants the Royal Suite picks any `p` with `(T + p) mod 24 ∈ W`, where `W` is the set of 6 winning arrangement indices for them; no search.

### Shamir (rungs 3 to 6)

Dealer with secret `s` picks `a_1..a_{t-1}` uniformly, sets `f(x) = s + a_1 x + … + a_{t-1} x^{t-1}`, sends `(i, f(i))` to party *i* for *i* = 1..4 (including itself). Reconstruction from any *t* points `(x_j, y_j)` is Lagrange at 0:

`s = Σ_j y_j · Π_{k≠j} x_k / (x_k − x_j)` mod ℓ.

**Reconstruction rule (rungs 3 and 4), D25 (supersedes D11):** a party uses every share it receives for a gone dealer and, once it holds more than *t*, checks that they lie on one polynomial of degree *t*−1 (`isConsistent`). If they do not, somebody lied, but plain Shamir cannot say who (a forged reconstruction share and an inconsistent deal look the same), so the honest response is to call the round **void**: the driver restarts it for everyone. That is the hole rung 4 exploits: "quit" becomes "restart" again, and Dave forces restarts until he wins. Attribution is exactly what VSS adds on rung 5. D11's "lowest-indexed *t* shares" was dropped because under it Dave's share (*x* = 4) was never used, so the planned fake-share attack could not exist.

### Feldman VSS (rungs 5 and 6)

- Dealer broadcasts `C_j = a_j · G` for *j* = 0..*t*−1, with `a_0 = s`. `C_0` is the commitment to `s`; the rung 2 hash commitment is gone.
- Recipient *i* checks `f(i) · G == Σ_j (i^j mod ℓ) · C_j`. `i^j` is at most 4³ = 64, so the right-hand side is cheap; the left-hand side is a fixed-base multiplication, which noble precomputes.
- **Complaint phase** runs after dealing and before any reveal. A failed check triggers a `complaint` broadcast. The dealer must `publishShare`; everyone re-checks it. If it also fails, or the dealer stays silent, the dealer is **disqualified**: their contribution is excluded from `S`. Nothing has been revealed yet, so excluding them costs nothing (the core insight, applied to dealers).
- Reveal: `value · G == C_0`, else treated as abort.
- Reconstruction shares are verified against the dealer's `C_j` before use. A share that fails is rejected and its sender flagged; the remaining verified shares are used if at least *t* exist.

Hiding is computational (discrete log). Pedersen commitments `a_j·G + b_j·H` would make it information-theoretic; named in the rationale, not built.

### Abort and dropout semantics (from the PRD)

| Rung | Who stops sending | What the driver does |
|---|---|---|
| 2 | Dave, after seeing all other reveals | **Restart** the round with fresh values. Unlimited, capped at 64 attempts per round as a safety valve (with honest co-players Dave wins within a handful). `attempts` is recorded and shown. |
| 3 to 6 | Any party, after dealing | Honest parties wait for the reveal phase, then **reconstruct** the silent party's value from shares. The round completes. |
| 3 to 6 | Any party, *before* dealing finishes | Party is excluded; round proceeds with the rest (nothing was learned). |
| 6 | Enough parties that fewer than *t* shares exist for a silent dealer | `stuck`: liveness failure, counted separately in the tally. |

### Decision points and policies (D24, replaces subclass strategies)

Every protocol party is the **honest** implementation. At each point where a party could deviate, it calls `ctx.decide(point)` and receives an option. A `Policy = (point: DecisionPoint) => option` per party is derived from its `Role`; `honest` always returns the honest option. The driver logs a `decision` event `{ by, point, options, chosen, deviates }` so the timeline can label and highlight it, and `RunOptions.overrides` (a map from decision index to option) lets the UI replace any decision and replay the round from the same seed. Decision points by protocol:

| Protocol | Point | Options (honest first) |
|---|---|---|
| trusted (dealer) | `roll` | random pick · a pick that wins |
| announce | `speak` at start | announce now · wait to speak last; then `steer`: a pick that wins |
| commitReveal | `reveal` after all others revealed | reveal · quit |
| shared (verify off) | `deal` | consistent shares · inconsistent shares (rung 4); `reveal`: reveal · quit; `reconstruct` for a dead dealer: true share · forged share (rung 4) |
| shared (verify on) | same points; the protocol's checks defeat the dishonest options | |

The role table in "One protocol family" is unchanged: a role is now the name of a policy.

### Dave's strategies (superseded by D24; kept for the record)

| Strategy | Hook | Behaviour |
|---|---|---|
| `liar` (rung 0) | onStart | Announces an `S` whose permutation gives Dave the master room (search over candidates). |
| `lastMover` (rung 1) | onMessage | Waits for the other three announcements, solves for `s_D` so Dave gets master: tries random `s_D` until the permutation suits him. |
| `aborter` (rung 2) | onMessage | After the third reveal, computes the outcome; if not master, sends `abort`. |
| `badDealer` (rung 4) | decisions: `deal` → inconsistent; `revealTiming` → wait; `reveal` → reveal if winning, else quit | Deals one recipient a share from a second polynomial with the same `a_0`. Quitting makes the others pool shares that do not agree, so an honest party voids the round (D25). 100%. |
| `fakeShare` (rung 4) | decisions: `revealTiming` → wait; `reconstructTiming` → wait; `reconstructShare` → forge if he knows he is losing | Lets the honest parties hand in their shares of dead Ana first, reconstructs her value privately, and forges only when the outcome is bad for him. Needs `dropout` = Ana (the rung preset sets it). 100%. |
| `colluder` (rung 6) | onMessage | Dave and the accomplice forward every received share to each other. Once they hold ≥ *t* shares of every honest dealer, they reconstruct, then choose their own contributions last (as `lastMover`). If *t* > *f* they cannot reconstruct and fall back to honest play; the role picker also offers "colluders both drop out" to show the liveness side. |

Strategies on rungs 5 and 6 (`badDealer`, `fakeShare`) are the same code as rung 4; the protocol's `verify` flag is what defeats them. That is the point.

### Several cheaters at once (Sandbox)

Strategies are per party, so combinations the ladder never shows can occur. The rules are mechanical; the engine does not special-case them (D20):

| Combination | What happens | Reported as |
|---|---|---|
| Two or more `aborter`s on commit-reveal | Both wait for the other to reveal; the idle rule makes one blink (reveal honestly), and he has thereby given up his chance to quit. The last to decide quits until he wins. | Measured (PR20): the quitters split the suite ~50/50 and the honest two never get it. Not a deadlock: the blink rule prevents it. |
| Two `lastMover`s on announce | Each waits for everyone else; the bus delivers in seeded order, so one of them is genuinely last and wins. | Measured ≈ 100% for whichever is last per round. |
| Two `badDealer`s | Each independently deals inconsistently and picks the better of their own A/B. Interactions are whatever the math gives. | Measured. |
| `fakeShare` with no dropout | No reconstruction happens, so the strategy never fires. | Chart identical to honest; copy says "needs a dead phone". |
| `colluder` on a single party | Nobody to pool with; deals immediately and plays honest. | Copy says "pick two". |
| `liar` on a non-dealer under `trusted` | Only the dealer (Dave) rolls; others' roles are ignored. | `rolesFor` offers `liar` for Dave only. |
| Any strategy under a protocol where it has no hook | Falls through to honest behaviour. | `rolesFor` hides it. |

### Idle handling

When the bus is empty and no consensus has been reached, the driver asks each live party `onIdle` in bus order and stops at the first that acts. This models timeouts without clocks: a last mover who is waiting for another last mover blinks first; on rung 3 the honest parties use it to decide a silent dealer has dropped out and start reconstruction. If nobody acts, the round is `stuck` ("everyone is waiting for someone else").

### Deterministic ordering

The bus holds a queue and delivers breadth-first: every envelope in flight lands before any envelope sent in response to one of them. Each envelope is stamped with a generation (sends made while handling a generation-*g* delivery are generation *g*+1) and `deliverNext` picks the next envelope by `(generation, from-party order permuted per round by the PRNG, then seq)`. So on rung 2 all four commits land before any reveal, rather than the first recipient of the last commit revealing before that commit has reached the others. Broadcasts fan out into one envelope per recipient. Same seed, same scenario → byte-identical `RoundLog` (R13). Round *k* of a simulation uses seed `SHA-256(scenario.seed ‖ k)`.

### Simulation loop

`simulate(scenario, N = 1000, onChunk)` runs the driver in chunks of 25 rounds between `requestAnimationFrame` ticks, calling `onChunk(tally)` after each so the chart fills in progressively. Rungs 0 to 4 are hash-and-BigInt only and run 1,000 rounds well under a second. Rungs 5 and 6 cost ~24 fixed-base scalar multiplications per round; see the risk table for the measured budget.

## Decisions

| ID | Decision | Options considered | Rationale | Status |
|----|----------|--------------------|-----------|--------|
| D1 | Static TS frontend, no backend (PLAN.md) | SPA; SPA + relay | Brief forbids local install; a relay adds ops for no P0 value. | Active |
| D2 | React + plain SVG in JSX (new) | Preact; vanilla DOM; Canvas; chart library | Component model keeps per-step re-rendering of panels, timeline and chart cheap; author familiarity; bundle size is irrelevant here. Visuals are custom shapes a chart library would not draw. | Active |
| D3 | GitHub Pages via Actions (PLAN.md offered this or Vercel) | Vercel | One origin for repo and demo; trivial workflow. | Active |
| D4 | noble-curves ristretto255 for Feldman (PLAN.md) | secp256k1; hand-rolled | Audited, prime order, never hand-roll. | Active |
| D5 | One field Z_ℓ for all share arithmetic, including rungs 3 and 4 (new) | Separate small prime for plain Shamir | One `field` module, one Shamir, Feldman drops in. Rung 3 → 5 is "add verification", not "swap fields". | Active |
| D6 | @noble/hashes SHA-256, synchronous (new; replaces PLAN.md WebCrypto) | WebCrypto | Keeps the driver synchronous and deterministic; identical in tests. | Active |
| D7 | Seeded PRNG for all demo randomness (PLAN.md: seeded, deterministic) | `crypto.getRandomValues` | Reproducible runs and shareable URLs (R13). UI states that a real deployment would use OS randomness. | Active |
| D8 | Combine by sum mod ℓ, then SHA-256-seeded Fisher–Yates with rejection sampling (PLAN.md: XOR or hash; rejection sampling) | XOR of byte strings | Sum in the field is what Shamir reconstructs naturally; the shuffle seed is a hash of it. | Superseded by D21 |
| D9 | Message bus is the only inter-party seam (PLAN.md) | Direct method calls | Step-through, drops and a future relay all hang off one interface. | Active |
| D10 | Rungs 3 to 6 are one protocol with `verify` and `t` flags (new) | One module per rung | Fewer code paths; makes "same protocol, harder attack" literally true. | Active |
| D11 | Naive reconstruction uses lowest-indexed *t* shares (new) | Check all shares, abort on inconsistency | Textbook behaviour; makes rung 4 real. Objection addressed in copy and rationale. | Superseded by D25 |
| D12 | Rung 2 abort → restart, unlimited, capped at 64 (PRD) | One abort per round | PRD decision; cap is a safety valve only. | Active |
| D13 | Simulation runs in a pool of Web Workers (one per core minus one, max 8), each a slice of the rounds, partial tallies merged and streamed to the chart; main-thread chunked loop (yielding via `scheduler.yield`/MessageChannel, never `setTimeout`) as the fallback (refined in PR8b) | Main thread only; a single Worker | Rung 5 costs ~3.4 ms per round of curve arithmetic; one thread misses the 2 s budget, the pool meets it (1.46 s measured). Round *k* always uses seed *k*, so the merged tally equals the serial one. | Active |
| D14 | Complaint → dealer publishes share or is disqualified; contribution excluded (PLAN.md) | Abort the round | Disqualification is free before any reveal. | Active |
| D15 | Vitest for unit, property and statistical tests (new) | Jest; none | Native to Vite. Statistical tests are how R5 is proven. | Active |
| D17 | Timeline steps one message at a time, with phase markers and a "next phase" button (new) | Per-phase stepping only | Dropouts and complaints only read at message granularity; the shortcut keeps long phases quick. | Active |
| D18 | Rung 0/1 cheats find a winning value by random search over candidates (new) | Back-solve from a chosen room | Honest about how the attack works; expected 4 tries, negligible cost. | Superseded by D22 |
| D16 | App state in the query string: `?rung=2&roles=hhha&seed=…[&t=3][&drop=1]`, roles as one letter per roommate (h/l/m/a/b/f/c), params equal to defaults omitted, invalid values fall back to defaults (PLAN.md: shareable by URL) | Hash fragment; localStorage | Plain, copyable, GitHub Pages friendly. The ladder keys off the rung preset, so `rung=` replaces the earlier `p=`/`v=` protocol sketch; `t` and `drop` are reserved for the Sandbox. Pinned tallies are not in the URL. | Active |
| D19 | `Scenario` carries a `ProtocolConfig` and a role per roommate from day one; the ladder uses presets (new, for R23) | Dave-only role, refactor later | Makes the Sandbox UI-only work and costs nothing now. | Active |
| D28 | Collusion (PR20): colluders wait to deal (`dealTiming`), accomplices forward every honest share and their own pick to the ringleader (`leak`, `tell`), the leader rebuilds the honest picks early and chooses which ring members deal and which go silent before dealing (`withhold`, `plan`); a member who never deals is left out of the sum. Measured: two colluders at t = 2 give Dave ≈ 68% (best of 2⁴ outcomes), at t = 3 they cannot peek and play honest. | Let colluders also choose their picks last (100%) | The commit-then-deal ordering already prevents choosing last: every pick is committed before any share is dealt. The only lever left after peeking is to be left out, which is 1 − (3/4)^(2^k). This is what the implemented protocol allows, so it is what the demo shows; the PRD's "100%" was corrected. | Active |
| D26 | Rung 5 checks reveals in aggregate: Σ value·G == Σ C₀, one base-point multiplication per party per round, with per-dealer `commitmentOpens` only when the aggregate fails (PR8b) | Per-dealer check always | Sound against one liar (the others' values are fixed); two colluders whose lies cancel leave the total, hence the outcome, unchanged. Cuts 12 base multiplications per round to 4. | Active |
| D27 | Commit messages carry the decoded Feldman points beside the 32-byte wire form (PR8b) | Decompress on receipt | 24 decompressions per round were ~1 ms; the bytes remain the canonical message and the UI shows them. A real relay would decompress once. | Active |
| D25 | Reconstruction uses every received share; more than *t* shares are checked for consistency and a disagreement voids the round (restart) (PR7) | Lowest-indexed *t* shares (D11) | Under D11 the fake-share attack was impossible (Dave's share never used). Checking is what any real implementation does; it makes rung 4 honest: detectable but not attributable, so "quit" is "restart" again and both attacks reach 100%. | Active |
| D21 | Picks are 0 to 23; combination is the integer sum mod 24 indexing a fixed table of 24 arrangements (user feedback) | Keep the field-element + hashed shuffle | One mental model for the viewer: add the picks, wrap at 24, look up the arrangement. The shuffle and rejection sampling were a second layer of indirection that explained nothing. | Active |
| D22 | Cheats compute a winning pick directly from the others' total (user feedback) | Random search (D18) | With 24 arrangements the winning set is explicit; "Dave just does the arithmetic" is the honest description. | Active |
| D23 | Padding `s = p + 24·r`, `r < 2^240`, introduced at rung 5 only, rendered visibly distinct (user decision) | Pad from rung 3; keep big secrets everywhere | Only the Feldman commitment leaks a small pick; introducing padding where it is needed teaches why. Bound on `r` keeps integer sums below ℓ. | Active |
| D24 | Honest parties call `ctx.decide(point)`; roles are policies; the driver logs `decision` events and accepts per-decision overrides for replay (user feedback) | Strategy subclasses (PR3) | Makes deviations explicit in the timeline, lets the user play Dave's move, and is the Sandbox-ready shape. Replay from the same seed is cheap. | Active |
| D20 | Multi-cheater combinations are not special-cased; the engine runs the mechanics and the Sandbox reports `stuck` and "no effect" cases plainly (new) | Forbid all but single-cheater configs | Measured answers to odd questions are the Sandbox's point; forbidding hides them. | Active |

## Correctness & verification

| Risk | How it is verified |
|---|---|
| Field arithmetic wrong (inverse, negative mod) | Unit tests: `a · inv(a) = 1` for random `a`; known-answer tests against Python `pow(a, -1, ℓ)` for a few fixed values. |
| Shamir reconstruction wrong | Property test: random secret, random *t* ∈ {2,3,4}, any *t*-subset of 4 shares reconstructs the secret. Negative: *t*−1 shares plus any guessed point yields that guess, so no information. |
| Feldman accepts a bad share or rejects a good one | Honest shares verify for every recipient. Tampering any share by +1 fails. Inconsistent dealing (two polynomials) fails exactly at the recipients on the second polynomial. |
| Commitment opening wrong | Open with the right value/nonce passes; wrong value or nonce fails. |
| Modulo bias in the shuffle | Chi-square test over 20,000 permutations from distinct seeds: all 24 permutations within tolerance. Unit test that the rejection threshold is `floor(2³²/k)·k`. |
| Scalar sampling biased | Reduce-from-64-bytes documented; test that samples are < ℓ and that the top bits are not constant. |
| **A rung's measured bias does not match theory** (the demo's headline claim, R5) | Statistical tests at 1,000 rounds, tolerance 4σ of the binomial: rung 0 liar = 100%; rung 1 lastMover = 100%; rung 2 aborter = 100% with mean attempts ≈ 4; rung 3 aborter ≈ 25% ± 5.5%; rung 3 honest dropout ≈ 25%; rung 4 badDealer = 100% with mean attempts ≈ 4 (void → restart); rung 4 fakeShare + dropout = 100%, and the forger forges only when he knows he is losing; rung 5 badDealer ≈ 25% and Dave disqualified every round; rung 5 fakeShare ≈ 25% with the share rejected; rung 6 colluder *t*=2 → 100%; rung 6 colluder *t*=3 → ≈ 25%; rung 6 both colluders drop at *t*=3 → 100% stuck. |
| Sandbox combinations misbehave (R23) | Statistical tests for the rows of the multi-cheater table: two aborters → 100% stuck; two last movers → the per-round last wins; fakeShare without dropout → identical tally to honest for the same seed. |
| **Panels leak information** (R6) | Test over every rung and strategy: before the reveal phase, no `PartyView` contains another party's `myValue`, and `sharesHeld` holds at most one share per dealer unless the party is a colluder. |
| Non-determinism | Same seed and scenario twice → deep-equal `RoundLog`. Simulation tally equal across two runs. |
| Rung 5/6 too slow for the chart | Benchmark test: 1,000 rounds of rung 5 under 3 s in Node; measure in the browser and record in the Dev Plan. |
| Wrong library usage (scalar vs point, encoding) | Known-answer: `RistrettoPoint.BASE.multiply(2n)` equals `BASE.add(BASE)`; share check passes for a hand-computed *t*=2 polynomial with tiny coefficients. |

## Technical risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Ristretto scalar multiplications make rungs 5 and 6 miss the 2 s chart budget | Medium | Medium | Fixed-base precompute in noble; cheap small-scalar sums on the verify side; progressive chart; Worker as the recorded fallback (D13). |
| Subtle crypto bug makes a rung's number wrong and undermines the demo | Medium | High | The statistical test table above runs in CI before every deploy. Never hand-roll primitives. |
| Strategy code (`badDealer`, `fakeShare`, `colluder`) takes longer than the protocol itself | Medium | Medium | Strategies are thin wrappers over the honest party with explicit hooks; each has one statistical test that defines "done". |
| Step-through granularity feels either tedious (per message) or opaque (per phase) | Medium | Low | Step per message, with phase markers and a "next phase" button. |
| Vite base path on GitHub Pages breaks asset URLs | Low | Low | `base: '/distributed-rng-demo/'` in `vite.config.ts`; verify on first deploy, which is PR1. |
| noble API differences between versions | Low | Low | Pin exact versions in `package.json`. |

## Open questions

None open. Resolved 2026-10-02:

- **Stepping granularity:** per-message stepping with phase markers and a "next phase" shortcut (D17).
- **Rung 0 and 1 steering:** `liar` and `lastMover` search random candidate values until the permutation gives Dave the master room, expected 4 tries (D18).

## Changelog
- 2026-10-02: PR20: collusion engine (D28) with `forward`/`tell`/`plan` messages and `dealTiming`/`leak`/`withhold` decision points; experiment presets; the D20 table corrected for two quitters (blink rule, no deadlock) and a lone colluder.
- 2026-10-02: PR8b: rung 5 wired (complaint phase with `complaint`/`checked`/`publishShare` messages, `answerComplaint` decision point, verified reconstruction shares, padded picks). D13 refined to a worker pool; new D26 (aggregate reveal check) and D27 (points on the wire). Note: a weighted batch of share checks was tried and dropped: 64-bit weights make the cheap tiny-scalar multiplications expensive. Driver idle turns now go to the party in the earliest phase first.
- 2026-10-02: PR7: D11 superseded by D25 (all shares used, inconsistency voids the round); `Ctx.void(reason)` and a `void` event; new decision points `deal`, `reconstructTiming`, `reconstructShare`; rung 4 outcome corrected to 100% in the verification table.
- 2026-10-02: PR16 implemented D24. Decisions raised inside a handler are logged after the triggering event; decisions with a single option are not logged; hidden (honest, non-Dave) decisions fold into the previous timeline row. Panels expose `playable` (default Dave) for the Sandbox to widen.
- 2026-10-02: D13 refined: chunk yield uses `scheduler.yield`/MessageChannel (PR15).
- 2026-10-02: Polish pass: D8 and D18 superseded by D21 (picks 0 to 23, sum mod 24, arrangement table) and D22 (direct steering); D23 padding at rung 5; D24 decision points and policies replacing subclass strategies, with `decision` events and replay overrides. New "Arrangements and picks" and "Decision points" sections.
- 2026-10-02: Initial draft from the approved PRD and the implementation notes in PLAN.md. New decisions D2, D5, D6, D10, D11, D13, D15 are flagged as such; D6 replaces PLAN.md's WebCrypto with @noble/hashes.
- 2026-10-02: Resolved T1 and T2 as D17 and D18 (user approved the recommendations).
- 2026-10-02: PR5: `Ctx.dropout()` added beside `abort()` (same mechanics, labelled `cause: 'dropout'` on the abort event) and `Bus.drop` now keeps already-queued envelopes in flight, so a party that dies right after dealing has still dealt. Dropout fault injection is party-side: the `scenario.dropout` party calls `ctx.dropout()` after sending its shares. Phases gained `deal` and `reconstruct`. Interface refinements only; D11/D14 unchanged.
- 2026-10-02: PR11 fixed D16's URL format to `?rung=&roles=&seed=&t=&drop=` (rung preset instead of the `p=`/`v=` protocol sketch).
- 2026-10-02: PR3 added `onIdle`, `phase()` and `assignment()` to the Party interface and an "Idle handling" section. Interface additions only; no decision changed.
- 2026-10-02: Added Sandbox support for R23: `ProtocolConfig`, per-roommate roles (D19), multi-cheater semantics (D20), `ui/Sandbox`. Rung 6 live collusion moves from the rung to the Sandbox. Approved.
- 2026-10-02: D2 changed from Preact to React (user preference; no tradeoff at this scale). Clarified which visuals are plain SVG and why.
