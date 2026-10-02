import { describe, expect, it } from 'vitest';
import { ROOMS, assignRooms, fisherYates, hashWordStream } from './shuffle';
import { sampleScalar } from './field';
import { makePrng } from './prng';

describe('room shuffle', () => {
  it('assignRooms is deterministic and returns a permutation of the four rooms', () => {
    const rng = makePrng('rooms');
    for (let i = 0; i < 50; i++) {
      const s = sampleScalar(rng);
      const a = assignRooms(s);
      expect(assignRooms(s)).toEqual(a);
      expect([...a].sort()).toEqual([...ROOMS].sort());
    }
  });

  it('hashWordStream is deterministic and advances across blocks', () => {
    const seed = new Uint8Array(32).fill(7);
    const a = hashWordStream(seed);
    const b = hashWordStream(seed);
    const words = Array.from({ length: 20 }, () => a()); // > 8 words = > 1 SHA-256 block
    expect(Array.from({ length: 20 }, () => b())).toEqual(words);
    expect(new Set(words).size).toBeGreaterThan(15);
  });

  it('fisherYates with a constant zero source rotates deterministically', () => {
    // j is always 0: [0,1,2,3] → swap(3,0) → [3,1,2,0] → swap(2,0) → [2,1,3,0] → swap(1,0) → [1,2,3,0].
    expect(fisherYates([0, 1, 2, 3], () => 0)).toEqual([1, 2, 3, 0]);
  });

  it('all 24 permutations are equally likely over 20,000 seeds (chi-square)', () => {
    const rng = makePrng('chi-square');
    const counts = new Map<string, number>();
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const key = assignRooms(sampleScalar(rng)).join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(24);
    const expected = n / 24;
    let chi2 = 0;
    for (const c of counts.values()) chi2 += (c - expected) ** 2 / expected;
    // 23 degrees of freedom; p = 0.001 cutoff is 49.7.
    expect(chi2).toBeLessThan(49.7);
  });

  it('each party gets the master room about a quarter of the time', () => {
    const rng = makePrng('quarter');
    const master = [0, 0, 0, 0];
    const n = 8_000;
    for (let i = 0; i < n; i++) master[assignRooms(sampleScalar(rng)).indexOf('master')]!++;
    for (const m of master) {
      expect(m / n).toBeGreaterThan(0.22);
      expect(m / n).toBeLessThan(0.28);
    }
  });
});
