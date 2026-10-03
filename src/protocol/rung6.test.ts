import { describe, expect, it } from 'vitest';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS } from './types';
import { share, simulateSync } from '../sim/simulate';

const N = 300;
const TOL = 0.1; // 4σ at n = 300
const SLOW = { timeout: 120_000 };

describe('rung 6: the threshold', () => {
  it('honest play is fair at every t', SLOW, () => {
    for (const t of [2, 3, 4]) {
      const tally = simulateSync(rungScenario(6, 'honest', `r6-h-${t}`, t), N);
      expect(tally.stuck).toBe(0);
      for (const p of PARTY_IDS) expect(Math.abs(share(tally, p, 'master') - 0.25)).toBeLessThan(TOL);
    }
  });

  it('t = 3: a quitter is rebuilt by the other three (liveness holds at f = 1)', SLOW, () => {
    const tally = simulateSync(rungScenario(6, 'aborter', 'r6-q3', 3), N);
    expect(tally.stuck).toBe(0);
    expect(Math.abs(share(tally, DAVE, 'master') - 0.25)).toBeLessThan(TOL);
  });

  it('t = 4: a quitter holds the house hostage: he wins, or nobody gets a room (liveness fails)', SLOW, () => {
    const tally = simulateSync(rungScenario(6, 'aborter', 'r6-q4', 4), N);
    // He quits whenever he would lose (~3/4 of rounds); those rounds are stuck for everyone.
    expect(Math.abs(tally.stuck / N - 0.75)).toBeLessThan(TOL);
    expect(tally.stuck).toBeGreaterThan(0);
    expect(share(tally, DAVE, 'master')).toBe(1); // of the rounds that finished
  });
});
