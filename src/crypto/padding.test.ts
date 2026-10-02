import { describe, expect, it } from 'vitest';
import { combine, pickOf } from './arrangements';
import { L } from './field';
import { makePrng } from './prng';
import { PADDED_MAX, isPadded, padPick, paddingOf, unpad } from './padding';

describe('rung-5 padding', () => {
  const rng = makePrng('padding');

  it('unpad(padPick(p)) = p for every pick, and padded values are padded', () => {
    for (let p = 0n; p < 24n; p++) {
      const s = padPick(p, rng);
      expect(unpad(s)).toBe(Number(p));
      expect(isPadded(s)).toBe(true);
      expect(isPadded(p)).toBe(false);
      expect(unpad(p)).toBe(Number(p));
      expect(paddingOf(s) * 24n + p).toBe(s);
    }
  });

  it('padded values stay below 24·2^240 and well below ℓ', () => {
    expect(PADDED_MAX).toBe(24n << 240n);
    expect(PADDED_MAX < 2n ** 245n).toBe(true);
    for (let i = 0; i < 200; i++) expect(padPick(BigInt(i % 24), rng) < PADDED_MAX).toBe(true);
  });

  it('sums of four padded secrets never wrap mod ℓ, so the combination rule survives', () => {
    expect(4n * PADDED_MAX < L).toBe(true);
    for (let i = 0; i < 100; i++) {
      const picks = [0, 1, 2, 3].map(() => BigInt(rng.below(24)));
      const padded = picks.map((p) => padPick(p, rng));
      const total = padded.reduce((a, b) => a + b, 0n);
      expect(total < L).toBe(true);
      expect(combine(padded)).toBe(combine(picks));
      expect(pickOf(total)).toBe(combine(picks));
    }
  });

  it('two paddings of the same pick differ, and the padding uses the full 240 bits', () => {
    const a = padPick(7n, rng);
    const b = padPick(7n, rng);
    expect(a).not.toBe(b);
    let highBitSeen = false;
    for (let i = 0; i < 200 && !highBitSeen; i++) highBitSeen = (paddingOf(padPick(0n, rng)) >> 239n) === 1n;
    expect(highBitSeen).toBe(true);
  });

  it('rejects picks outside 0..23', () => {
    expect(() => padPick(24n, rng)).toThrow(RangeError);
    expect(() => padPick(-1n, rng)).toThrow(RangeError);
  });
});
