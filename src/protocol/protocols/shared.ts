/**
 * Rungs 3–6: commit, then deal Shamir shares of your value to everyone, then
 * reveal. A party that goes silent after dealing is reconstructed by the rest
 * (Technical Plan, Abort and dropout semantics; D10, D14, D24, D25).
 *
 * `verify = false` (rungs 3, 4): hash commitments, plain Shamir, D25 reconstruction.
 * `verify = true`  (rungs 5, 6): Feldman commitments to the share polynomial,
 * padded picks (D23), a complaint phase before any reveal, and verified
 * reconstruction shares. Cheating is caught *and attributed*, so there is
 * never a reason to restart.
 *
 * Phases as seen by one party:
 *   commit      — I have broadcast my commitment; waiting for all n.
 *   deal        — Everyone committed; I dealt my shares; waiting to hold one share per dealer.
 *   complain    — (verify) I checked my shares and said so; complaints are being answered.
 *   reveal      — Waiting for all reveals.
 *   reconstruct — Someone never revealed; we pool shares of their value.
 *   done        — Outcome known.
 *
 * Decision points (D24): 'deal' (consistent | inconsistent), 'answerComplaint'
 * (publish | ignore; verify only), 'revealTiming', 'reveal' (reveal | quit),
 * 'reconstructTiming' (now | wait), 'reconstructShare' (true | forge).
 */
import { arrangement, combine, samplePick } from '../../crypto/arrangements';
import { commit, makeNonce, open } from '../../crypto/commit';
import { sampleScalar, type Scalar } from '../../crypto/field';
import {
  commitPolynomial, commitmentOpens, decodeCommitment, encodeCommitment, totalOpens, verifyShare, type Commitment,
} from '../../crypto/feldman';
import { padPick } from '../../crypto/padding';
import { evalPolynomial, isConsistent, reconstruct, samplePolynomial, sharesFrom, type Share } from '../../crypto/shamir';
import { PARTY_IDS, PARTY_NAMES, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { BaseParty } from './base';
import { REVEAL_TIMING_OPTIONS } from './commitReveal';

function xOf(id: PartyId): number {
  return id + 1;
}

const NO_NONCE = new Uint8Array(0);

export class SharedParty extends BaseParty {
  protected readonly t: number;
  protected readonly verify: boolean;
  protected revealedSelf = false;
  protected waiting = false;
  protected dealt = false;
  protected dealtInconsistently = false;
  /** My committed polynomial (verify mode). */
  protected coeffs: Scalar[] = [];
  /** Decoded Feldman commitments per dealer (verify mode). */
  protected feldman = new Map<PartyId, Commitment>();
  /** Parties that have told me they finished checking their shares (verify mode). */
  protected checkedFrom = new Set<PartyId>();
  /** Open complaints: dealer → complainants (verify mode). */
  protected openComplaints = new Map<PartyId, Set<PartyId>>();
  /** Shares broadcast during reconstruction, per dealer. */
  protected pool = new Map<PartyId, Share[]>();
  /** Dealers whose reconstruction I have already contributed to. */
  protected contributed = new Set<PartyId>();
  /** Dealers for whom I handed in a forged share (so I do not "discover" my own lie). */
  protected forgedFor = new Set<PartyId>();
  /** Rung 5: reveals not yet checked against their commitments (checked in aggregate at the end). */
  protected pendingReveals = new Map<PartyId, Scalar>();
  /** Complainants I have already answered (a complaint reaches me twice: directly and via "checked"). */
  protected answered = new Set<PartyId>();

  // ---- collusion (D28) ----
  /** Everyone whose role is `colluder`, me included if I am one. */
  protected ring: PartyId[] = [];
  /** The ringleader is the highest-numbered colluder (Dave, in the ladder). */
  protected leader: PartyId | null = null;
  /** I chose to see the others' shares before dealing. */
  protected waitingToDeal = false;
  /** Shares forwarded to me by accomplices, per dealer. */
  protected leaked = new Map<PartyId, Share[]>();
  /** Accomplices' own picks, told to me. */
  protected told = new Map<PartyId, Scalar>();
  /** Set once I have planned (leader) or been told the plan (accomplice). */
  protected planned = false;

  constructor(id: PartyId, t: number, verify = false) {
    super(id, 'commit');
    this.t = t;
    this.verify = verify;
  }

  // ---- commit ----

  onStart(ctx: Ctx): void {
    this.ring = PARTY_IDS.filter((p) => ctx.scenario.roles[p] === 'colluder');
    this.leader = this.ring.length >= 2 ? Math.max(...this.ring) as PartyId : null;
    if (this.verify) {
      // Rung 5+: pad the pick (a commitment to one of 24 numbers is guessable, D23),
      // choose the share polynomial now, and commit to every coefficient.
      const value = padPick(samplePick(ctx.rng), ctx.rng);
      this.state.myValue = value;
      this.state.padded = true;
      this.coeffs = samplePolynomial(value, this.t, ctx.rng);
      const c = commitPolynomial(this.coeffs);
      this.feldman.set(this.id, c);
      const bytes = encodeCommitment(c);
      this.state.commitments[this.id] = bytes;
      ctx.send('all', { kind: 'commit', commitment: bytes, points: c });
    } else {
      // Rungs 3 and 4: a bare pick under a hash commitment.
      const value = samplePick(ctx.rng);
      const nonce = makeNonce(ctx.rng);
      this.state.myValue = value;
      this.state.myNonce = nonce;
      const c = commit(value, nonce);
      this.state.commitments[this.id] = c;
      ctx.send('all', { kind: 'commit', commitment: c });
    }
    this.state.note = 'waiting for everyone to commit';
  }

  onMessage(env: Envelope, ctx: Ctx): void {
    const { msg } = env;
    switch (msg.kind) {
      case 'commit':
        this.state.commitments[env.from] = msg.commitment;
        if (this.verify) this.feldman.set(env.from, (msg.points as Commitment | undefined) ?? decodeCommitment(msg.commitment));
        this.maybeDeal(ctx);
        break;
      case 'share':
        if (msg.dealer !== env.from || msg.x !== xOf(this.id)) return; // not mine, ignore
        this.holdShare({ dealer: msg.dealer, x: msg.x, y: msg.y });
        this.maybeLeak(ctx, { dealer: msg.dealer, x: msg.x, y: msg.y });
        this.maybeCollude(ctx);
        this.maybeReveal(ctx);
        break;
      case 'forward':
        if (!this.ring.includes(env.from) || this.id !== this.leader) return;
        this.leaked.set(msg.dealer, [...(this.leaked.get(msg.dealer) ?? []), { x: msg.x, y: msg.y }]);
        this.maybeCollude(ctx);
        break;
      case 'tell':
        if (!this.ring.includes(env.from) || this.id !== this.leader) return;
        this.told.set(env.from, msg.value);
        this.maybeCollude(ctx);
        break;
      case 'plan':
        if (env.from !== this.leader || !this.waitingToDeal || this.planned) return;
        this.planned = true;
        this.followPlan(ctx, msg.deal);
        break;
      case 'complaint':
        this.recordComplaint(ctx, env.from, msg.dealer);
        break;
      case 'checked':
        this.checkedFrom.add(env.from);
        for (const d of msg.complaints) this.recordComplaint(ctx, env.from, d);
        this.maybeEnterReveal(ctx);
        break;
      case 'publishShare':
        this.onPublishedShare(ctx, env.from, { x: msg.x, y: msg.y });
        break;
      case 'reveal': {
        if (this.verify) {
          // Checked in aggregate once every reveal is in (totalOpens); see maybeFinish.
          this.pendingReveals.set(env.from, msg.value);
        } else if (!this.opens(env.from, msg.value, msg.nonce)) {
          if (!this.state.invalid.includes(env.from)) this.state.invalid.push(env.from);
          this.state.note = `${PARTY_NAMES[env.from]}'s reveal does not match their commitment`;
          return;
        }
        this.state.revealed[env.from] = msg.value;
        this.onRevealReceived(ctx);
        break;
      }
      case 'reconstructShare': {
        const c = this.feldman.get(msg.dealer);
        if (this.verify && c && !verifyShare(c, msg.x, msg.y)) {
          // Rung 5: a reconstruction share is checked against the dealer's commitments.
          if (!this.state.rejected.includes(env.from)) this.state.rejected.push(env.from);
          this.state.note = `rejected ${PARTY_NAMES[env.from]}'s share of ${PARTY_NAMES[msg.dealer]}'s number: it fails the check`;
        } else {
          this.addToPool(msg.dealer, { x: msg.x, y: msg.y });
        }
        // Others consider this dealer gone. Join the reconstruction (even if I was
        // still finishing the complaint phase: the others have moved on).
        if (this.state.phase === 'reveal' || this.state.phase === 'complain') this.state.phase = 'reconstruct';
        this.contribute(ctx, msg.dealer);
        this.maybeReconstruct(ctx);
        break;
      }
      default:
        break;
    }
  }

  private opens(from: PartyId, value: Scalar, nonce: Uint8Array): boolean {
    if (this.verify) {
      const c = this.feldman.get(from);
      return !!c && commitmentOpens(c, value);
    }
    const c = this.state.commitments[from];
    return !!c && open(c, value, nonce);
  }

  // ---- deal ----

  protected active(): PartyId[] {
    return PARTY_IDS.filter((p) => !this.state.excluded.includes(p));
  }

  protected maybeDeal(ctx: Ctx): void {
    if (this.state.phase !== 'commit') return;
    if (!this.active().every((p) => this.state.commitments[p] !== undefined)) return;
    this.state.phase = 'deal';
    const timing = ctx.decide({
      kind: 'dealTiming',
      prompt: 'Everyone has committed',
      options: [
        { id: 'now', label: 'deal my shares now', honest: true },
        { id: 'wait', label: 'see what the others deal first', honest: false },
      ],
      context: { accomplices: this.leader === null ? 0 : this.ring.length - 1 },
    });
    if (timing === 'wait') {
      this.waitingToDeal = true;
      this.state.note = "waiting to see the others' shares before dealing";
      if (this.leader !== null && this.id !== this.leader) ctx.send(this.leader, { kind: 'tell', value: this.state.myValue! });
      return;
    }
    this.dealShares(ctx);
    this.maybeReveal(ctx);
  }

  /** Decision 'leak': an accomplice forwards a share it holds to the ringleader. */
  protected maybeLeak(ctx: Ctx, share: Share & { dealer: PartyId }): void {
    if (this.leader === null || this.id === this.leader || !this.ring.includes(this.id)) return;
    if (this.ring.includes(share.dealer)) return;
    const choice = ctx.decide({
      kind: 'leak',
      prompt: `Holding a share of ${PARTY_NAMES[share.dealer]}'s number`,
      options: [
        { id: 'keep', label: 'keep it private, as the protocol says', honest: true },
        { id: 'forward', label: `slip it to ${PARTY_NAMES[this.leader]}`, honest: false },
      ],
    });
    if (choice === 'forward') ctx.send(this.leader, { kind: 'forward', dealer: share.dealer, x: share.x, y: share.y });
  }

  /**
   * Ringleader: once every honest dealer's shares (mine plus the forwarded ones) and every
   * accomplice's pick are in, rebuild the honest picks early and choose which of us deals.
   * Someone who never deals is simply left out of the sum, so the ring picks the best of
   * 2^k outcomes. With fewer than t shares per dealer nothing can be rebuilt: deal honestly.
   */
  protected maybeCollude(ctx: Ctx): void {
    if (this.id !== this.leader || !this.waitingToDeal || this.planned) return;
    const honest = this.active().filter((p) => !this.ring.includes(p));
    const accomplices = this.ring.filter((p) => p !== this.id);
    if (!accomplices.every((a) => this.told.has(a))) return;
    const perDealer = honest.map((h) => {
      const shares = [...(this.leaked.get(h) ?? [])];
      const mine = this.heldFrom(h);
      if (mine) shares.push(mine);
      return { h, shares };
    });
    const complete = perDealer.every(({ h, shares }) => this.heldFrom(h) !== undefined && shares.length >= accomplices.length + 1);
    if (!complete) return;
    this.planned = true;
    const canRebuild = perDealer.every(({ shares }) => shares.length >= this.t);
    if (!canRebuild) {
      this.state.note = `only ${perDealer[0]?.shares.length ?? 0} shares per number: not enough to peek. Dealing honestly.`;
      for (const a of accomplices) ctx.send(a, { kind: 'plan', deal: true });
      this.dealShares(ctx);
      this.maybeReveal(ctx);
      return;
    }
    const honestTotal = perDealer.reduce((s, { shares }) => s + reconstruct(shares), 0n);
    const picks = new Map<PartyId, Scalar>([[this.id, this.state.myValue!], ...accomplices.map((a) => [a, this.told.get(a)!] as const)]);
    // Try every subset of the ring that deals; take the first that lands me in the suite.
    const members = [...this.ring];
    let best: Set<PartyId> | null = null;
    for (let mask = (1 << members.length) - 1; mask >= 0 && best === null; mask--) {
      const dealing = new Set(members.filter((_, i) => mask & (1 << i)));
      let total = honestTotal;
      for (const m of dealing) total += picks.get(m)!;
      if (arrangement(combine([total]))[this.id] === 'master') best = dealing;
    }
    const everyone = new Set(members);
    const wouldGet = arrangement(combine([honestTotal + [...everyone].reduce((s, m) => s + picks.get(m)!, 0n)]))[this.id]!;
    const plan = best ?? everyone;
    const choice = ctx.decide({
      kind: 'withhold',
      prompt: `${PARTY_NAMES[this.id]} has rebuilt everyone's number before the reveal`,
      options: [
        { id: 'deal', label: 'deal my shares and let the round run', honest: true },
        { id: 'withhold', label: 'go silent before dealing, so my number is left out', honest: false },
      ],
      context: { wouldGet, wouldWin: wouldGet === 'master', plan: plan.has(this.id) ? 'deal' : 'withhold', ringWins: best !== null },
    });
    for (const a of accomplices) ctx.send(a, { kind: 'plan', deal: plan.has(a) });
    this.followPlan(ctx, choice === 'deal');
  }

  protected followPlan(ctx: Ctx, deal: boolean): void {
    if (deal) {
      this.dealShares(ctx);
      this.maybeReveal(ctx);
    } else {
      this.state.note = 'going silent before dealing: my number will be left out, and I already know the result';
      ctx.abort();
    }
  }

  /** Decision 'deal': shares from the committed/one polynomial, or from two different ones. */
  protected dealShares(ctx: Ctx): void {
    const choice = ctx.decide({
      kind: 'deal',
      prompt: 'Time to deal shares of his number',
      options: [
        { id: 'consistent', label: 'deal honest shares', honest: true },
        { id: 'inconsistent', label: 'deal shares from two different lines', honest: false },
      ],
    });
    const secret = this.state.myValue!;
    if (!this.verify) this.coeffs = samplePolynomial(secret, this.t, ctx.rng);
    const honest = sharesFrom(this.coeffs, PARTY_IDS.length);
    if (choice === 'inconsistent') {
      // Same secret, different slope: one recipient's share is off everyone else's line
      // (and, on rung 5, off the committed line: that recipient's check fails).
      const other = sharesFrom(samplePolynomial(secret, this.t, ctx.rng), PARTY_IDS.length);
      const odd = PARTY_IDS.filter((p) => p !== this.id)[1]!;
      this.dealtInconsistently = true;
      this.sendShares(ctx, (p) => (p === odd ? other[p]! : honest[p]!));
    } else {
      this.sendShares(ctx, (p) => honest[p]!);
    }
  }

  protected sendShares(ctx: Ctx, shareFor: (p: PartyId) => Share): void {
    for (const p of PARTY_IDS) {
      const s = shareFor(p);
      if (p === this.id) this.holdShare({ dealer: this.id, x: s.x, y: s.y });
      else ctx.send(p, { kind: 'share', dealer: this.id, x: s.x, y: s.y });
    }
    this.dealt = true;
    this.state.note = this.dealtInconsistently ? 'dealt shares that do not add up' : "dealt my shares; waiting for everyone else's";
    if (ctx.scenario.dropout === this.id) {
      this.state.note = 'phone died right after dealing';
      ctx.dropout();
    }
  }

  protected holdShare(share: { dealer: PartyId; x: number; y: Scalar }): void {
    const i = this.state.sharesHeld.findIndex((s) => s.dealer === share.dealer);
    if (i >= 0) this.state.sharesHeld[i] = share;
    else this.state.sharesHeld.push(share);
  }

  protected heldFrom(dealer: PartyId): Share | undefined {
    const s = this.state.sharesHeld.find((h) => h.dealer === dealer);
    return s ? { x: s.x, y: s.y } : undefined;
  }

  // ---- complain (verify mode) ----

  /** I hold a share from every dealer. Rung 5: check each against its commitments, complain, announce "checked". */
  protected checkShares(ctx: Ctx): void {
    const bad: PartyId[] = [];
    for (const d of this.active()) {
      if (d === this.id) continue;
      const s = this.heldFrom(d)!;
      if (!verifyShare(this.feldman.get(d)!, s.x, s.y)) bad.push(d);
    }
    for (const d of bad) {
      this.recordComplaint(ctx, this.id, d);
      ctx.send('all', { kind: 'complaint', dealer: d });
    }
    this.checkedFrom.add(this.id);
    ctx.send('all', { kind: 'checked', complaints: bad });
    this.state.note = bad.length ? `my share from ${bad.map((d) => PARTY_NAMES[d]).join(', ')} fails the check: complaining` : 'all my shares check out';
    this.maybeEnterReveal(ctx);
  }

  protected recordComplaint(ctx: Ctx, complainant: PartyId, dealer: PartyId): void {
    if (!this.state.complaints.includes(dealer)) this.state.complaints.push(dealer);
    const set = this.openComplaints.get(dealer) ?? new Set<PartyId>();
    set.add(complainant);
    this.openComplaints.set(dealer, set);
    if (dealer === this.id) this.answerComplaint(ctx, complainant);
  }

  /** Decision 'answerComplaint': publish the disputed share from my committed line, or ignore. */
  protected answerComplaint(ctx: Ctx, complainant: PartyId): void {
    if (this.answered.has(complainant)) return;
    this.answered.add(complainant);
    const choice = ctx.decide({
      kind: 'answerComplaint',
      prompt: `${PARTY_NAMES[complainant]} says his share does not check out`,
      options: [
        { id: 'publish', label: 'publish the share from the committed line', honest: true },
        { id: 'ignore', label: 'say nothing (and be thrown out)', honest: false },
      ],
    });
    if (choice === 'publish') {
      const x = xOf(complainant);
      ctx.send('all', { kind: 'publishShare', x, y: evalPolynomial(this.coeffs, x) });
      this.openComplaints.get(this.id)?.delete(complainant);
      this.state.note = `published ${PARTY_NAMES[complainant]}'s share for everyone to check`;
    } else {
      this.state.note = 'ignoring the complaint';
    }
    this.maybeEnterReveal(ctx);
  }

  protected onPublishedShare(ctx: Ctx, dealer: PartyId, share: Share): void {
    const c = this.feldman.get(dealer);
    if (c && verifyShare(c, share.x, share.y)) {
      if (share.x === xOf(this.id)) this.holdShare({ dealer, ...share });
      this.openComplaints.get(dealer)?.delete(PARTY_IDS[share.x - 1]!);
      this.state.note = `${PARTY_NAMES[dealer]}'s published share checks out`;
    } else {
      this.disqualify(dealer);
    }
    this.maybeEnterReveal(ctx);
  }

  protected disqualify(dealer: PartyId): void {
    if (!this.state.disqualified.includes(dealer)) this.state.disqualified.push(dealer);
    if (!this.state.excluded.includes(dealer)) this.state.excluded.push(dealer);
    this.openComplaints.delete(dealer);
    this.state.note = `${PARTY_NAMES[dealer]} is out: shares that fail the check, and no answer`;
  }

  private unresolvedComplaints(): PartyId[] {
    return [...this.openComplaints.entries()].filter(([d, s]) => s.size > 0 && this.active().includes(d)).map(([d]) => d);
  }

  /** Everyone has checked and no complaint is open: the reveal phase may begin. */
  protected maybeEnterReveal(ctx: Ctx): void {
    if (this.state.phase !== 'complain') return;
    if (!this.active().every((p) => this.checkedFrom.has(p))) return;
    if (this.unresolvedComplaints().length > 0) return;
    this.state.phase = 'reveal';
    this.onAllDealt(ctx);
  }

  // ---- reveal ----

  protected maybeReveal(ctx: Ctx): void {
    if (this.state.phase !== 'deal') return;
    if (!this.active().every((p) => this.heldFrom(p) !== undefined)) return;
    if (this.verify) {
      this.state.phase = 'complain';
      this.checkShares(ctx);
      return;
    }
    this.state.phase = 'reveal';
    this.onAllDealt(ctx);
  }

  /** Every share is in hand (and checked). Decision: reveal now, or wait to see the others first. */
  protected onAllDealt(ctx: Ctx): void {
    const choice = ctx.decide({ kind: 'revealTiming', prompt: this.verify ? 'Every share checks out' : 'Everyone has dealt their shares', options: REVEAL_TIMING_OPTIONS });
    if (choice === 'now') {
      this.reveal(ctx);
    } else {
      this.waiting = true;
      this.state.note = 'letting the others reveal first';
    }
  }

  protected reveal(ctx: Ctx): void {
    if (this.revealedSelf) return;
    this.revealedSelf = true;
    this.state.revealed[this.id] = this.state.myValue!;
    ctx.send('all', { kind: 'reveal', value: this.state.myValue!, nonce: this.state.myNonce ?? NO_NONCE });
    this.state.note = 'waiting for everyone to reveal';
    this.maybeFinish();
  }

  /** A valid reveal arrived (or a value was reconstructed). If waiting and everyone else is in: decide. */
  protected onRevealReceived(ctx: Ctx): void {
    if (this.waiting && !this.revealedSelf) {
      const othersKnown = this.active().filter((p) => p !== this.id && this.knownValue(p) !== undefined).length;
      if (othersKnown < this.active().length - 1) return;
      const wouldGet = arrangement(combine([this.othersSum(), this.state.myValue!]))[this.id]!;
      const restartIfQuit = this.dealtInconsistently && !this.verify;
      const choice = ctx.decide({
        kind: 'reveal',
        prompt: 'Everyone else has revealed',
        options: [
          { id: 'reveal', label: 'reveal', honest: true },
          {
            id: 'quit',
            label: restartIfQuit ? 'quit (his shares will not add up: the round restarts)' : 'quit (the others already hold his shares)',
            honest: false,
          },
        ],
        context: { wouldGet, wouldWin: wouldGet === 'master', ifQuit: restartIfQuit ? 'restart' : 'reconstructed' },
      });
      if (choice === 'quit') {
        this.state.note = restartIfQuit
          ? `would get the ${wouldGet}: quitting (and his shares do not add up)`
          : `would get the ${wouldGet}: quitting (too late, they have my shares)`;
        ctx.abort();
        return;
      }
      this.reveal(ctx);
      return;
    }
    this.maybeFinish();
  }

  protected knownValue(p: PartyId): Scalar | undefined {
    return this.state.revealed[p] ?? this.state.reconstructed[p];
  }

  protected missing(): PartyId[] {
    return this.active().filter((p) => this.knownValue(p) === undefined);
  }

  protected maybeFinish(): void {
    if (this.state.phase === 'done') return;
    if (this.state.phase !== 'reveal' && this.state.phase !== 'reconstruct') return;
    if (this.missing().length > 0) return;
    if (this.verify && this.pendingReveals.size > 0) {
      // Rung 5: one aggregate check of every reveal against the commitments; per-dealer
      // fallback only when it fails, to name the liar.
      const items = [...this.pendingReveals].map(([p, value]) => ({ dealer: p, commitment: this.feldman.get(p)!, value }));
      if (!totalOpens(items)) {
        for (const it of items) {
          if (commitmentOpens(it.commitment, it.value)) continue;
          if (!this.state.invalid.includes(it.dealer)) this.state.invalid.push(it.dealer);
          delete this.state.revealed[it.dealer];
          this.state.note = `${PARTY_NAMES[it.dealer]}'s reveal does not match their commitment`;
        }
        this.pendingReveals.clear();
        if (this.missing().length > 0) return;
      }
      this.pendingReveals.clear();
    }
    let s: Scalar = 0n;
    for (const p of this.active()) s += this.knownValue(p)!;
    this.finishWith(s);
  }

  protected othersSum(): Scalar {
    let s: Scalar = 0n;
    for (const p of this.active()) if (p !== this.id) s += this.knownValue(p) ?? 0n;
    return s;
  }

  // ---- reconstruct ----

  /** Hand in my share of a gone dealer (once). Decision 'reconstructShare': the real one, or a forgery. */
  protected contribute(ctx: Ctx, dealer: PartyId): void {
    if (dealer === this.id || this.contributed.has(dealer)) return;
    const mine = this.heldFrom(dealer);
    if (!mine) return;
    const known = this.privateReconstruction(dealer);
    const context: Record<string, string | number | boolean> = { knowsValue: known !== undefined };
    if (known !== undefined && this.othersKnownExcept(dealer)) {
      const wouldGet = arrangement(combine([this.othersSumWith(dealer, known), this.state.myValue!]))[this.id]!;
      context.wouldGet = wouldGet;
      context.wouldWin = wouldGet === 'master';
    }
    const choice = ctx.decide({
      kind: 'reconstructShare',
      prompt: `Handing in his share of ${PARTY_NAMES[dealer]}'s number`,
      options: [
        { id: 'true', label: 'send the real share', honest: true },
        {
          id: 'forge',
          label: this.verify ? 'send a forged share (it will fail the check and be rejected)' : 'send a forged share (the shares will not add up: restart)',
          honest: false,
        },
      ],
      context,
    });
    const share = choice === 'forge' ? { x: mine.x, y: sampleScalar(ctx.rng) } : mine;
    if (choice === 'forge') this.forgedFor.add(dealer);
    this.contributed.add(dealer);
    this.addToPool(dealer, share);
    ctx.send('all', { kind: 'reconstructShare', dealer, x: share.x, y: share.y });
    this.state.note = choice === 'forge' ? `handed in a forged share of ${PARTY_NAMES[dealer]}'s number` : `rebuilding ${PARTY_NAMES[dealer]}'s number from shares`;
  }

  /** What I can already compute about a gone dealer's value from the shares I hold or received. */
  private privateReconstruction(dealer: PartyId): Scalar | undefined {
    const shares = this.poolWithMine(dealer);
    return shares.length >= this.t ? reconstruct(shares) : undefined;
  }

  private poolWithMine(dealer: PartyId): Share[] {
    const shares = [...(this.pool.get(dealer) ?? [])];
    const mine = this.heldFrom(dealer);
    if (mine && !shares.some((s) => s.x === mine.x)) shares.push(mine);
    return shares;
  }

  private othersKnownExcept(dealer: PartyId): boolean {
    return this.active().every((p) => p === this.id || p === dealer || this.knownValue(p) !== undefined);
  }

  private othersSumWith(dealer: PartyId, value: Scalar): Scalar {
    let s: Scalar = value;
    for (const p of this.active()) if (p !== this.id && p !== dealer) s += this.knownValue(p) ?? 0n;
    return s;
  }

  protected addToPool(dealer: PartyId, share: Share): void {
    const list = this.pool.get(dealer) ?? [];
    if (!list.some((s) => s.x === share.x)) list.push(share);
    this.pool.set(dealer, list);
  }

  /**
   * Reconstruct a gone dealer once every live party's share is in (D25). With
   * more than t shares, check they agree; if not, the round is void. On rung 5
   * every pooled share was already verified, so this never fires.
   */
  protected maybeReconstruct(ctx: Ctx, force = false): void {
    if (this.state.phase !== 'reconstruct') return;
    for (const d of this.missing()) {
      const mine = this.heldFrom(d);
      // A forger knows his own share is the lie: he rebuilds from the honest ones and keeps quiet.
      const shares = this.forgedFor.has(d)
        ? [...(this.pool.get(d) ?? [])].filter((s) => s.x !== mine?.x).concat(mine ? [mine] : [])
        : this.poolWithMine(d);
      const expected = this.active().filter((p) => p !== d).length;
      if (shares.length < this.t) {
        if (force) this.state.note = `only ${shares.length} of the ${this.t} shares needed to rebuild ${PARTY_NAMES[d]}'s number: stuck`;
        continue;
      }
      if (shares.length < expected && !force) continue;
      if (!isConsistent(shares, this.t)) {
        this.state.note = `${PARTY_NAMES[d]}'s shares do not add up: someone lied, and I cannot tell who`;
        ctx.void(`${PARTY_NAMES[d]}'s shares do not add up`);
        return;
      }
      this.state.reconstructed[d] = reconstruct(shares);
    }
    if (this.missing().length === 0 && this.waiting && !this.revealedSelf) {
      this.onRevealReceived(ctx);
      return;
    }
    this.maybeFinish();
  }

  /**
   * Bus is empty and we are not done: someone we are waiting on is gone.
   *   commit:   a party never committed → exclude it (nothing was learned).
   *   deal:     a dealer never dealt to me → exclude it.
   *   complain: a complaint went unanswered → that dealer is disqualified;
   *             a party never said "checked" → exclude it.
   *   reveal:   a party never revealed → reconstruct its value from shares
   *             (decision 'reconstructTiming': go first, or let others go first).
   *   reconstruct: shares stopped arriving → proceed with what we have.
   */
  onIdle(ctx: Ctx): boolean {
    // Stalling while everyone else stalls too: nothing learned, so reveal honestly.
    if (this.state.phase === 'reveal' && this.waiting && !this.revealedSelf && this.missing().every((p) => p === this.id)) {
      this.reveal(ctx);
      return true;
    }
    switch (this.state.phase) {
      case 'commit': {
        const silent = this.active().filter((p) => this.state.commitments[p] === undefined);
        if (silent.length === 0) return false;
        this.state.excluded.push(...silent);
        this.state.note = `${silent.map((p) => PARTY_NAMES[p]).join(', ')} never committed: left out`;
        this.maybeDeal(ctx);
        return true;
      }
      case 'deal': {
        if (this.waitingToDeal && !this.dealt && !this.planned) {
          // Nothing more is coming: deal now rather than be left out.
          this.planned = true;
          this.dealShares(ctx);
          this.maybeReveal(ctx);
          return true;
        }
        const silent = this.active().filter((p) => this.heldFrom(p) === undefined);
        if (silent.length === 0) return false;
        this.state.excluded.push(...silent);
        this.state.note = `${silent.map((p) => PARTY_NAMES[p]).join(', ')} never dealt: left out`;
        this.maybeReveal(ctx);
        return true;
      }
      case 'complain': {
        const unanswered = this.unresolvedComplaints();
        const silent = this.active().filter((p) => !this.checkedFrom.has(p));
        if (unanswered.length === 0 && silent.length === 0) return false;
        for (const d of unanswered) this.disqualify(d);
        // A party that dealt but never said "checked" (dead phone) has no complaints
        // we will ever hear. It stays in: its value can still be rebuilt from shares.
        for (const p of silent) this.checkedFrom.add(p);
        if (silent.length) this.state.note = `${silent.map((p) => PARTY_NAMES[p]).join(', ')} never checked in; moving on`;
        this.maybeEnterReveal(ctx);
        return true;
      }
      case 'reveal': {
        const gone = this.missing().filter((p) => p !== this.id);
        if (gone.length === 0) return false;
        // If the others have already handed in shares for everyone who is gone, there is
        // nothing to wait for: contribute now, no timing decision.
        const othersWentFirst = gone.every((d) => (this.pool.get(d)?.length ?? 0) > 0);
        const choice = othersWentFirst ? 'now' : ctx.decide({
          kind: 'reconstructTiming',
          prompt: `${gone.map((p) => PARTY_NAMES[p]).join(', ')} went silent`,
          options: [
            { id: 'now', label: 'start rebuilding from shares', honest: true },
            { id: 'wait', label: 'let the others hand in their shares first', honest: false },
          ],
        });
        if (choice === 'wait') {
          this.state.note = "waiting to see the others' shares first";
          return false;
        }
        this.state.phase = 'reconstruct';
        for (const d of gone) this.contribute(ctx, d);
        this.maybeReconstruct(ctx);
        return true;
      }
      case 'reconstruct': {
        const pending = this.missing().filter((d) => d !== this.id && !this.contributed.has(d));
        if (pending.length) {
          for (const d of pending) this.contribute(ctx, d);
          this.maybeReconstruct(ctx);
          return true;
        }
        const before = this.missing().length;
        this.maybeReconstruct(ctx, true);
        return this.missing().length !== before || this.phase() === 'done';
      }
      default:
        return false;
    }
  }
}

export function createSharedParty(id: PartyId, t: number, verify = false): SharedParty {
  return new SharedParty(id, t, verify);
}

export const SHARED_ROLES: Role[] = ['honest', 'aborter', 'badDealer', 'fakeShare'];
