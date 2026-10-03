import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { EXPERIMENTS } from './experiments';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS, type Event } from './types';
import { share, simulateSync } from '../sim/simulate';

const N = 600;
const TOL = 0.08; // 4σ at n = 600 for p ≈ 0.25..0.7
const SLOW = { timeout: 300_000 };
const exp = (id: string) => EXPERIMENTS.find((e) => e.id === id)!.scenario;

describe('collusion (D28)', () => {
  it('two colluders at t = 2 peek before the reveal and Dave takes the suite about 68% of the time', SLOW, () => {
    const t = simulateSync(exp('colluders-t2'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    expect(Math.abs(share(t, DAVE, 'master') - (1 - 0.75 ** 4))).toBeLessThan(TOL);
    const { log } = runRound(exp('colluders-t2'), { record: true });
    const kinds = log.events.filter((e): e is Extract<Event, { kind: 'decision' }> => e.kind === 'decision');
    expect(kinds.some((d) => d.by === 2 && d.point.kind === 'leak' && d.chosen === 'forward')).toBe(true);
    expect(kinds.some((d) => d.by === DAVE && d.point.kind === 'withhold')).toBe(true);
    expect(log.events.some((e) => e.kind === 'deliver' && e.env.msg.kind === 'forward' && e.env.to === DAVE)).toBe(true);
  });

  it('two colluders at t = 3 cannot peek and deal honestly: fair', SLOW, () => {
    const t = simulateSync(exp('colluders-t3'), N);
    expect(t.stuck).toBe(0);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
    const { log } = runRound(exp('colluders-t3'), { record: true });
    expect(log.events.some((e) => e.kind === 'decision' && e.by === DAVE && e.point.kind === 'withhold')).toBe(false);
  });

  it('one colluder alone is just honest with a wait', SLOW, () => {
    const t = simulateSync(rungScenario(6, 'colluder', 'lonely', 2), N);
    expect(t.stuck).toBe(0);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });

  it('two quitters on level 2: the one who blinks first loses; they split the suite and the honest two never get it', SLOW, () => {
    const t = simulateSync(exp('two-quitters'), N);
    expect(t.stuck).toBe(0);
    expect(share(t, 0, 'master') + share(t, 1, 'master')).toBeLessThan(0.02);
    for (const p of [2, 3] as const) {
      expect(share(t, p, 'master')).toBeGreaterThan(0.3);
      expect(share(t, p, 'master')).toBeLessThan(0.7);
    }
  });

  it('an honest house with a dead phone at t = 4 is stuck every round', SLOW, () => {
    const t = simulateSync(exp('dead-phone-t4'), 100);
    expect(t.stuck).toBe(100);
  });

  it('the ladder levels are unchanged', SLOW, () => {
    for (const [rung, role] of [[3, 'aborter'], [5, 'badDealer']] as const) {
      const t = simulateSync(rungScenario(rung, role, `unchanged-${rung}`), 300);
      expect(t.stuck).toBe(0);
      expect(Math.abs(share(t, DAVE, 'master') - 0.25)).toBeLessThan(0.1);
    }
  });
});
