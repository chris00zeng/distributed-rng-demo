import { describe, expect, it } from 'vitest';
import { rungScenario } from '../protocol/scenario';
import { DAVE, PARTY_IDS } from '../protocol/types';
import { share, simulateSync } from './simulate';

const N = 1000;
// Binomial sd at p = 1/4, n = 1000 is 0.0137; 4σ ≈ 0.055.
const TOL = 0.055;

describe('fairness simulation, rungs 0 to 2', () => {
  it('honest play is fair on every rung', () => {
    for (const rung of [0, 1, 2] as const) {
      const t = simulateSync(rungScenario(rung, 'honest', `fair-${rung}`), N);
      expect(t.stuck).toBe(0);
      expect(t.attempts).toBe(N);
      for (const p of PARTY_IDS) {
        expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
      }
    }
  });

  it('rung 0: a lying dealer takes the master room every time', () => {
    const t = simulateSync(rungScenario(0, 'liar', 'liar'), N);
    expect(share(t, DAVE, 'master')).toBe(1);
    expect(t.stuck).toBe(0);
  });

  it('rung 1: the last mover takes the master room every time', () => {
    const t = simulateSync(rungScenario(1, 'lastMover', 'last'), N);
    expect(share(t, DAVE, 'master')).toBe(1);
    expect(t.stuck).toBe(0);
  });

  it('rung 2: an aborter takes the master room every time, in about 4 attempts', () => {
    const t = simulateSync(rungScenario(2, 'aborter', 'aborter'), N);
    expect(share(t, DAVE, 'master')).toBe(1);
    expect(t.stuck).toBe(0);
    const mean = t.attempts / t.rounds;
    expect(mean).toBeGreaterThan(3.4);
    expect(mean).toBeLessThan(4.6);
  });

  it('the other three still get the remaining rooms fairly when Dave cheats', () => {
    const t = simulateSync(rungScenario(2, 'aborter', 'rest'), N);
    for (const p of [0, 1, 2] as const) {
      expect(share(t, p, 'master')).toBe(0);
      // Dave takes master, so the others split decent/small/closet: 1/3 each.
      expect(Math.abs(share(t, p, 'decent') - 1 / 3)).toBeLessThan(0.06);
    }
  });
});
