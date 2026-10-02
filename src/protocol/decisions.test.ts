import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rungScenario } from './scenario';
import { DAVE, type Event } from './types';

type Decision = Extract<Event, { kind: 'decision' }>;
const decisionsOf = (events: Event[], by = DAVE) => events.filter((e): e is Decision => e.kind === 'decision' && e.by === by);

describe('decision points (D24)', () => {
  it('rung 0: Dave decides how to roll; honest and liar are the two options', () => {
    const honest = decisionsOf(runRound(rungScenario(0, 'honest', 'd0')).log.events);
    const liar = decisionsOf(runRound(rungScenario(0, 'liar', 'd0')).log.events);
    expect(honest.map((d) => [d.point.kind, d.chosen, d.deviates])).toEqual([['roll', 'honest', false]]);
    expect(liar.map((d) => [d.point.kind, d.chosen, d.deviates])).toEqual([['roll', 'win', true]]);
    // Other parties have no decision on rung 0 (only one option: wait).
    for (const p of [0, 1, 2] as const) expect(decisionsOf(runRound(rungScenario(0, 'liar', 'd0')).log.events, p)).toEqual([]);
  });

  it('rung 1: the last mover first waits, then steers', () => {
    const d = decisionsOf(runRound(rungScenario(1, 'lastMover', 'd1')).log.events);
    expect(d.map((x) => [x.point.kind, x.chosen])).toEqual([['speak', 'wait'], ['steer', 'win']]);
    expect(d.every((x) => x.deviates)).toBe(true);
    // Honest parties raise the same points and take the honest option, once each.
    const ana = decisionsOf(runRound(rungScenario(1, 'lastMover', 'd1')).log.events, 1);
    expect(ana.map((x) => [x.point.kind, x.chosen, x.deviates])).toEqual([['speak', 'now', false]]);
  });

  it('rung 2: the quitter waits, then quits when losing and reveals when winning', () => {
    const { log, result } = runRound(rungScenario(2, 'aborter', 'roommates'));
    expect(result.attempts).toBeGreaterThan(1);
    const d = decisionsOf(log.events);
    const reveals = d.filter((x) => x.point.kind === 'reveal');
    expect(reveals.length).toBe(result.attempts);
    for (const r of reveals.slice(0, -1)) {
      expect(r.chosen).toBe('quit');
      expect(r.point.context?.wouldWin).toBe(false);
    }
    expect(reveals.at(-1)!.chosen).toBe('reveal');
    expect(reveals.at(-1)!.point.context?.wouldWin).toBe(true);
    // Decision ordinals are unique and increasing across attempts.
    const idx = d.map((x) => x.index);
    expect(new Set(idx).size).toBe(idx.length);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
  });

  it('override: making the quitter reveal gives a one-attempt round', () => {
    const base = runRound(rungScenario(2, 'aborter', 'roommates'));
    const firstReveal = decisionsOf(base.log.events).find((x) => x.point.kind === 'reveal')!;
    expect(firstReveal.chosen).toBe('quit');
    const forced = runRound(rungScenario(2, 'aborter', 'roommates'), { overrides: { [firstReveal.index]: 'reveal' } });
    expect(forced.result.attempts).toBe(1);
    expect(forced.result.assignment![DAVE]).not.toBe('master');
    const d = decisionsOf(forced.log.events).find((x) => x.index === firstReveal.index)!;
    expect(d.chosen).toBe('reveal');
    expect(d.deviates).toBe(false);
  });

  it('override: making an honest Dave quit on rung 2 restarts the round', () => {
    const honest = runRound(rungScenario(2, 'honest', 'roommates'));
    expect(honest.result.attempts).toBe(1);
    const timing = decisionsOf(honest.log.events).find((x) => x.point.kind === 'revealTiming')!;
    // First make him wait; that surfaces the reveal decision; then make him quit.
    const waited = runRound(rungScenario(2, 'honest', 'roommates'), { overrides: { [timing.index]: 'wait' } });
    const reveal = decisionsOf(waited.log.events).find((x) => x.point.kind === 'reveal')!;
    expect(reveal.chosen).toBe('reveal');
    const quit = runRound(rungScenario(2, 'honest', 'roommates'), { overrides: { [timing.index]: 'wait', [reveal.index]: 'quit' } });
    expect(quit.result.attempts).toBeGreaterThan(1);
    expect(quit.log.events.some((e) => e.kind === 'abort' && e.restart)).toBe(true);
  });

  it('override: quitting on rung 3 changes nothing — the others reconstruct him', () => {
    const honest = runRound(rungScenario(3, 'honest', 'roommates'));
    const timing = decisionsOf(honest.log.events).find((x) => x.point.kind === 'revealTiming')!;
    const waited = runRound(rungScenario(3, 'honest', 'roommates'), { overrides: { [timing.index]: 'wait' } });
    const reveal = decisionsOf(waited.log.events).find((x) => x.point.kind === 'reveal')!;
    const quit = runRound(rungScenario(3, 'honest', 'roommates'), { overrides: { [timing.index]: 'wait', [reveal.index]: 'quit' } });
    expect(quit.result.attempts).toBe(1);
    expect(quit.result.arrangement).toBe(honest.result.arrangement);
    expect(quit.log.events.some((e) => e.kind === 'abort' && !e.restart)).toBe(true);
    expect(quit.log.events.some((e) => e.kind === 'deliver' && e.env.msg.kind === 'reconstructShare')).toBe(true);
  });

  it('an override naming a non-existent option falls back to the policy', () => {
    const base = runRound(rungScenario(2, 'honest', 'roommates'));
    const timing = decisionsOf(base.log.events).find((x) => x.point.kind === 'revealTiming')!;
    const bogus = runRound(rungScenario(2, 'honest', 'roommates'), { overrides: { [timing.index]: 'teleport' } });
    expect(bogus.log.events).toEqual(base.log.events);
  });

  it('decision events are logged after the event that triggered them', () => {
    const { log } = runRound(rungScenario(2, 'aborter', 'roommates'), { record: true });
    log.events.forEach((e, i) => {
      if (e.kind !== 'decision' || e.point.kind !== 'reveal') return;
      const prev = log.events[i - 1]!;
      expect(prev.kind === 'deliver' && prev.env.to === e.by && prev.env.msg.kind === 'reveal').toBe(true);
    });
  });
});
