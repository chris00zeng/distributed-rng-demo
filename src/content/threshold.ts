/**
 * The rung 6 limit (PRD R4a): with n roommates and threshold t, f of them
 * colluding or dropping out. Secrecy needs t ≥ f + 1 (f colluders cannot
 * rebuild anyone's number). Liveness needs n − f ≥ t (f dropouts cannot block
 * reconstruction). Both together force n ≥ 2f + 1.
 */
export type Regime = 'safe' | 'leaky' | 'stuck' | 'broken';

export function regime(n: number, t: number, f: number): Regime {
  const secret = t >= f + 1;
  const live = n - f >= t;
  if (secret && live) return 'safe';
  if (secret) return 'stuck';
  if (live) return 'leaky';
  return 'broken';
}

export const REGIME_LABELS: Record<Regime, { title: string; blurb: string }> = {
  safe: { title: 'safe', blurb: 'f cheaters can neither peek nor block' },
  leaky: { title: 'leaky', blurb: 'f colluders can rebuild everyone’s number early and steer the result' },
  stuck: { title: 'stuck', blurb: 'f dead phones leave too few shares to rebuild anyone' },
  broken: { title: 'broken', blurb: 'both: too few shares to rebuild, and colluders can still peek' },
};

/** Largest f that is safe for some t, i.e. the most cheaters n roommates can tolerate. */
export function maxTolerated(n: number): number {
  let best = 0;
  for (let f = 0; f <= n; f++) for (let t = 1; t <= n; t++) if (regime(n, t, f) === 'safe') best = Math.max(best, f);
  return best;
}
