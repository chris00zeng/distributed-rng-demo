/**
 * Feldman verifiable secret sharing primitives (Technical Plan, Feldman VSS; D4, D5).
 *
 * The dealer with polynomial f(x) = a_0 + a_1 x + … + a_{t-1} x^{t-1} publishes
 * C_j = a_j·G for every coefficient. A recipient of share (x, y) checks
 *   y·G == Σ_j (x^j)·C_j,
 * which holds iff y = f(x). C_0 = a_0·G doubles as the commitment to the secret.
 *
 * Hiding is computational (discrete log). With a bare pick in 0..23 as a_0,
 * C_0 would be brute-forceable in 24 guesses, which is why rung 5 pads the
 * pick first (see padding.ts, D23). Pure functions; no state.
 */
import { ristretto255 } from '@noble/curves/ed25519.js';
import { L, type Scalar } from './field';

const Point = ristretto255.Point;
export type Point = typeof ristretto255.Point.BASE;

/** C_j = a_j·G for j = 0..t−1. */
export type Commitment = Point[];

export const G: Point = Point.BASE;
export const ZERO: Point = Point.ZERO;

if (Point.Fn.ORDER !== L) throw new Error('field.ts L does not match the ristretto255 group order');

/** s·G for any s in [0, ℓ). noble's constant-time `multiply` rejects 0, so handle it here. */
export function mulBase(s: Scalar): Point {
  if (s < 0n || s >= L) throw new RangeError('scalar out of range');
  return s === 0n ? ZERO : G.multiply(s);
}

/**
 * k·P for a *public* point P and a tiny public scalar k (x^j with x ≤ 4, j ≤ 3).
 * `multiplyUnsafe` is variable-time, which is fine here: both inputs are public.
 */
function mulPublic(p: Point, k: Scalar): Point {
  return k === 0n ? ZERO : p.multiplyUnsafe(k);
}

/** Commit to a polynomial given its coefficients [a_0, …, a_{t-1}]. */
export function commitPolynomial(coefficients: readonly Scalar[]): Commitment {
  if (coefficients.length === 0) throw new RangeError('empty polynomial');
  return coefficients.map(mulBase);
}

/** Does share (x, y) lie on the committed polynomial? */
export function verifyShare(commitment: Commitment, x: number, y: Scalar): boolean {
  if (!Number.isInteger(x) || x < 1) throw new RangeError('x must be a positive integer');
  if (y < 0n || y >= L) return false;
  let rhs = ZERO;
  let xPow = 1n;
  const bx = BigInt(x);
  for (const c of commitment) {
    rhs = rhs.add(mulPublic(c, xPow % L));
    xPow *= bx;
  }
  return mulBase(y).equals(rhs);
}

/** Reveal check: does `value` open the commitment, i.e. value·G == C_0? */
export function commitmentOpens(commitment: Commitment, value: Scalar): boolean {
  const c0 = commitment[0];
  if (!c0 || value < 0n || value >= L) return false;
  return mulBase(value).equals(c0);
}

export const POINT_BYTES = 32;

/** Serialise for transport: t × 32 bytes, concatenated. */
export function encodeCommitment(commitment: Commitment): Uint8Array {
  const out = new Uint8Array(commitment.length * POINT_BYTES);
  commitment.forEach((p, i) => out.set(p.toBytes(), i * POINT_BYTES));
  return out;
}

/** Inverse of encodeCommitment. Throws on a malformed length or an invalid point. */
export function decodeCommitment(bytes: Uint8Array): Commitment {
  if (bytes.length === 0 || bytes.length % POINT_BYTES !== 0) throw new RangeError('bad commitment length');
  const out: Commitment = [];
  for (let i = 0; i < bytes.length; i += POINT_BYTES) out.push(Point.fromBytes(bytes.slice(i, i + POINT_BYTES)));
  return out;
}

export function commitmentsEqual(a: Commitment, b: Commitment): boolean {
  return a.length === b.length && a.every((p, i) => p.equals(b[i]!));
}
