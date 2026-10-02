/**
 * Arithmetic in Z_ℓ, where ℓ is the order of the ristretto255 group
 * (ℓ = 2^252 + 27742317777372353535851937790883648493, prime).
 *
 * One field serves every rung: plain Shamir on rungs 3 and 4, Feldman
 * commitments on rungs 5 and 6, and the combination sum on all of them
 * (Technical Plan D5). Values are plain `bigint`s in [0, ℓ).
 */
import type { Prng } from './prng';

export type Scalar = bigint;

/** Group order of ristretto255 (same as ed25519's prime-order subgroup). */
export const L: Scalar = 2n ** 252n + 27742317777372353535851937790883648493n;

/** Reduce any integer, including negatives, into [0, ℓ). */
export function mod(a: bigint): Scalar {
  const r = a % L;
  return r < 0n ? r + L : r;
}

export const add = (a: Scalar, b: Scalar): Scalar => mod(a + b);
export const sub = (a: Scalar, b: Scalar): Scalar => mod(a - b);
export const mul = (a: Scalar, b: Scalar): Scalar => mod(a * b);
export const neg = (a: Scalar): Scalar => mod(-a);

/** a^e mod ℓ by square-and-multiply. e must be non-negative. */
export function pow(a: Scalar, e: bigint): Scalar {
  if (e < 0n) throw new RangeError('negative exponent');
  let base = mod(a);
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = mul(result, base);
    base = mul(base, base);
    e >>= 1n;
  }
  return result;
}

/** Multiplicative inverse via Fermat (ℓ is prime). Throws on 0. */
export function inv(a: Scalar): Scalar {
  const r = mod(a);
  if (r === 0n) throw new RangeError('inverse of zero');
  return pow(r, L - 2n);
}

export function isScalar(a: bigint): boolean {
  return a >= 0n && a < L;
}

/** Big-endian bytes → bigint (unreduced). */
export function bytesToBigInt(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  return n;
}

/** Scalar → fixed 32-byte big-endian encoding. Throws if out of range. */
export function scalarToBytes(s: Scalar): Uint8Array {
  if (!isScalar(s)) throw new RangeError('scalar out of range');
  const out = new Uint8Array(32);
  let n = s;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return out;
}

export function bytesToScalar(bytes: Uint8Array): Scalar {
  if (bytes.length !== 32) throw new RangeError('expected 32 bytes');
  const n = bytesToBigInt(bytes);
  if (!isScalar(n)) throw new RangeError('scalar out of range');
  return n;
}

/**
 * Uniform scalar: 64 random bytes reduced mod ℓ. The bias is below 2^-260,
 * the standard technique for this field (Technical Plan, Field and sampling).
 */
export function sampleScalar(rng: Prng): Scalar {
  return mod(bytesToBigInt(rng.bytes(64)));
}

/** Uniform *non-zero* scalar, for polynomial coefficients that must not vanish. */
export function sampleNonZeroScalar(rng: Prng): Scalar {
  for (;;) {
    const s = sampleScalar(rng);
    if (s !== 0n) return s;
  }
}
