import { describe, expect, it } from 'vitest';
import { runRound } from '../protocol/driver';
import { rolesFor } from '../protocol/parties';
import { RUNG_PROTOCOLS, rungScenario } from '../protocol/scenario';
import { DAVE, PARTY_IDS, type PartyId } from '../protocol/types';
import { name, shortScalar } from './format';

/** Does the panel text name party q with value v, as the per-party facts render it ("Ana: 17")? */
function shows(text: string, q: PartyId, v: bigint): boolean {
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s·])${esc(name(q))}: ${esc(shortScalar(v))}(?=$|[\\s·])`, 'm').test(text);
}
import { panelFacts } from './panelFacts';
import { buildRows, rowState } from './Timeline';

/** A rung-2 round where Dave quits at least once (deterministic: first matching seed suffix). */
function abortingRound(seed: string) {
  for (let i = 0; i < 20; i++) {
    const run = runRound(rungScenario(2, 'aborter', `${seed}-${i}`), { record: true });
    if (run.result.attempts > 1) return run;
  }
  throw new Error('no aborting seed found');
}

/**
 * R6: a panel shows another roommate's number only once that roommate sent it
 * to this one (an announce or a reveal delivered to this party in this attempt).
 */
describe('panels never show what a roommate has not been told', () => {
  for (const rung of [0, 1, 2] as const) {
    for (const role of rolesFor(RUNG_PROTOCOLS[rung], DAVE)) {
      it(`rung ${rung}, Dave ${role}`, () => {
        const { log } = runRound(rungScenario(rung, role, `panels-${rung}-${role}`), { record: true });
        expect(log.views.length).toBe(log.events.length);
        const told = new Set<string>(); // "q->p": q sent p their value
        const values: Partial<Record<PartyId, bigint>> = {};
        log.events.forEach((e, step) => {
          if (e.kind === 'start') told.clear();
          if (e.kind === 'deliver' && (e.env.msg.kind === 'announce' || e.env.msg.kind === 'reveal')) {
            told.add(`${e.env.from}->${e.env.to}`);
          }
          const views = log.views[step]!;
          for (const q of PARTY_IDS) if (views[q]!.myValue !== undefined) values[q] = views[q]!.myValue;
          for (const p of PARTY_IDS) {
            const text = panelFacts(views[p]!, p).map((f) => `${f.label}: ${f.value}`).join('\n');
            for (const q of PARTY_IDS) {
              if (q === p || values[q] === undefined) continue;
              if (shows(text, q, values[q]!)) {
                expect(told.has(`${q}->${p}`), `step ${step}: ${p} shows ${q}'s number without being told`).toBe(true);
              }
            }
          }
        });
      });
    }
  }

  it('the quitter sees all three numbers before aborting while nobody sees his', () => {
    const { log, result } = abortingRound('panels-asym');
    expect(result.attempts).toBeGreaterThan(1);
    const abortStep = log.events.findIndex((e) => e.kind === 'abort');
    const views = log.views[abortStep]!;
    const daveText = panelFacts(views[DAVE]!, DAVE).map((f) => f.value).join(' ');
    for (const q of [0, 1, 2] as const) expect(shows(daveText, q, views[q]!.myValue!)).toBe(true);
    for (const p of [0, 1, 2] as const) {
      expect(shows(panelFacts(views[p]!, p).map((f) => f.value).join(' '), DAVE, views[DAVE]!.myValue!)).toBe(false);
    }
  });
});

describe('timeline rows', () => {
  it('groups a broadcast into one row and tracks the cursor', () => {
    const { log } = runRound(rungScenario(1, 'honest', 'rows'), { record: true });
    const rows = buildRows(log.events);
    const broadcasts = rows.filter((r) => r.kind === 'message');
    expect(broadcasts.length).toBe(4);
    for (const r of broadcasts) expect(r.recipients!.length).toBe(3);
    // Every event belongs to exactly one row, rows are contiguous and ordered.
    let expected = 0;
    for (const r of rows) {
      expect(r.first).toBe(expected);
      expected = r.last + 1;
    }
    expect(expected).toBe(log.events.length);
    const mid = broadcasts[1]!;
    expect(rowState(mid, mid.first - 1)).toBe('future');
    expect(rowState(mid, mid.first)).toBe('current');
    expect(rowState(mid, mid.last)).toBe('done');
  });

  it('marks a restart', () => {
    const { log } = abortingRound('rows-abort');
    const rows = buildRows(log.events);
    expect(rows.some((r) => r.tone === 'abort')).toBe(true);
    expect(rows.filter((r) => r.tone === 'start').length).toBeGreaterThan(1);
  });
});
