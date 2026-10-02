import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS, type Event } from './types';
import { share, simulateSync } from '../sim/simulate';

const N = 1000;
const TOL = 0.055;

describe('rung 4: one bad dealer (D25: all shares used, inconsistency voids the round)', () => {
  it('honest play on rung 4 is fair and never restarts', () => {
    const t = simulateSync(rungScenario(4, 'honest', 'r4-honest'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });

  // Rung 4 rounds restart ~4 times and reconstruct with BigInt interpolation; slow on CI runners.
  const SLOW = { timeout: 60_000 };

  it('a bad dealer takes the suite every time, by forcing restarts until he wins', SLOW, () => {
    const t = simulateSync(rungScenario(4, 'badDealer', 'r4-bad'), N);
    expect(share(t, DAVE, 'master')).toBe(1);
    expect(t.stuck).toBe(0);
    const mean = t.attempts / t.rounds;
    expect(mean).toBeGreaterThan(3.4);
    expect(mean).toBeLessThan(4.6);
  });

  it('a forged share during Ana\'s reconstruction has the same effect', SLOW, () => {
    const t = simulateSync(rungScenario(4, 'fakeShare', 'r4-fake'), N);
    expect(share(t, DAVE, 'master')).toBe(1);
    expect(t.stuck).toBe(0);
    const mean = t.attempts / t.rounds;
    expect(mean).toBeGreaterThan(3.4);
    expect(mean).toBeLessThan(4.6);
  });

  it('a bad dealer who would win simply reveals; one who would lose quits and an honest party voids the round', () => {
    // Find a seed where the first attempt loses, so a void is observed.
    for (let i = 0; i < 20; i++) {
      const { log, result } = runRound(rungScenario(4, 'badDealer', `r4-void-${i}`), { record: true });
      if (result.attempts === 1) continue;
      const voids = log.events.filter((e): e is Extract<Event, { kind: 'void' }> => e.kind === 'void');
      expect(voids.length).toBe(result.attempts - 1);
      for (const v of voids) {
        expect(v.by).not.toBe(DAVE);
        expect(v.reason).toMatch(/shares do not add up/);
      }
      // The honest party that voided could see the disagreement but never names Dave.
      const voidStep = log.events.indexOf(voids[0]!);
      const view = log.views[voidStep]![voids[0]!.by]!;
      expect(view.note).toMatch(/cannot tell who/);
      return;
    }
    throw new Error('no losing first attempt found in 20 seeds');
  });

  it('the forger only forges when he knows he is losing; Ana\'s dead phone is reconstructed otherwise', () => {
    let forged = 0, honestRebuilds = 0;
    for (let i = 0; i < 30; i++) {
      const { log } = runRound(rungScenario(4, 'fakeShare', `r4-forge-${i}`));
      const decisions = log.events.filter((e): e is Extract<Event, { kind: 'decision' }> => e.kind === 'decision' && e.by === DAVE && e.point.kind === 'reconstructShare');
      for (const d of decisions) {
        if (d.chosen === 'forge') { forged++; expect(d.point.context?.knowsValue).toBe(true); expect(d.point.context?.wouldWin).toBe(false); }
        else { honestRebuilds++; expect(d.point.context?.wouldWin).toBe(true); }
      }
    }
    expect(forged).toBeGreaterThan(0);
    expect(honestRebuilds).toBeGreaterThan(0);
  });

  it('rung 3 is unchanged by the stricter reconstruction rule', SLOW, () => {
    for (const role of ['honest', 'aborter'] as const) {
      const t = simulateSync(rungScenario(3, role, `r3-again-${role}`), N);
      expect(t.stuck).toBe(0);
      expect(t.attempts).toBe(N);
      for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
    }
  });
});
