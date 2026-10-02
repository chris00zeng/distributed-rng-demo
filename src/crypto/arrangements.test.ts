import { describe, expect, it } from 'vitest';
import {
  ARRANGEMENTS, N_ARRANGEMENTS, ROOMS, arrangement, combine, indexOfArrangement, pickOf, samplePick,
  steerPick, winningIndices,
} from './arrangements';
import { makePrng } from './prng';

describe('arrangements', () => {
  it('lists 24 distinct permutations of the four rooms, lexicographic', () => {
    expect(ARRANGEMENTS.length).toBe(N_ARRANGEMENTS);
    const keys = new Set(ARRANGEMENTS.map((a) => a.join(',')));
    expect(keys.size).toBe(24);
    for (const a of ARRANGEMENTS) expect([...a].sort()).toEqual([...ROOMS].sort());
    expect(arrangement(0)).toEqual(['master', 'decent', 'small', 'closet']);
    expect(arrangement(23)).toEqual(['closet', 'small', 'decent', 'master']);
    ARRANGEMENTS.forEach((a, k) => expect(indexOfArrangement(a)).toBe(k));
  });

  it('every party wins every room in exactly 6 arrangements', () => {
    for (let p = 0; p < 4; p++) for (const room of ROOMS) expect(winningIndices(p, room).length).toBe(6);
  });

  it('pickOf and combine wrap at 24 over integers, not the field', () => {
    expect(pickOf(0n)).toBe(0);
    expect(pickOf(23n)).toBe(23);
    expect(pickOf(24n)).toBe(0);
    expect(pickOf(17n + 24n * 123456789n)).toBe(17);
    expect(combine([17n, 4n, 22n, 9n])).toBe(52 % 24);
    expect(combine([1n + 24n * 5n, 2n + 24n * 7n])).toBe(3);
  });

  it('one uniform pick makes the sum uniform regardless of the others (chi-square)', () => {
    const rng = makePrng('arrangements-uniform');
    const counts = new Array<number>(24).fill(0);
    const n = 24_000;
    for (let i = 0; i < n; i++) {
      const fixed = [5n, 19n, 11n]; // three adversarial constants
      counts[combine([...fixed, samplePick(rng)])]!++;
    }
    const expected = n / 24;
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
    expect(chi2).toBeLessThan(49.7); // 23 dof, p = 0.001
  });

  it('steerPick always lands the party in the room it wants', () => {
    const rng = makePrng('steer');
    for (let i = 0; i < 200; i++) {
      const others = [samplePick(rng), samplePick(rng), samplePick(rng)];
      const total = others.reduce((a, b) => a + b, 0n);
      for (let party = 0; party < 4; party++) {
        const p = steerPick(total, party);
        expect(p >= 0n && p < 24n).toBe(true);
        expect(arrangement(combine([...others, p]))[party]).toBe('master');
      }
    }
  });
});
