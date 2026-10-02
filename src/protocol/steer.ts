/**
 * How a cheater who controls the last contribution picks it (Technical Plan D22):
 * 6 of the 24 arrangements give them the Royal Suite, so they add up what the
 * others contributed and choose the pick that lands on one. No search.
 */
import { steerPick } from '../crypto/arrangements';
import type { Scalar } from '../crypto/field';
import type { PartyId } from './types';

export function steerContribution(othersTotal: Scalar, me: PartyId): Scalar {
  return steerPick(othersTotal, me);
}

/** Pick an arrangement number directly (rung 0's lying dealer). */
export function steerCombined(me: PartyId): Scalar {
  return steerPick(0n, me);
}
