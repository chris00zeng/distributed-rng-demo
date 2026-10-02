/**
 * How a cheater who controls the last contribution picks it (Technical Plan D18):
 * try random candidates until the resulting permutation gives them the master
 * room. Expected 4 tries with four rooms. Honest about how the attack works.
 */
import { add, sampleScalar, type Scalar } from '../crypto/field';
import type { Prng } from '../crypto/prng';
import { assignRooms } from '../crypto/shuffle';
import type { PartyId } from './types';

export function steerContribution(rng: Prng, othersSum: Scalar, me: PartyId): Scalar {
  for (let tries = 0; tries < 10_000; tries++) {
    const s = sampleScalar(rng);
    if (assignRooms(add(othersSum, s))[me] === 'master') return s;
  }
  throw new Error('steer: no winning contribution found');
}

/** Pick a combined value directly (rung 0's lying dealer). */
export function steerCombined(rng: Prng, me: PartyId): Scalar {
  return steerContribution(rng, 0n, me);
}
