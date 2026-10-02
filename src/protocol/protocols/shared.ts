/**
 * Rungs 3–6: commit, then deal Shamir shares of your value to everyone, then
 * reveal. A party that goes silent after dealing is reconstructed by the rest
 * (Technical Plan, Abort and dropout semantics; D10, D14, D24, D25).
 *
 * `verify = false` here (plain Shamir). Feldman verification lands in PR8b.
 *
 * Phases as seen by one party:
 *   commit      — I have broadcast my hash commitment; waiting for all n.
 *   deal        — Everyone committed; I dealt my shares; waiting to hold one share per dealer.
 *   reveal      — I hold a share from every dealer; waiting for all reveals.
 *   reconstruct — Someone never revealed; we pool shares of their value.
 *   done        — Outcome known.
 *
 * Reconstruction (D25): a party uses every share it receives. With more than t
 * shares it can check that they lie on one line. If they do not, somebody lied,
 * but plain Shamir cannot say who, so the honest response is to call the round
 * void and start over. That is the hole rung 4 exploits and rung 5 closes.
 *
 * Decision points (D24): 'deal' (consistent | inconsistent), 'revealTiming',
 * 'reveal' (reveal | quit), 'reconstructTiming' (now | wait), 'reconstructShare'
 * (true | forge). Honest parties take the honest option; roles are policies.
 *
 * Dropout fault injection: the party named by `scenario.dropout` calls
 * `ctx.dropout()` right after dealing; its share envelopes are already in flight.
 */
import { arrangement, combine, samplePick } from '../../crypto/arrangements';
import { commit, makeNonce, open } from '../../crypto/commit';
import { sampleScalar, type Scalar } from '../../crypto/field';
import { isConsistent, reconstruct, samplePolynomial, sharesFrom, type Share } from '../../crypto/shamir';
import { PARTY_IDS, PARTY_NAMES, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { BaseParty } from './base';
import { REVEAL_TIMING_OPTIONS } from './commitReveal';

function xOf(id: PartyId): number {
  return id + 1;
}

export class SharedParty extends BaseParty {
  protected readonly t: number;
  protected revealedSelf = false;
  protected waiting = false;
  protected dealt = false;
  protected dealtInconsistently = false;
  /** Shares broadcast during reconstruction, per dealer. */
  protected pool = new Map<PartyId, Share[]>();
  /** Dealers whose reconstruction I have already contributed to. */
  protected contributed = new Set<PartyId>();
  /** Dealers for whom I handed in a forged share (so I do not "discover" my own lie). */
  protected forgedFor = new Set<PartyId>();

  constructor(id: PartyId, t: number) {
    super(id, 'commit');
    this.t = t;
  }

  // ---- commit ----

  onStart(ctx: Ctx): void {
    // Rungs 3 and 4: a bare pick. Padding (D23) arrives with Feldman in PR8b.
    const value = samplePick(ctx.rng);
    const nonce = makeNonce(ctx.rng);
    this.state.myValue = value;
    this.state.myNonce = nonce;
    const c = commit(value, nonce);
    this.state.commitments[this.id] = c;
    ctx.send('all', { kind: 'commit', commitment: c });
    this.state.note = 'waiting for everyone to commit';
  }

  onMessage(env: Envelope, ctx: Ctx): void {
    const { msg } = env;
    switch (msg.kind) {
      case 'commit':
        this.state.commitments[env.from] = msg.commitment;
        this.maybeDeal(ctx);
        break;
      case 'share':
        if (msg.dealer !== env.from || msg.x !== xOf(this.id)) return; // not mine, ignore
        this.holdShare({ dealer: msg.dealer, x: msg.x, y: msg.y });
        this.maybeReveal(ctx);
        break;
      case 'reveal': {
        const c = this.state.commitments[env.from];
        if (!c || !open(c, msg.value, msg.nonce)) {
          if (!this.state.invalid.includes(env.from)) this.state.invalid.push(env.from);
          this.state.note = `${env.from}'s reveal does not match their commitment`;
          return;
        }
        this.state.revealed[env.from] = msg.value;
        this.onRevealReceived(ctx);
        break;
      }
      case 'reconstructShare':
        this.addToPool(msg.dealer, { x: msg.x, y: msg.y });
        // Others consider this dealer gone. Join the reconstruction.
        if (this.state.phase === 'reveal') this.state.phase = 'reconstruct';
        this.contribute(ctx, msg.dealer);
        this.maybeReconstruct(ctx);
        break;
      default:
        break;
    }
  }

  // ---- deal ----

  protected active(): PartyId[] {
    return PARTY_IDS.filter((p) => !this.state.excluded.includes(p));
  }

  protected maybeDeal(ctx: Ctx): void {
    if (this.state.phase !== 'commit') return;
    if (!this.active().every((p) => this.state.commitments[p] !== undefined)) return;
    this.state.phase = 'deal';
    this.dealShares(ctx);
    this.maybeReveal(ctx);
  }

  /** Decision 'deal': one polynomial for everyone, or shares from two different ones. */
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
    const honest = sharesFrom(samplePolynomial(secret, this.t, ctx.rng), PARTY_IDS.length);
    if (choice === 'inconsistent') {
      // Same secret, different slope: one recipient's share is off everyone else's line.
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
    if (this.state.sharesHeld.some((s) => s.dealer === share.dealer)) return;
    this.state.sharesHeld.push(share);
  }

  protected heldFrom(dealer: PartyId): Share | undefined {
    const s = this.state.sharesHeld.find((h) => h.dealer === dealer);
    return s ? { x: s.x, y: s.y } : undefined;
  }

  // ---- reveal ----

  protected maybeReveal(ctx: Ctx): void {
    if (this.state.phase !== 'deal') return;
    if (!this.active().every((p) => this.heldFrom(p) !== undefined)) return;
    this.state.phase = 'reveal';
    this.onAllDealt(ctx);
  }

  /** Every share is in hand. Decision: reveal now, or wait to see the others first. */
  protected onAllDealt(ctx: Ctx): void {
    const choice = ctx.decide({ kind: 'revealTiming', prompt: 'Everyone has dealt their shares', options: REVEAL_TIMING_OPTIONS });
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
    ctx.send('all', { kind: 'reveal', value: this.state.myValue!, nonce: this.state.myNonce! });
    this.state.note = 'waiting for everyone to reveal';
    this.maybeFinish();
  }

  /** A valid reveal arrived (or a value was reconstructed). If waiting and everyone else is in: decide. */
  protected onRevealReceived(ctx: Ctx): void {
    if (this.waiting && !this.revealedSelf) {
      const othersKnown = this.active().filter((p) => p !== this.id && this.knownValue(p) !== undefined).length;
      if (othersKnown < this.active().length - 1) return;
      const wouldGet = arrangement(combine([this.othersSum(), this.state.myValue!]))[this.id]!;
      const choice = ctx.decide({
        kind: 'reveal',
        prompt: 'Everyone else has revealed',
        options: [
          { id: 'reveal', label: 'reveal', honest: true },
          {
            id: 'quit',
            label: this.dealtInconsistently ? 'quit (his shares will not add up: the round restarts)' : 'quit (the others already hold his shares)',
            honest: false,
          },
        ],
        context: { wouldGet, wouldWin: wouldGet === 'master', ifQuit: this.dealtInconsistently ? 'restart' : 'reconstructed' },
      });
      if (choice === 'quit') {
        this.state.note = this.dealtInconsistently
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
        { id: 'forge', label: 'send a forged share (the shares will not add up: restart)', honest: false },
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
   * more than t shares, check they agree; if not, the round is void.
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
      if (shares.length < this.t) continue;
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
   *   commit: a party never committed → exclude it (nothing was learned).
   *   deal:   a dealer never dealt to me → exclude it.
   *   reveal: a party never revealed → reconstruct its value from shares
   *           (decision 'reconstructTiming': go first, or let others go first).
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
        const silent = this.active().filter((p) => this.heldFrom(p) === undefined);
        if (silent.length === 0) return false;
        this.state.excluded.push(...silent);
        this.state.note = `${silent.map((p) => PARTY_NAMES[p]).join(', ')} never dealt: left out`;
        this.maybeReveal(ctx);
        return true;
      }
      case 'reveal': {
        const gone = this.missing().filter((p) => p !== this.id);
        if (gone.length === 0) return false;
        const choice = ctx.decide({
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

export function createSharedParty(id: PartyId, t: number): SharedParty {
  return new SharedParty(id, t);
}

export const SHARED_ROLES: Role[] = ['honest', 'aborter', 'badDealer', 'fakeShare'];
