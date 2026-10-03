# Fair Rooms: design rationale

*Draft written from the plan docs and the build transcripts. First person is the author's voice; edit freely.*

## Why these themes, and why this approach

I wanted to build something that is both a **working distributed primitive** and an **explainer** for it, because the two check each other: if the explanation is wrong the simulation shows it, and if the simulation is boring the explanation is pointless.

The primitive is shared randomness among parties who do not trust each other. I had worked with threshold secret sharing before, where the point is that malicious dropouts cannot block an outcome, and I kept noticing that the interesting part is not the cryptography but the *sequence*: what each party knows at each moment, and what they can still do about it. That is a distributed-systems story in miniature: dropouts, adversaries, and a safety/liveness trade-off that no protocol escapes.

Four roommates assigning four unequal rooms over a group chat is the smallest setting where every piece of that story shows up and where nobody needs a cryptography background to care about the outcome.

## What is non-obvious

The core insight sits at level 3: **an abort only matters if the aborter has already learned something.** Commitments stop a cheater from lying about his number, but they do nothing about quitting: whoever reveals last learns the result first and can simply walk away. Once everyone has dealt shares of their number *before* any reveal, the outcome is fixed, and a quitter is handled exactly like a dead phone. The others rebuild his number and move on.

Two things I only understood by building it:

- **Detecting a lie is not enough; you have to be able to say who told it.** Plain secret sharing lets the honest roommates see that shares do not add up, but not whose share is wrong. Their only honest response is to start over, and "start over" is exactly what the quitter wanted. One dishonest dealer brings the level 2 attack back in full. Verifiable sharing fixes this by attribution, not by detection.
- **Collusion buys less than I assumed.** I expected two colluders to get full control. Because every number is committed before any share is dealt, they can peek at the result early but cannot choose their own numbers last. The only lever left is to be left out of the round, which is the best of four outcomes, about 68%. The demo measures this rather than asserting it.

## Key design decisions and trade-offs

- **The simulation runs the real protocol.** Every bias figure on screen comes from 1,000 rounds of actual commitments, shares and checks with a seeded random source, and the statistical tests assert the theoretical values. Changing the seed changes the rounds and not the percentages. This cost more than scripting the numbers and was the only way to be sure the story was true. It also found two mistakes in my own plan (above).
- **A number from 0 to 23, not a hash.** There are 24 ways to assign four rooms, so each roommate's roll is a number from 0 to 23, the numbers are added and wrapped at 24, and the result is the arrangement. One mental model carries every level. From level 5 the number is padded with random digits before it is committed, because a commitment to one of 24 values is guessable; the padding is drawn visibly distinct from the pick so the reason is on screen.
- **Roles are policies at decision points.** Every roommate runs the honest protocol and asks "what do I do here?" at each point where cheating is possible. Dave's role answers, and the viewer can override any answer and watch the round replay. This made every attack a visible, labelled deviation rather than hidden code.
- **One protocol family with two switches.** Levels 3 to 6 are the same protocol with verification on or off and a threshold *t*. "Same protocol, harder attack" is literally true in the code.
- **Four roommates, fixed.** Four is the smallest house where one cheater is tolerable and two are not, and 24 arrangements fit on a screen. The level 6 chart lets you ask "what if there were seven of us?" without changing the live cast.
- **Performance.** Level 5's curve arithmetic costs about three milliseconds per round. A pool of Web Workers splits the 1,000 rounds across cores so the chart fills in under two seconds; a weighted batch check turned out slower than per-share checks and was dropped.

## What is real and what is not

- The roommates are simulated in one browser tab; the message bus is an in-memory queue with seeded ordering. The protocol code talks only to that bus, so a real relay is a swap, not a rewrite.
- Shares travel in the clear between simulated parties. A real deployment encrypts each share to its recipient.
- Hiding is computational (discrete log), not information-theoretic.
- Randomness is seeded for reproducibility and shareable links. A real deployment uses operating-system randomness.

## What I would do with more time

- Pedersen commitments, for information-theoretic hiding.
- Encrypted share channels and a real relay for multi-device play.
- Pin-and-compare in the Sandbox, to put two configurations side by side.
- Envy-free rent division as a different notion of fairness for unequal rooms: instead of a fair lottery, a fair price.

## Time spent

Planning (requirements, technical plan, development plan, all approved before code): about 2.5 hours.
Build, measured per pull request and summed as wall-clock with parallel work overlapped: about 8.6 hours. The ladder itself, levels 0 to 6, took about 4.5 hours; the rest went to a review-driven polish pass (story, stage view, Sandbox, playing Dave yourself) that I chose to do knowing it would push past the suggested limit, because the explainer is the product and the feedback was right.

Method: the plan docs were written first and kept in sync with every change; independent pieces were built in parallel by separate agent sessions in git worktrees, each opening its own pull request; every merge was reviewed and made by me. The development plan in `plans/DEV_PLAN.md` records the estimate and the actual for every pull request.

## Video outline (about five minutes)

1. **The thesis** (30 s): four roommates, four unequal rooms, nobody trusts anybody to roll a die off camera. Fair randomness is a distributed-systems problem in miniature.
2. **Level 2** (60 s): commitments stop lying, not quitting. Dave reveals last, quits when he loses, 100%.
3. **Level 3** (90 s): shares before reveals. Dave quits; the others rebuild his number; the chart is flat at 25%. An abort only matters if the aborter already learned something.
4. **Level 5** (60 s): one bad dealer brings the attack back; verifiable sharing catches the bad share with a name attached, before any reveal, with no restart.
5. **Level 6** (60 s): nothing fixes collusion. You choose *t*, and *t* is a trade between secrecy and liveness; four roommates survive one cheater, never two.

## Submission checklist

- [ ] Live demo link
- [ ] Repository link
- [ ] This document
- [ ] Video link
- [ ] Transcripts exported after the final commit
