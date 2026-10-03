import { describe, expect, it } from 'vitest';
import { maxTolerated, regime } from './threshold';

describe('threshold regimes (rung 6)', () => {
  it('n = 4: one cheater is tolerable, two are not, for every t', () => {
    expect(regime(4, 2, 1)).toBe('safe');
    expect(regime(4, 3, 1)).toBe('safe');
    expect(regime(4, 4, 1)).toBe('stuck');
    for (const t of [2, 3, 4]) expect(regime(4, t, 2)).not.toBe('safe');
    expect(regime(4, 2, 2)).toBe('leaky');
    expect(regime(4, 3, 2)).toBe('stuck');
    expect(regime(4, 4, 2)).toBe('stuck');
    expect(regime(4, 2, 3)).toBe('broken');
    expect(maxTolerated(4)).toBe(1);
  });

  it('n ≥ 2f + 1 is exactly the safe region', () => {
    for (let n = 2; n <= 9; n++) {
      for (let f = 0; f <= n; f++) {
        const someSafe = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => t <= n).some((t) => regime(n, t, f) === 'safe');
        expect(someSafe).toBe(n >= 2 * f + 1);
      }
    }
    expect(maxTolerated(7)).toBe(3);
  });
});
