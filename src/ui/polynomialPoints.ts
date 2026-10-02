/**
 * Turns the recorded views at one step into the geometry of one dealer's
 * sharing polynomial (PRD R12). Pure, so it can be tested.
 *
 * The explainer's god view pools every roommate's held share of the chosen
 * dealer: once dealing is done that is all four points, which lie on the
 * dealer's polynomial (a line for t = 2) whose y-intercept is the dealer's
 * secret. Each point is labelled with who holds it, because one point alone
 * says nothing about where the line crosses the axis.
 *
 * Positions are a metaphor. Real shares are 252-bit field elements and the
 * "line" only exists modulo ℓ, so the plot places points on a straight line
 * with the secret's pick as the intercept and a slope derived from the first
 * share. The math toggle shows the real values beside each point.
 */
import { pickOf } from '../crypto/arrangements';
import { L } from '../crypto/field';
import { PARTY_IDS, type PartyId, type PartyView } from '../protocol/types';

export interface PlotPoint {
  /** Share index, 1..4 (party id + 1). */
  x: number;
  /** Who holds this share. */
  holder: PartyId;
  /** The real share value. */
  y: bigint;
  /** Metaphorical plot height, in the same units as `intercept`. */
  yPlot: number;
  /**
   * Reserved for later rungs: a share that does not sit on the dealer's
   * polynomial (inconsistent dealing or a forged reconstruction share).
   */
  bad?: boolean;
  /** Reserved for rung 5: rejected by the verification check. */
  rejected?: boolean;
}

export interface Polynomial {
  dealer: PartyId;
  points: PlotPoint[];
  /** The dealer's secret, if the dealer's own view has it (it always does once started). */
  secret?: bigint;
  /** The pick hidden in the secret: the metaphorical y-intercept. */
  intercept?: number;
  /** Metaphorical slope so all points land on one straight line. */
  slope: number;
  /** Has the secret become public to the honest observer (party 0): revealed or rebuilt? */
  publicTo0: 'no' | 'revealed' | 'reconstructed';
}

/** Slope in plot units per x from the first share's position in the field, kept gentle. */
export function metaphorSlope(firstShare: bigint | undefined): number {
  if (firstShare === undefined) return 2;
  const frac = Number((firstShare * 1000n) / L) / 1000; // 0..1
  return 1.5 + 3 * frac; // 1.5 .. 4.5 units per x
}

export function polynomialPoints(views: readonly PartyView[], dealer: PartyId): Polynomial {
  const held = PARTY_IDS.flatMap((p) => {
    const v = views[p];
    if (!v) return [];
    return v.sharesHeld.filter((s) => s.dealer === dealer).map((s) => ({ holder: p, x: s.x, y: s.y }));
  }).sort((a, b) => a.x - b.x);

  const secret = views[dealer]?.myValue;
  const intercept = secret !== undefined ? pickOf(secret) : undefined;
  const slope = metaphorSlope(held[0]?.y);
  const base = intercept ?? 12;
  const points: PlotPoint[] = held.map((h) => ({ ...h, yPlot: base + slope * h.x }));

  const v0 = views[0];
  const publicTo0: Polynomial['publicTo0'] =
    v0?.revealed[dealer] !== undefined ? 'revealed' : v0?.reconstructed[dealer] !== undefined ? 'reconstructed' : 'no';

  return { dealer, points, secret, intercept, slope, publicTo0 };
}
