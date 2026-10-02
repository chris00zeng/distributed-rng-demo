/**
 * Rung-5 padding (Technical Plan D23).
 *
 * A pick is one of 24 numbers. A Feldman commitment C_0 = pick·G to a bare pick
 * is brute-forceable in 24 guesses, so from rung 5 the dealt secret is
 *   s = pick + 24·r,  r uniform in [0, 2^240).
 * The pick is read back as s mod 24, and the combination rule is unchanged
 * because 24·r ≡ 0 (mod 24).
 *
 * Bound: s < 24·2^240 < 2^245, so the integer sum of four padded secrets is
 * below 2^247 < ℓ ≈ 2^252. Sums therefore never wrap mod ℓ and the mod-24
 * relation survives. (Shamir shares of s are still full field elements.)
 */
import { N_ARRANGEMENTS, pickOf } from './arrangements';
import { bytesToBigInt, type Scalar } from './field';
import type { Prng } from './prng';

export const PAD_BITS = 240;
const PAD_BYTES = PAD_BITS / 8;
/** Exclusive upper bound on a padded secret. */
export const PADDED_MAX: Scalar = BigInt(N_ARRANGEMENTS) << BigInt(PAD_BITS);

export function padPick(pick: Scalar, rng: Prng): Scalar {
  if (pick < 0n || pick >= BigInt(N_ARRANGEMENTS)) throw new RangeError('pick must be in 0..23');
  const r = bytesToBigInt(rng.bytes(PAD_BYTES)); // uniform in [0, 2^240)
  return pick + BigInt(N_ARRANGEMENTS) * r;
}

/** True once a value carries padding (anything that is not a bare pick). */
export function isPadded(value: Scalar): boolean {
  return value >= BigInt(N_ARRANGEMENTS);
}

/** The pick hidden in a padded secret. Identity on bare picks. */
export function unpad(value: Scalar): number {
  return pickOf(value);
}

/** The random part, for display: (value − pick) / 24. */
export function paddingOf(value: Scalar): Scalar {
  return (value - BigInt(unpad(value))) / BigInt(N_ARRANGEMENTS);
}
