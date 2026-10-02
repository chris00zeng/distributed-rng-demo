import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS, type Event } from './types';
import { share, simulateSync } from '../sim/simulate';
import { isPadded, unpad } from '../crypto/padding';

const N = 1000;
const TOL = 0.055;
const SLOW = { timeout: 120_000 };

describe('rung 5: verifiable secret sharing', () => {
  it('honest play is fair, never restarts, and uses padded picks', SLOW, () => {
    const t = simulateSync(rungScenario(5, 'honest', 'r5-honest'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
    const { log } = runRound(rungScenario(5, 'honest', 'r5-pad'), { record: true });
    const last = log.views.at(-1)!;
    for (const p of PARTY_IDS) {
      expect(last[p]!.padded).toBe(true);
      expect(isPadded(last[p]!.myValue!)).toBe(true);
      expect(unpad(last[p]!.myValue!)).toBeLessThan(24);
      expect(last[p]!.myNonce).toBeUndefined();
    }
  });

  it('a bad dealer is caught before any reveal, thrown out, and the round completes without him', SLOW, () => {
    const t = simulateSync(rungScenario(5, 'badDealer', 'r5-bad'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
    const { log, result } = runRound(rungScenario(5, 'badDealer', 'r5-bad-one'), { record: true });
    expect(result.attempts).toBe(1);
    const events = log.events;
    const complaint = events.findIndex((e) => e.kind === 'deliver' && e.env.msg.kind === 'complaint');
    const firstReveal = events.findIndex((e) => e.kind === 'deliver' && e.env.msg.kind === 'reveal');
    expect(complaint).toBeGreaterThan(-1);
    expect(complaint).toBeLessThan(firstReveal);
    const last = log.views.at(-1)!;
    for (const p of [0, 1, 2] as const) {
      expect(last[p]!.disqualified).toEqual([DAVE]);
      expect(last[p]!.excluded).toContain(DAVE);
    }
    expect(events.some((e) => e.kind === 'void')).toBe(false);
  });

  it('a forged reconstruction share is rejected and Ana is rebuilt from the honest ones', SLOW, () => {
    const t = simulateSync(rungScenario(5, 'fakeShare', 'r5-fake'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      const { log, result } = runRound(rungScenario(5, 'fakeShare', `r5-fake-${i}`), { record: true });
      expect(result.attempts).toBe(1);
      const forged = log.events.some((e): e is Extract<Event, { kind: 'decision' }> => e.kind === 'decision' && e.by === DAVE && e.chosen === 'forge');
      if (!forged) continue;
      rejected++;
      const last = log.views.at(-1)!;
      for (const p of [0, 2] as const) expect(last[p]!.rejected).toEqual([DAVE]);
      expect(last[0]!.reconstructed[1]).toBe(last[1]!.myValue);
    }
    expect(rejected).toBeGreaterThan(0);
  });

  it('a quitter is reconstructed exactly as on rung 3', SLOW, () => {
    const t = simulateSync(rungScenario(5, 'aborter', 'r5-quit'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });

  it('the batched share check verifies honest shares and the bad dealer is found individually', () => {
    const { log } = runRound(rungScenario(5, 'badDealer', 'r5-batch'), { record: true });
    const checked = log.events.filter((e) => e.kind === 'deliver' && e.env.msg.kind === 'checked');
    expect(checked.length).toBeGreaterThan(0);
    const complaints = log.events.filter((e) => e.kind === 'deliver' && e.env.msg.kind === 'complaint' && e.env.msg.dealer === DAVE);
    expect(complaints.length).toBeGreaterThan(0);
    const wrongComplaints = log.events.filter((e) => e.kind === 'deliver' && e.env.msg.kind === 'complaint' && e.env.msg.dealer !== DAVE);
    expect(wrongComplaints.length).toBe(0);
  });

  it('cost: 1,000 honest rounds in Node', SLOW, () => {
    const t0 = performance.now();
    simulateSync(rungScenario(5, 'honest', 'r5-bench'), N);
    const ms = performance.now() - t0;
    // The UI budget is measured in the browser; this guards against a 10x regression.
    expect(ms, `rung 5: ${ms.toFixed(0)} ms for 1,000 rounds`).toBeLessThan(30_000);
  });
});
