/** Rung 0: one roommate (Dave) rolls for everyone. */
import { sampleScalar } from '../../crypto/field';
import { DAVE, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { steerCombined } from '../steer';
import { BaseParty } from './base';

export class TrustedParty extends BaseParty {
  constructor(id: PartyId) {
    super(id, 'announce');
  }

  protected roll(ctx: Ctx) {
    return sampleScalar(ctx.rng);
  }

  onStart(ctx: Ctx): void {
    if (this.id !== DAVE) {
      this.state.note = 'waiting for Dave to roll';
      return;
    }
    const s = this.roll(ctx);
    this.state.myValue = s;
    ctx.send('all', { kind: 'announce', value: s });
    this.finishWith(s);
  }

  onMessage(env: Envelope): void {
    if (env.msg.kind !== 'announce' || env.from !== DAVE) return;
    this.state.announced[DAVE] = env.msg.value;
    this.finishWith(env.msg.value);
  }
}

/** Dave announces a roll that happens to give him the master room. */
export class LiarTrustedParty extends TrustedParty {
  protected override roll(ctx: Ctx) {
    return steerCombined(ctx.rng, this.id);
  }
}

export function createTrustedParty(role: Role, id: PartyId): TrustedParty {
  if (role === 'liar' && id === DAVE) return new LiarTrustedParty(id);
  return new TrustedParty(id);
}

export const TRUSTED_ROLES: Record<'dealer' | 'other', Role[]> = {
  dealer: ['honest', 'liar'],
  other: ['honest'],
};
