# Fair Rooms

**Live demo:** https://chris00zeng.github.io/distributed-rng-demo/

Four roommates must randomly assign four unequal rooms while apart, and none of them trusts the others to roll fairly. Fair Rooms is an interactive attack ladder: each rung is a protocol for shared randomness, one roommate ("Dave") cheats in the way that rung allows, and a 1,000-round simulation measures how unfair the result is. The fixes (commitments, secret sharing, verifiable secret sharing) close the attacks rung by rung, until the last rung hits a limit no protocol can fix.

Built in a timed, scoped sprint as both an explainer and a working distributed primitive that handles failure gracefully.

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
