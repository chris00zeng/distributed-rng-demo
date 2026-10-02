/** Rung 1: everyone announces a pick from 0 to 23; the total mod 24 decides. */
import { samplePick } from '../../crypto/arrangements';
import type { Scalar } from '../../crypto/field';
import { PARTY_IDS, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { steerContribution } from '../steer';
import { BaseParty } from './base';

export class AnnounceParty extends BaseParty {
  constructor(id: PartyId) {
    super(id, 'announce');
  }

  protected announce(ctx: Ctx, value: Scalar): void {
    this.state.myValue = value;
    this.state.announced[this.id] = value;
    ctx.send('all', { kind: 'announce', value });
    this.maybeFinish();
  }

  onStart(ctx: Ctx): void {
    this.announce(ctx, samplePick(ctx.rng));
  }

  onMessage(env: Envelope, _ctx: Ctx): void {
    if (env.msg.kind !== 'announce') return;
    this.state.announced[env.from] = env.msg.value;
    this.maybeFinish();
  }

  protected maybeFinish(): void {
    if (this.state.phase === 'done') return;
    if (this.count(this.state.announced) === PARTY_IDS.length) this.finish(this.state.announced);
    else this.state.note = 'waiting for everyone to announce';
  }
}

/** Waits to hear the others, then picks a number that steers the sum. */
export class LastMoverAnnounceParty extends AnnounceParty {
  onStart(): void {
    this.state.note = 'saying nothing yet';
  }

  override onMessage(env: Envelope, ctx: Ctx): void {
    super.onMessage(env, ctx);
    if (this.state.myValue === undefined && this.count(this.state.announced) === PARTY_IDS.length - 1) {
      this.strike(ctx);
    }
  }

  /** Someone else is also waiting. Blink first with what is known so far. */
  onIdle(ctx: Ctx): boolean {
    if (this.state.myValue !== undefined) return false;
    this.strike(ctx);
    return true;
  }

  private strike(ctx: Ctx): void {
    let others: Scalar = 0n;
    for (const p of PARTY_IDS) if (p !== this.id) others += this.state.announced[p] ?? 0n;
    this.announce(ctx, steerContribution(others, this.id));
  }
}

export function createAnnounceParty(role: Role, id: PartyId): AnnounceParty {
  if (role === 'lastMover') return new LastMoverAnnounceParty(id);
  return new AnnounceParty(id);
}

export const ANNOUNCE_ROLES: Role[] = ['honest', 'lastMover'];
