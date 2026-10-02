import { describe, expect, it } from 'vitest';
import { runRound } from './driver';
import { rungScenario } from './scenario';
import { DAVE, PARTY_IDS, type Scenario } from './types';
import { share, simulateSync } from '../sim/simulate';

const N = 1000;
const TOL = 0.055; // 4σ at p = 1/4, n = 1000

describe('rung 3: commit + secret shares', () => {
  it('honest play completes in one attempt with no reconstruction', () => {
    const { log, result } = runRound(rungScenario(3, 'honest', 'r3-honest'), { record: true });
    expect(result.outcome).toBe('assigned');
    expect(result.attempts).toBe(1);
    expect(log.events.some((e) => e.kind === 'deliver' && e.env.msg.kind === 'reconstructShare')).toBe(false);
    const phases = log.events.filter((e) => e.kind === 'phase').map((e) => (e.kind === 'phase' ? e.phase : ''));
    expect(phases).toEqual(['commit', 'deal', 'reveal', 'done']);
  });

  it('is deterministic', () => {
    const s = rungScenario(3, 'aborter', 'r3-det');
    const a = runRound(s, { record: true });
    const b = runRound(s, { record: true });
    expect(a.log.events).toEqual(b.log.events);
    expect(a.log.views).toEqual(b.log.views);
  });

  it('Dave quitting after dealing: the others rebuild his exact number and the round completes', () => {
    // Find a seed where Dave actually quits (he only quits when he is not getting master).
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const { log, result } = runRound(rungScenario(3, 'aborter', `r3-quit-${i}`), { record: true });
      const abort = log.events.find((e) => e.kind === 'abort');
      if (!abort) continue;
      found = true;
      expect(abort.kind === 'abort' && abort.restart).toBe(false);
      expect(abort.kind === 'abort' && abort.cause).toBe('abort');
      expect(result.outcome).toBe('assigned');
      expect(result.attempts).toBe(1);
      // Recovery messages follow the drop.
      expect(log.events.some((e) => e.kind === 'deliver' && e.env.msg.kind === 'reconstructShare' && e.env.msg.dealer === DAVE)).toBe(true);
      const final = log.views.at(-1)!;
      const davesValue = final[DAVE]!.myValue!;
      for (const p of [0, 1, 2] as const) {
        expect(final[p]!.reconstructed[DAVE]).toBe(davesValue);
        expect(final[p]!.assignment).toEqual(result.assignment);
      }
      // And the outcome is the one Dave was trying to escape.
      expect(result.assignment![DAVE]).not.toBe('master');
    }
    expect(found).toBe(true);
  });

  it('an honest roommate\'s phone dying after dealing is handled the same way', () => {
    const base = rungScenario(3, 'honest', 'r3-dead');
    const scenario: Scenario = { ...base, dropout: 1 };
    const { log, result } = runRound(scenario, { record: true });
    expect(result.outcome).toBe('assigned');
    const abort = log.events.find((e) => e.kind === 'abort');
    expect(abort && abort.kind === 'abort' ? abort.cause : null).toBe('dropout');
    const final = log.views.at(-1)!;
    const anasValue = final[1]!.myValue!;
    for (const p of [0, 2, 3] as const) expect(final[p]!.reconstructed[1]).toBe(anasValue);
  });

  it('a party holds one share per dealer, and learns another\'s value only by a delivered reveal or by reconstruction after a drop', () => {
    for (const s of [rungScenario(3, 'honest', 'r3-leak-h'), rungScenario(3, 'aborter', 'r3-leak-a'), { ...rungScenario(3, 'honest', 'r3-leak-d'), dropout: 0 as const }]) {
      const { log } = runRound(s, { record: true });
      const revealDelivered = new Set<string>(); // "q->p"
      let dropped = false;
      log.events.forEach((e, step) => {
        if (e.kind === 'deliver' && e.env.msg.kind === 'reveal') revealDelivered.add(`${e.env.from}->${e.env.to}`);
        if (e.kind === 'drop') dropped = true;
        const views = log.views[step]!;
        for (const p of PARTY_IDS) {
          const v = views[p]!;
          const dealers = v.sharesHeld.map((h) => h.dealer);
          expect(new Set(dealers).size).toBe(dealers.length);
          expect(v.sharesHeld.every((h) => h.x === p + 1)).toBe(true);
          for (const q of PARTY_IDS) {
            if (q === p) continue;
            if (v.revealed[q] !== undefined) expect(revealDelivered.has(`${q}->${p}`)).toBe(true);
            if (v.reconstructed[q] !== undefined) expect(dropped).toBe(true);
          }
        }
      });
    }
  });

  it('1,000 rounds: Dave quitting is fair (≈25%), with no stuck rounds and no restarts', () => {
    const t = simulateSync(rungScenario(3, 'aborter', 'r3-sim-abort'), N);
    expect(t.stuck).toBe(0);
    expect(t.attempts).toBe(N);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });

  it('1,000 rounds: an honest dropout is fair (≈25%)', () => {
    const t = simulateSync({ ...rungScenario(3, 'honest', 'r3-sim-dead'), dropout: 2 }, N);
    expect(t.stuck).toBe(0);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });

  it('1,000 rounds: honest play is fair', () => {
    const t = simulateSync(rungScenario(3, 'honest', 'r3-sim-honest'), N);
    expect(t.stuck).toBe(0);
    for (const p of PARTY_IDS) expect(Math.abs(share(t, p, 'master') - 0.25)).toBeLessThan(TOL);
  });
});
