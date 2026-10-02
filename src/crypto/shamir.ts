/**
 * Shamir secret sharing over Z_ℓ (Technical Plan, Shamir; D5).
 * Dealer: f(x) = s + a_1 x + … + a_{t-1} x^{t-1}; party i holds (i, f(i)).
 * Any t points reconstruct s = f(0) by Lagrange interpolation.
 */
import { add, inv, mod, mul, sampleScalar, sub, type Scalar } from './field';
import type { Prng } from './prng';

export interface Share {
  x: number;
  y: Scalar;
}

/** Coefficients [a_0 = secret, a_1, …, a_{t-1}], uniformly random above the constant term. */
export function samplePolynomial(secret: Scalar, t: number, rng: Prng): Scalar[] {
  if (!Number.isInteger(t) || t < 1) throw new RangeError('t must be a positive integer');
  const coeffs = [mod(secret)];
  for (let j = 1; j < t; j++) coeffs.push(sampleScalar(rng));
  return coeffs;
}

/** Horner evaluation of the polynomial at a small integer x. */
export function evalPolynomial(coeffs: readonly Scalar[], x: number): Scalar {
  const bx = BigInt(x);
  let acc: Scalar = 0n;
  for (let j = coeffs.length - 1; j >= 0; j--) acc = add(mul(acc, bx), coeffs[j]!);
  return acc;
}

/** Shares for parties x = 1..n from a polynomial. */
export function sharesFrom(coeffs: readonly Scalar[], n: number): Share[] {
  const out: Share[] = [];
  for (let x = 1; x <= n; x++) out.push({ x, y: evalPolynomial(coeffs, x) });
  return out;
}

/** Deal `n` shares of `secret` with threshold `t`. */
export function deal(secret: Scalar, t: number, n: number, rng: Prng): Share[] {
  return sharesFrom(samplePolynomial(secret, t, rng), n);
}

/**
 * Lagrange interpolation at 0 over the given points. Uses every point passed,
 * so callers choose which t shares to trust (Technical Plan D11).
 */
export function reconstruct(shares: readonly Share[]): Scalar {
  if (shares.length === 0) throw new RangeError('no shares');
  const xs = shares.map((s) => s.x);
  if (new Set(xs).size !== xs.length) throw new RangeError('duplicate x');
  let secret: Scalar = 0n;
  for (const { x: xj, y: yj } of shares) {
    let num: Scalar = 1n;
    let den: Scalar = 1n;
    for (const { x: xk } of shares) {
      if (xk === xj) continue;
      num = mul(num, BigInt(xk));
      den = mul(den, sub(BigInt(xk), BigInt(xj)));
    }
    secret = add(secret, mul(yj, mul(num, inv(den))));
  }
  return secret;
}

/** The lowest-indexed `t` shares: the textbook "any t suffice" choice. */
export function lowestT(shares: readonly Share[], t: number): Share[] {
  return [...shares].sort((a, b) => a.x - b.x).slice(0, t);
}
