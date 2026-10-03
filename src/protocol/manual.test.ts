import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rolesFor } from './parties';
import { RUNG_PROTOCOLS, rungScenario } from './scenario';
import { DAVE, type Event } from './types';
import { simulateSync, share } from '../sim/simulate';

type Decision = Extract<Event, { kind: 'decision' }>;

describe('manual role: you play Dave', () => {
  it('is offered wherever Dave has a real decision', () => {
    for (const rung of [0, 1, 2, 3, 5] as const) expect(rolesFor(RUNG_PROTOCOLS[rung], DAVE)).toContain('manual');
    expect(rolesFor(RUNG_PROTOCOLS[0], 0)).not.toContain('manual'); // the others have nothing to decide on level 0
  });

  it("marks Dave's decisions as awaiting the user, with the honest option standing in", () => {
    const honest = runRound(rungScenario(2, 'honest', 'manual-2'));
    const manual = runRound(rungScenario(2, 'manual', 'manual-2'));
    const d = manual.log.events.filter((e): e is Decision => e.kind === 'decision' && e.by === DAVE);
    expect(d.length).toBeGreaterThan(0);
    for (const x of d) { expect(x.manual).toBe(true); expect(x.deviates).toBe(false); }
    expect(manual.result).toEqual(honest.result);
  });

  it('an override resolves the decision and the round follows it', () => {
    const base = runRound(rungScenario(2, 'manual', 'roommates'));
    const first = base.log.events.find((e): e is Decision => e.kind === 'decision' && e.by === DAVE)!;
    const chosen = runRound(rungScenario(2, 'manual', 'roommates'), { overrides: { [first.index]: 'wait' } });
    const d = chosen.log.events.find((e): e is Decision => e.kind === 'decision' && e.index === first.index)!;
    expect(d.manual).toBeUndefined();
    expect(d.chosen).toBe('wait');
    expect(d.deviates).toBe(true);
    const next = chosen.log.events.find((e): e is Decision => e.kind === 'decision' && e.by === DAVE && e.index > first.index)!;
    expect(next.manual).toBe(true); // the next decision now waits
  });

  it('plays honestly in bulk runs', () => {
    const t = simulateSync(rungScenario(2, 'manual', 'manual-bulk'), 300);
    expect(t.stuck).toBe(0);
    expect(Math.abs(share(t, DAVE, 'master') - 0.25)).toBeLessThan(0.1);
  });
});
