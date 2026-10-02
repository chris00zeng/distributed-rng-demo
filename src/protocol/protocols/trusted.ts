/** Rung 0: one roommate (Dave) rolls an arrangement number for everyone. */
import { samplePick } from '../../crypto/arrangements';
import { DAVE, type Ctx, type Envelope, type PartyId, type Role } from '../types';
import { steerCombined } from '../steer';
import { BaseParty } from './base';

export class TrustedParty extends BaseParty {
  constructor(id: PartyId) {
    super(id, 'announce');
  }

  onStart(ctx: Ctx): void {
    if (this.id !== DAVE) {
      this.state.note = 'waiting for Dave to roll';
      return;
    }
    const choice = ctx.decide({
      kind: 'roll',
      prompt: 'Dave rolls for everyone',
      options: [
        { id: 'honest', label: 'roll honestly', honest: true },
        { id: 'win', label: 'announce a number that puts him in the suite', honest: false },
      ],
    });
    const s = choice === 'win' ? steerCombined(this.id) : samplePick(ctx.rng);
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

export const TRUSTED_ROLES: Record<'dealer' | 'other', Role[]> = {
  dealer: ['honest', 'liar'],
  other: ['honest'],
};
