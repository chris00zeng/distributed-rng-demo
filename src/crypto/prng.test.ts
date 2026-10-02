import { describe, expect, it } from 'vitest';
import { makePrng, rejectionThreshold, uniformBelow, deriveSeed } from './prng';

describe('seeded PRNG', () => {
  it('is deterministic for the same seed', () => {
    const a = makePrng('hello');
    const b = makePrng('hello');
    for (let i = 0; i < 100; i++) expect(a.u32()).toBe(b.u32());
    expect(makePrng('x').bytes(16)).toEqual(makePrng('x').bytes(16));
  });

  it('differs across seeds', () => {
    const a = makePrng('seed-1');
    const b = makePrng('seed-2');
    const same = Array.from({ length: 16 }, () => a.u32() === b.u32()).filter(Boolean).length;
    expect(same).toBeLessThan(3);
  });

  it('bytes(n) returns exactly n bytes and is not all zero', () => {
    const rng = makePrng('bytes');
    for (const n of [0, 1, 3, 4, 5, 31, 32, 64]) {
      const b = rng.bytes(n);
      expect(b.length).toBe(n);
    }
    expect(rng.bytes(64).some((x) => x !== 0)).toBe(true);
  });

  it('u32 output is roughly uniform across 16 buckets', () => {
    const rng = makePrng('uniform');
    const buckets = new Array<number>(16).fill(0);
    const n = 16_000;
    for (let i = 0; i < n; i++) buckets[rng.u32() >>> 28]!++;
    const expected = n / 16;
    const chi2 = buckets.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(40); // 15 dof; p=0.001 cutoff is 37.7
  });
});

describe('rejection sampling', () => {
  it('threshold is floor(2^32 / k) · k', () => {
    for (let k = 1; k <= 10; k++) {
      expect(rejectionThreshold(k)).toBe(Math.floor(2 ** 32 / k) * k);
    }
    expect(rejectionThreshold(3)).toBe(4294967295); // 2^32 - 1
    expect(rejectionThreshold(4)).toBe(2 ** 32);
    expect(() => rejectionThreshold(0)).toThrow(RangeError);
  });

  it('rejects draws at or above the threshold and then accepts', () => {
    const k = 3;
    const limit = rejectionThreshold(k);
    const draws = [limit, 2 ** 32 - 1, 5]; // first two rejected, 5 % 3 = 2
    let i = 0;
    const next = () => draws[i++]!;
    expect(uniformBelow(k, next)).toBe(2);
    expect(i).toBe(3);
  });

  it('k = 1 consumes nothing', () => {
    expect(uniformBelow(1, () => { throw new Error('should not draw'); })).toBe(0);
  });

  it('below(k) is uniform', () => {
    const rng = makePrng('below');
    const k = 7;
    const counts = new Array<number>(k).fill(0);
    const n = 70_000;
    for (let i = 0; i < n; i++) counts[rng.below(k)]!++;
    const expected = n / k;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(25); // 6 dof; p=0.001 cutoff is 22.5
  });
});

describe('deriveSeed', () => {
  it('is deterministic, label-sensitive and hex', () => {
    expect(deriveSeed('s', 0)).toBe(deriveSeed('s', 0));
    expect(deriveSeed('s', 0)).not.toBe(deriveSeed('s', 1));
    expect(deriveSeed('s', 0)).not.toBe(deriveSeed('t', 0));
    expect(deriveSeed('s', 'a')).toMatch(/^[0-9a-f]{64}$/);
  });
});
