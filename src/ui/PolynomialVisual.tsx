/**
 * Shares as points on a line (PRD R12). For the chosen dealer: each roommate's
 * held share is a dot at x = 1..4; the line through them is the dealer's
 * polynomial; where it crosses the axis is the secret pick. One dot says
 * nothing; any two fix the line.
 *
 * Later rungs feed `bad` (off the line) and `rejected` (✗) through PlotPoint.
 */
import { useState } from 'react';
import { PARTY_IDS, PARTY_NAMES, type PartyId, type PartyView } from '../protocol/types';
import { polynomialPoints, type PlotPoint } from './polynomialPoints';

const W = 460, H = 240, PAD_L = 40, PAD_R = 16, PAD_T = 16, PAD_B = 34;
const Y_MAX = 24 + 4.5 * 4 + 2; // intercept up to 23, slope up to 4.5, x up to 4

function shortHex(v: bigint): string {
  return v.toString(16).padStart(64, '0').slice(0, 8) + '…';
}

interface Props {
  views: readonly PartyView[];
  showMath: boolean;
  defaultDealer?: PartyId;
}

export function PolynomialVisual({ views, showMath, defaultDealer = 3 }: Props) {
  const [dealer, setDealer] = useState<PartyId>(defaultDealer);
  const poly = polynomialPoints(views, dealer);
  const sx = (x: number) => PAD_L + ((W - PAD_L - PAD_R) * x) / 4.6;
  const sy = (y: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - y / Y_MAX);
  const haveLine = poly.points.length >= 2 && poly.intercept !== undefined;
  const secretKnown = poly.publicTo0 !== 'no';
  const interceptLabel = poly.intercept === undefined
    ? '?'
    : secretKnown || showMath
      ? `${poly.intercept}${secretKnown ? '' : ' (only the dealer knows this yet)'}`
      : '?';

  return (
    <figure className="poly" aria-label="Shares as points on a line">
      <div className="poly__head">
        <h2 className="col__title">{PARTY_NAMES[dealer]}&rsquo;s shares as points on a line</h2>
        <div className="poly__dealers" role="group" aria-label="Whose shares">
          {PARTY_IDS.map((p) => (
            <button key={p} type="button" className={p === dealer ? 'is-on' : ''} onClick={() => setDealer(p)}>
              {PARTY_NAMES[p]}
            </button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="poly__svg" role="img">
        <line x1={PAD_L} x2={W - PAD_R} y1={sy(0)} y2={sy(0)} className="poly__axis" />
        <line x1={sx(0)} x2={sx(0)} y1={PAD_T} y2={sy(0)} className="poly__axis" />
        {[1, 2, 3, 4].map((x) => (
          <g key={x}>
            <line x1={sx(x)} x2={sx(x)} y1={sy(0)} y2={sy(0) + 5} className="poly__axis" />
            <text x={sx(x)} y={sy(0) + 18} textAnchor="middle" className="poly__tick">x = {x}</text>
            <text x={sx(x)} y={sy(0) + 30} textAnchor="middle" className="poly__tick poly__tick--who">{PARTY_NAMES[(x - 1) as PartyId]}</text>
          </g>
        ))}
        <text x={sx(0) - 6} y={sy(0) + 4} textAnchor="end" className="poly__tick">0</text>
        {haveLine ? (
          <>
            <line
              x1={sx(0)} y1={sy(poly.intercept!)}
              x2={sx(4.3)} y2={sy(poly.intercept! + poly.slope * 4.3)}
              className={`poly__line${secretKnown ? ' poly__line--public' : ''}`}
            />
            <circle cx={sx(0)} cy={sy(poly.intercept!)} r={6} className={`poly__secret${secretKnown ? ' poly__secret--public' : ''}`} />
            <text x={PAD_L + 10} y={PAD_T + 14} className="poly__secret-label">
              where the line crosses the axis = the secret pick: {interceptLabel}
            </text>
          </>
        ) : null}
        {poly.points.map((pt: PlotPoint) => (
          <g key={`${pt.holder}-${pt.x}`} className={`poly__pt${pt.bad ? ' poly__pt--bad' : ''}${pt.rejected ? ' poly__pt--rejected' : ''}`}>
            <circle cx={sx(pt.x)} cy={sy(pt.yPlot)} r={7} />
            <text x={sx(pt.x)} y={sy(pt.yPlot) + 4} textAnchor="middle" className="poly__pt-initial">{PARTY_NAMES[pt.holder][0]}</text>
            {pt.rejected ? <text x={sx(pt.x) + 10} y={sy(pt.yPlot) - 8} className="poly__x">✗</text> : null}
            {showMath ? (
              <text x={sx(pt.x)} y={sy(pt.yPlot) - 12} textAnchor="middle" className="poly__value">{shortHex(pt.y)}</text>
            ) : null}
          </g>
        ))}
        {poly.points.length === 0 ? (
          <text x={W / 2} y={H / 2} textAnchor="middle" className="poly__empty">no shares dealt yet</text>
        ) : null}
      </svg>
      <figcaption className="poly__caption">
        {poly.points.length === 0
          ? 'Once the dealer deals, each roommate holds one point on this line.'
          : poly.points.length === 1
            ? 'One point. Infinitely many lines pass through it, so it says nothing about the secret.'
            : `Each roommate holds one point. Any two fix the line, and the line fixes the secret where it crosses the axis${secretKnown ? ` (${poly.publicTo0 === 'reconstructed' ? 'rebuilt from shares' : 'revealed'})` : ''}.`}
        {' '}
        <span className="poly__metaphor">
          {showMath
            ? 'Values shown are the real 252-bit shares; the positions are a metaphor, because the line only exists modulo ℓ.'
            : 'Positions are a metaphor: real values live in a 252-bit field. Toggle “show the math” to see them.'}
        </span>
      </figcaption>
    </figure>
  );
}
