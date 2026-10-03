# Fair Rooms

**Live demo:** https://chris00zeng.github.io/distributed-rng-demo/

Four roommates must randomly assign four unequal rooms while apart, and none of them trusts the others to roll fairly. Fair Rooms is an interactive attack ladder: each rung is a protocol for shared randomness, one roommate ("Dave") cheats in the way that rung allows, and a 1,000-round simulation measures how unfair the result is. The fixes (commitments, secret sharing, verifiable secret sharing) close the attacks rung by rung, until the last rung hits a limit no protocol can fix.

Built in a timed, scoped sprint as both an explainer and a working distributed primitive that handles failure gracefully.

## What you can do

- Walk the ladder: seven **levels**, from "Dave rolls" to the threshold limit. Each level is a protocol, Dave cheats as hard as the rules allow, and 1,000 rounds measure how unfair it got.
- Step through one round on the **stage**: who knows what at every message, with Dave's moves labelled and yours to override.
- Open the **Sandbox** (the flask) for four experiments the levels never answer, then set every roommate's role yourself.
- Toggle **show the cryptography** to see the hashes, shares and curve points behind the words.

The design rationale is in [`RATIONALE.md`](RATIONALE.md).

## Plans

`plans/` is the source of truth for what is being built and why:

- [`PRD.md`](plans/PRD.md): the ladder, requirements and scope
- [`TECH_PLAN.md`](plans/TECH_PLAN.md): architecture, algorithms and decisions
- [`DEV_PLAN.md`](plans/DEV_PLAN.md): PR breakdown, progress and time log

## Develop

Requires Node 22 or newer.

```sh
npm ci          # install pinned dependencies
npm run dev     # dev server with hot reload
npm test        # unit, property and statistical tests (Vitest)
npm run build   # type-check and build to dist/
```

Pushes to `main` run the tests, build, and deploy `dist/` to GitHub Pages via the workflow in `.github/workflows/deploy.yml`. Pull requests run the tests and build only.
