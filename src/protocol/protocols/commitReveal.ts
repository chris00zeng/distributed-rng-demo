/** Rung 2: commit to a hash of your pick first, reveal after everyone has committed. */
import { arrangement, combine, samplePick } from '../../crypto/arrangements';
import { commit, makeNonce, open } from '../../crypto/commit';
import type { Scalar } from '../../crypto/field';
import { PARTY_IDS, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { BaseParty } from './base';

export const REVEAL_TIMING_OPTIONS = [
  { id: 'now', label: 'reveal now', honest: true },
  { id: 'wait', label: 'let the others reveal first', honest: false },
];

export class CommitRevealParty extends BaseParty {
  protected revealed = false;
  protected waiting = false;

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
    const choice = ctx.decide({ kind: 'revealTiming', prompt: 'Everyone has committed', options: REVEAL_TIMING_OPTIONS });
    if (choice === 'now') {
      this.reveal(ctx);
    } else {
      this.waiting = true;
      this.state.note = 'letting the others reveal first';
    }
  }

  protected onReveal(ctx: Ctx): void {
    if (this.waiting && !this.revealed && this.count(this.state.revealed) === PARTY_IDS.length - 1) {
      const wouldGet = arrangement(combine([this.othersSum(), this.state.myValue!]))[this.id]!;
      const choice = ctx.decide({
        kind: 'reveal',
        prompt: 'Everyone else has revealed',
        options: [
          { id: 'reveal', label: 'reveal', honest: true },
          { id: 'quit', label: 'quit so the round restarts', honest: false },
        ],
        context: { wouldGet, wouldWin: wouldGet === 'master' },
      });
      if (choice === 'quit') {
        this.state.note = `would get the ${wouldGet}: quitting`;
        ctx.abort();
        return;
      }
      this.reveal(ctx);
      return;
    }
    this.maybeFinish();
  }

  /** Everyone else is also stalling. Nothing learned yet, so reveal honestly. */
  onIdle(ctx: Ctx): boolean {
    if (this.revealed || this.state.phase !== 'reveal') return false;
    this.reveal(ctx);
    return true;
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

export const COMMIT_REVEAL_ROLES: Role[] = ['honest', 'aborter'];
