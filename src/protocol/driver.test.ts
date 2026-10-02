import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS } from './types';

describe('driver', () => {
  it('is deterministic: same scenario and seed give a deep-equal log', () => {
    for (const s of [rungScenario(0, 'liar', 'det'), rungScenario(1, 'lastMover', 'det'), rungScenario(2, 'aborter', 'det')]) {
      const a = runRound(s, { record: true });
      const b = runRound(s, { record: true });
      expect(a.log.events).toEqual(b.log.events);
      expect(a.log.views).toEqual(b.log.views);
      expect(a.result).toEqual(b.result);
    }
  });

  it('different seeds give different outcomes somewhere', () => {
    const a = runRound(rungScenario(1, 'honest', 'seed-a')).result;
    const b = runRound(rungScenario(1, 'honest', 'seed-b')).result;
    expect(a.assignment).not.toEqual(b.assignment);
  });

  it('honest commit-reveal finishes in one attempt with everyone agreeing', () => {
    const { log, result } = runRound(rungScenario(2, 'honest', 'cr'), { record: true });
    expect(result.outcome).toBe('assigned');
    expect(result.attempts).toBe(1);
    const last = log.views.at(-1)!;
    for (const p of PARTY_IDS) expect(last[p]!.assignment).toEqual(result.assignment);
    expect(log.events.filter((e) => e.kind === 'phase').map((e) => (e.kind === 'phase' ? e.phase : ''))).toEqual(['commit', 'reveal', 'done']);
  });

  it('an aborting Dave restarts the round until he wins', () => {
    const { log, result } = runRound(rungScenario(2, 'aborter', 'abort'), { record: true });
    expect(result.outcome).toBe('assigned');
    expect(result.assignment![DAVE]).toBe('master');
    const aborts = log.events.filter((e) => e.kind === 'abort');
    expect(aborts.length).toBe(result.attempts - 1);
    expect(log.events.filter((e) => e.kind === 'start').length).toBe(result.attempts);
  });

  it('views align with events, one snapshot after each', () => {
    const { log } = runRound(rungScenario(2, 'aborter', 'align'), { record: true });
    expect(log.views.length).toBe(log.events.length);
  });

  it('a party only knows another party\'s value once that party revealed it to them', () => {
    const { log } = runRound(rungScenario(2, 'aborter', 'leak'), { record: true });
    const delivered = new Set<string>(); // "from->to" reveals delivered so far
    log.events.forEach((e, step) => {
      if (e.kind === 'start') delivered.clear();
      if (e.kind === 'deliver' && e.env.msg.kind === 'reveal') delivered.add(`${e.env.from}->${e.env.to}`);
      const views = log.views[step]!;
      for (const p of PARTY_IDS) {
        for (const q of PARTY_IDS) {
          if (q === p) continue;
          if (views[p]!.revealed[q] !== undefined) expect(delivered.has(`${q}->${p}`)).toBe(true);
        }
      }
    });
  });

  it('Dave as aborter sees every other reveal before deciding; the honest three never see his until he reveals', () => {
    const { log, result } = runRound(rungScenario(2, 'aborter', 'asym'), { record: true });
    const lastAbort = log.events.map((e, i) => (e.kind === 'abort' ? i : -1)).filter((i) => i >= 0).at(-1);
    expect(result.attempts).toBeGreaterThan(1);
    const v = log.views[lastAbort!]!;
    expect(PARTY_IDS.filter((q) => q !== DAVE).every((q) => v[DAVE]!.revealed[q] !== undefined)).toBe(true);
    for (const p of [0, 1, 2] as const) expect(v[p]!.revealed[DAVE]).toBeUndefined();
  });
});
