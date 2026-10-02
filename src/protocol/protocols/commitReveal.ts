/** Rung 2: commit to a hash of your pick first, reveal after everyone has committed. */
import { commit, makeNonce, open } from '../../crypto/commit';
import { arrangement, combine, samplePick } from '../../crypto/arrangements';
import type { Scalar } from '../../crypto/field';
import { PARTY_IDS, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { BaseParty } from './base';

export class CommitRevealParty extends BaseParty {
  protected revealed = false;

  constructor(id: PartyId) {
    super(id, 'commit');
  }

  onStart(ctx: Ctx): void {
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
    if (msg.kind === 'commit') {
      this.state.commitments[env.from] = msg.commitment;
      if (this.count(this.state.commitments) === PARTY_IDS.length) this.onAllCommitted(ctx);
    } else if (msg.kind === 'reveal') {
      const c = this.state.commitments[env.from];
      if (!c || !open(c, msg.value, msg.nonce)) {
        this.state.invalid.push(env.from);
        this.state.note = `${env.from}'s reveal does not match their commitment`;
        return;
      }
      this.state.revealed[env.from] = msg.value;
      this.onReveal(ctx);
    }
  }

  protected onAllCommitted(ctx: Ctx): void {
    this.state.phase = 'reveal';
    this.reveal(ctx);
  }

  protected onReveal(ctx: Ctx): void {
    void ctx;
    this.maybeFinish();
  }

  protected reveal(ctx: Ctx): void {
    if (this.revealed) return;
    this.revealed = true;
    this.state.revealed[this.id] = this.state.myValue!;
    ctx.send('all', { kind: 'reveal', value: this.state.myValue!, nonce: this.state.myNonce! });
    this.state.note = 'waiting for everyone to reveal';
    this.maybeFinish();
  }

  protected maybeFinish(): void {
    if (this.state.phase === 'done') return;
    if (this.count(this.state.revealed) === PARTY_IDS.length) this.finish(this.state.revealed);
  }

  protected othersSum(): Scalar {
    let s: Scalar = 0n;
    for (const p of PARTY_IDS) if (p !== this.id) s += this.state.revealed[p] ?? 0n;
    return s;
  }
}

/**
 * Commits honestly, but waits to see every other reveal before revealing.
 * If the outcome is not the master room, aborts instead (the round restarts).
 */
export class AborterCommitRevealParty extends CommitRevealParty {
  protected override onAllCommitted(): void {
    this.state.phase = 'reveal';
    this.state.note = 'letting the others reveal first';
  }

  protected override onReveal(ctx: Ctx): void {
    if (this.revealed) {
      this.maybeFinish();
      return;
    }
    if (this.count(this.state.revealed) < PARTY_IDS.length - 1) return;
    const outcome = arrangement(combine([this.othersSum(), this.state.myValue!]));
    if (outcome[this.id] === 'master') {
      this.reveal(ctx);
    } else {
      this.state.note = `would get the ${outcome[this.id]}: aborting`;
      ctx.abort();
    }
  }

  /** Everyone else is also stalling. Nothing learned yet, so reveal honestly. */
  onIdle(ctx: Ctx): boolean {
    if (this.revealed || this.state.phase !== 'reveal') return false;
    this.reveal(ctx);
    return true;
  }
}

export function createCommitRevealParty(role: Role, id: PartyId): CommitRevealParty {
  if (role === 'aborter') return new AborterCommitRevealParty(id);
  return new CommitRevealParty(id);
}

export const COMMIT_REVEAL_ROLES: Role[] = ['honest', 'aborter'];
