import { describe, expect, it } from 'vitest';
import { reconstruct } from '../crypto/shamir';
import { runRound } from '../protocol/driver';
import { rungScenario } from '../protocol/scenario';
import { DAVE, PARTY_IDS } from '../protocol/types';
import { polynomialPoints } from './polynomialPoints';

describe('polynomialPoints', () => {
  const { log } = runRound(rungScenario(3, 'aborter', 'roommates'), { record: true });
  const dealStep = log.events.findIndex((e) => e.kind === 'phase' && e.phase === 'deal');
  const revealStep = log.events.findIndex((e) => e.kind === 'phase' && e.phase === 'reveal');

  it('has no points before anyone has dealt', () => {
    const poly = polynomialPoints(log.views[0]!, DAVE);
    expect(poly.points).toEqual([]);
    expect(poly.intercept).toBeDefined(); // the dealer knows its own pick from the start
  });

  it('pools one held share per roommate once dealing is done, all on the dealer\'s polynomial', () => {
    const views = log.views[revealStep]!;
    for (const dealer of PARTY_IDS) {
      const poly = polynomialPoints(views, dealer);
      expect(poly.points.map((p) => p.holder).sort()).toEqual([0, 1, 2, 3]);
      expect(poly.points.map((p) => p.x)).toEqual([1, 2, 3, 4]);
      // Any two of the four real shares rebuild the dealer's secret (t = 2).
      const secret = reconstruct(poly.points.slice(0, 2).map((p) => ({ x: p.x, y: p.y })));
      expect(secret).toBe(views[dealer]!.myValue);
      expect(reconstruct(poly.points.slice(2, 4).map((p) => ({ x: p.x, y: p.y })))).toBe(secret);
      expect(poly.intercept).toBe(Number(secret % 24n));
    }
  });

  it('each roommate holds exactly its own share of a dealer, and the plot is a straight line', () => {
    const views = log.views[revealStep]!;
    const poly = polynomialPoints(views, DAVE);
    for (const p of PARTY_IDS) {
      const mine = views[p]!.sharesHeld.filter((s) => s.dealer === DAVE);
      expect(mine.length).toBe(1);
      expect(mine[0]!.x).toBe(p + 1);
    }
    const [a, b, c] = poly.points;
    const s1 = (b!.yPlot - a!.yPlot) / (b!.x - a!.x);
    const s2 = (c!.yPlot - b!.yPlot) / (c!.x - b!.x);
    expect(s1).toBeCloseTo(s2, 9);
    expect(a!.yPlot - poly.slope * a!.x).toBeCloseTo(poly.intercept!, 9);
  });

  it('reports when the honest observer has learned the secret', () => {
    expect(polynomialPoints(log.views[dealStep]!, DAVE).publicTo0).toBe('no');
    const last = log.views.at(-1)!;
    const poly = polynomialPoints(last, DAVE);
    // With seed "roommates" Dave quits on rung 3 and is rebuilt from shares.
    expect(poly.publicTo0).toBe('reconstructed');
    expect(polynomialPoints(last, 1).publicTo0).toBe('revealed');
  });
});
