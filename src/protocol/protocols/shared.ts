/**
 * Rungs 3–6: commit, then deal Shamir shares of your value to everyone, then
 * reveal. A party that goes silent after dealing is reconstructed by the rest
 * (Technical Plan, Abort and dropout semantics; D10, D11, D14).
 *
 * This PR implements `verify = false` (plain Shamir). Feldman verification
 * lands in PR8 behind the `verify` flag.
 *
 * Phases as seen by one party:
 *   commit      — I have broadcast my hash commitment; waiting for all n.
 *   deal        — Everyone committed; I dealt my shares; waiting to hold one share per dealer.
 *   reveal      — I hold a share from every dealer; I revealed; waiting for all reveals.
 *   reconstruct — Someone never revealed; we pool shares of their value.
 *   done        — Outcome known.
 *
 * Dropout fault injection: the party named by `scenario.dropout` calls
 * `ctx.dropout()` right after dealing. The driver then drops it from the bus,
 * but its share envelopes are already in flight and still arrive: a phone that
 * dies after sending has still sent.
 */
import { arrangement, combine, samplePick } from '../../crypto/arrangements';
import { commit, makeNonce, open } from '../../crypto/commit';
import type { Scalar } from '../../crypto/field';
import { deal, lowestT, reconstruct, type Share } from '../../crypto/shamir';
import { PARTY_IDS, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { BaseParty } from './base';

function xOf(id: PartyId): number {
  return id + 1;
}

export class SharedParty extends BaseParty {
  protected readonly t: number;
  protected revealedSelf = false;
  protected dealt = false;
  /** Shares broadcast during reconstruction, per dealer. */
  protected pool = new Map<PartyId, Share[]>();

  constructor(id: PartyId, t: number) {
    super(id, 'commit');
    this.t = t;
  }

  // ---- commit ----

  onStart(ctx: Ctx): void {
    // Rungs 3 and 4: a bare pick. Padding (D23) arrives with Feldman in PR8.
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
        if (this.state.phase === 'reveal') this.startReconstruction(ctx, [msg.dealer]);
        this.maybeReconstruct();
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

  /** Hook: how this party deals. Honest parties use one polynomial. */
  protected dealShares(ctx: Ctx): void {
    const shares = deal(this.state.myValue!, this.t, PARTY_IDS.length, ctx.rng);
    this.sendShares(ctx, (p) => shares[p]!);
  }

  protected sendShares(ctx: Ctx, shareFor: (p: PartyId) => Share): void {
    for (const p of PARTY_IDS) {
      const s = shareFor(p);
      if (p === this.id) this.holdShare({ dealer: this.id, x: s.x, y: s.y });
      else ctx.send(p, { kind: 'share', dealer: this.id, x: s.x, y: s.y });
    }
    this.dealt = true;
    this.state.note = 'dealt my shares; waiting for everyone else\'s';
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

  /** Hook: what to do once every share is in hand. Honest parties reveal at once. */
  protected onAllDealt(ctx: Ctx): void {
    this.reveal(ctx);
  }

  protected reveal(ctx: Ctx): void {
    if (this.revealedSelf) return;
    this.revealedSelf = true;
    this.state.revealed[this.id] = this.state.myValue!;
    ctx.send('all', { kind: 'reveal', value: this.state.myValue!, nonce: this.state.myNonce! });
    this.state.note = 'waiting for everyone to reveal';
    this.maybeFinish();
  }

  /** Hook: a valid reveal arrived. */
  protected onRevealReceived(_ctx: Ctx): void {
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

  protected startReconstruction(ctx: Ctx, dealers: PartyId[]): void {
    this.state.phase = 'reconstruct';
    for (const d of dealers) {
      const mine = this.heldFrom(d);
      if (!mine) continue;
      this.addToPool(d, mine);
      ctx.send('all', { kind: 'reconstructShare', dealer: d, x: mine.x, y: mine.y });
    }
    this.state.note = `rebuilding ${dealers.map(String).join(', ')}'s number from shares`;
  }

  protected addToPool(dealer: PartyId, share: Share): void {
    const list = this.pool.get(dealer) ?? [];
    if (!list.some((s) => s.x === share.x)) list.push(share);
    this.pool.set(dealer, list);
  }

  /** Hook: which shares to trust. Plain Shamir takes the lowest-indexed t (D11). */
  protected chooseShares(_dealer: PartyId, pool: Share[]): Share[] | null {
    return pool.length >= this.t ? lowestT(pool, this.t) : null;
  }

  protected maybeReconstruct(): void {
    if (this.state.phase !== 'reconstruct') return;
    for (const d of this.missing()) {
      const chosen = this.chooseShares(d, this.pool.get(d) ?? []);
      if (chosen) this.state.reconstructed[d] = reconstruct(chosen);
    }
    this.maybeFinish();
  }

  /**
   * Bus is empty and we are not done: someone we are waiting on is gone.
   *   commit: a party never committed → exclude it (nothing was learned).
   *   deal:   a dealer never dealt to me → exclude it.
   *   reveal: a party never revealed → reconstruct its value from shares.
   */
  onIdle(ctx: Ctx): boolean {
    switch (this.state.phase) {
      case 'commit': {
        const silent = this.active().filter((p) => this.state.commitments[p] === undefined);
        if (silent.length === 0) return false;
        this.state.excluded.push(...silent);
        this.state.note = `${silent.join(', ')} never committed: left out`;
        this.maybeDeal(ctx);
        return true;
      }
      case 'deal': {
        const silent = this.active().filter((p) => this.heldFrom(p) === undefined);
        if (silent.length === 0) return false;
        this.state.excluded.push(...silent);
        this.state.note = `${silent.join(', ')} never dealt: left out`;
        this.maybeReveal(ctx);
        return true;
      }
      case 'reveal': {
        const gone = this.missing().filter((p) => p !== this.id);
        if (gone.length === 0) return false;
        this.startReconstruction(ctx, gone);
        this.maybeReconstruct();
        return true;
      }
      default:
        return false;
    }
  }
}

/**
 * Deals honestly, waits to see every other reveal, and quits if the outcome is
 * not the master room. On this rung quitting changes nothing: the others
 * rebuild his number from the shares he already dealt.
 */
export class AborterSharedParty extends SharedParty {
  protected override onAllDealt(): void {
    this.state.note = 'letting the others reveal first';
  }

  protected override onRevealReceived(ctx: Ctx): void {
    if (this.revealedSelf) {
      this.maybeFinish();
      return;
    }
    const othersKnown = this.active().filter((p) => p !== this.id && this.knownValue(p) !== undefined).length;
    if (othersKnown < this.active().length - 1) return;
    const outcome = arrangement(combine([this.othersSum(), this.state.myValue!]));
    if (outcome[this.id] === 'master') {
      this.reveal(ctx);
    } else {
      this.state.note = `would get the ${outcome[this.id]}: quitting (too late, they have my shares)`;
      ctx.abort();
    }
  }

  /** Everyone else is stalling too. Nothing learned, so reveal honestly. */
  override onIdle(ctx: Ctx): boolean {
    if (this.state.phase === 'reveal' && !this.revealedSelf) {
      this.reveal(ctx);
      return true;
    }
    return super.onIdle(ctx);
  }
}

export function createSharedParty(role: Role, id: PartyId, t: number): SharedParty {
  if (role === 'aborter') return new AborterSharedParty(id, t);
  return new SharedParty(id, t);
}

export const SHARED_ROLES: Role[] = ['honest', 'aborter'];
