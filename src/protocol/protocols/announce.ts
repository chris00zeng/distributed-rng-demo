/** Rung 1: everyone announces a pick from 0 to 23; the total mod 24 decides. */
import { samplePick } from '../../crypto/arrangements';
import type { Scalar } from '../../crypto/field';
import { PARTY_IDS, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { steerContribution } from '../steer';
import { BaseParty } from './base';

export class AnnounceParty extends BaseParty {
  private waiting = false;

  constructor(id: PartyId) {
    super(id, 'announce');
  }

  onStart(ctx: Ctx): void {
    const choice = ctx.decide({
      kind: 'speak',
      prompt: 'Time to announce a pick',
      options: [
        { id: 'now', label: 'announce a random pick now', honest: true },
        { id: 'wait', label: 'say nothing until the others have spoken', honest: false },
      ],
    });
    if (choice === 'now') {
      this.announce(ctx, samplePick(ctx.rng));
    } else {
      this.waiting = true;
      this.state.note = 'saying nothing yet';
    }
  }

  onMessage(env: Envelope, ctx: Ctx): void {
    if (env.msg.kind !== 'announce') return;
    this.state.announced[env.from] = env.msg.value;
    if (this.waiting && this.state.myValue === undefined && this.count(this.state.announced) === PARTY_IDS.length - 1) {
      this.speakLast(ctx);
      return;
    }
    this.maybeFinish();
  }

  /** Someone else is also waiting. Blink first with what is known so far. */
  onIdle(ctx: Ctx): boolean {
    if (!this.waiting || this.state.myValue !== undefined) return false;
    this.speakLast(ctx);
    return true;
  }

  private speakLast(ctx: Ctx): void {
    let others: Scalar = 0n;
    let heard = 0;
    for (const p of PARTY_IDS) {
      if (p === this.id) continue;
      const v = this.state.announced[p];
      if (v !== undefined) { others += v; heard++; }
    }
    const choice = ctx.decide({
      kind: 'steer',
      prompt: heard === PARTY_IDS.length - 1 ? 'Everyone else has announced' : `${heard} of 3 have announced`,
      options: [
        { id: 'random', label: 'announce a random pick', honest: true },
        { id: 'win', label: 'pick the number that lands him in the suite', honest: false },
      ],
      context: { heard },
    });
    this.announce(ctx, choice === 'win' ? steerContribution(others, this.id) : samplePick(ctx.rng));
  }

  private announce(ctx: Ctx, value: Scalar): void {
    this.state.myValue = value;
    this.state.announced[this.id] = value;
    ctx.send('all', { kind: 'announce', value });
    this.maybeFinish();
  }

  private maybeFinish(): void {
    if (this.state.phase === 'done') return;
    if (this.count(this.state.announced) === PARTY_IDS.length) this.finish(this.state.announced);
    else if (!this.waiting || this.state.myValue !== undefined) this.state.note = 'waiting for everyone to announce';
  }
}

export const ANNOUNCE_ROLES: Role[] = ['honest', 'lastMover'];
