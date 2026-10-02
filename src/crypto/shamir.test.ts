import { describe, expect, it } from 'vitest';
import { sampleScalar } from './field';
import { makePrng } from './prng';
import { deal, evalPolynomial, lowestT, reconstruct, samplePolynomial, sharesFrom, type Share } from './shamir';

function subsets<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items as [T, ...T[]];
  return [...subsets(rest, k - 1).map((s) => [head, ...s]), ...subsets(rest, k)];
}

describe('Shamir over Z_ℓ', () => {
  it('evaluates polynomials correctly on a hand-computed case', () => {
    // f(x) = 5 + 3x + 2x^2 → f(1) = 10, f(2) = 19, f(3) = 32
    expect(sharesFrom([5n, 3n, 2n], 3).map((s) => s.y)).toEqual([10n, 19n, 32n]);
    expect(evalPolynomial([5n, 3n, 2n], 0)).toBe(5n);
  });

  it('every t-subset of 4 shares reconstructs the secret, for t in {2,3,4}', () => {
    const rng = makePrng('shamir-recon');
    for (let trial = 0; trial < 20; trial++) {
      const secret = sampleScalar(rng);
      const t = 2 + (trial % 3);
      const shares = deal(secret, t, 4, rng);
      expect(shares.map((s) => s.x)).toEqual([1, 2, 3, 4]);
      for (const sub of subsets(shares, t)) expect(reconstruct(sub)).toBe(secret);
      // More than t shares (all on one polynomial) also agree.
      expect(reconstruct(shares)).toBe(secret);
    }
  });

  it('t−1 shares reveal nothing: any guessed point is consistent with some polynomial', () => {
    const rng = makePrng('shamir-hiding');
    for (let trial = 0; trial < 10; trial++) {
      const secret = sampleScalar(rng);
      const t = 2 + (trial % 3);
      const shares = deal(secret, t, 4, rng);
      const partial = shares.slice(0, t - 1);
      // Pretend the missing point has any y we like: interpolation then yields a
      // different "secret" every time, so t−1 shares cannot pin it down.
      const guesses = new Set<bigint>();
      for (let g = 0; g < 5; g++) {
        const fake: Share = { x: 4 + g + 1, y: sampleScalar(rng) };
        guesses.add(reconstruct([...partial, fake]));
      }
      expect(guesses.size).toBe(5);
      expect(guesses.has(secret)).toBe(false);
    }
  });

  it('lowestT picks the lowest party indices', () => {
    const shares: Share[] = [{ x: 3, y: 1n }, { x: 1, y: 2n }, { x: 4, y: 3n }, { x: 2, y: 4n }];
    expect(lowestT(shares, 2).map((s) => s.x)).toEqual([1, 2]);
  });

  it('rejects bad input', () => {
    expect(() => samplePolynomial(1n, 0, makePrng('x'))).toThrow(RangeError);
    expect(() => reconstruct([])).toThrow(RangeError);
    expect(() => reconstruct([{ x: 1, y: 1n }, { x: 1, y: 2n }])).toThrow(RangeError);
  });
});

describe('consistency check (D25)', () => {
  it('honest shares are consistent; one tampered share is not; t shares are always consistent', async () => {
    const { isConsistent, deal, interpolate, evalPolynomial } = await import('./shamir');
    const { makePrng } = await import('./prng');
    const rng = makePrng('consistency');
    for (const t of [2, 3]) {
      const shares = deal(17n, t, 4, rng);
      expect(isConsistent(shares, t)).toBe(true);
      const bad = shares.map((s, i) => (i === 2 ? { ...s, y: s.y + 1n } : s));
      expect(isConsistent(bad, t)).toBe(false);
      expect(isConsistent(bad.slice(0, t), t)).toBe(true);
      const coeffs = interpolate(shares.slice(0, t));
      expect(coeffs[0]).toBe(17n);
      for (const s of shares) expect(evalPolynomial(coeffs, s.x)).toBe(s.y);
    }
  });
});
