/**
 * Level 6: the t-versus-f phase chart (PRD R4a), with a "what if there were n of us?"
 * selector. The live house stays at four roommates; the selector only redraws the
 * chart, which is pure arithmetic (n ≥ 2f + 1), to show that five survive two cheaters
 * and seven survive three.
 */
import { useState } from 'react';
import { REGIME_LABELS, maxTolerated, regime, type Regime } from '../content/threshold';

const COLORS: Record<Regime, string> = { safe: '#0e7490', leaky: '#c2410c', stuck: '#6d28d9', broken: '#8a8a96' };
const N_CHOICES = [3, 4, 5, 6, 7];

interface Props { n: number; t: number; onChangeT?: (t: number) => void }

export function ThresholdChart({ n: liveN, t, onChangeT }: Props) {
  const [n, setN] = useState(liveN);
  const live = n === liveN;
  const ts = Array.from({ length: n - 1 }, (_, i) => i + 2);   // 2..n
  const fs = Array.from({ length: n }, (_, i) => i);             // 0..n-1
  const cell = n <= 4 ? 56 : 44, left = 70, top = 34, W = left + fs.length * cell + 16, H = top + ts.length * cell + 40;
  return (
    <figure className="phase">
      <div className="phase__n" role="group" aria-label="How many roommates to chart">
        <span className="phase__n-label">What if there were</span>
        {N_CHOICES.map((k) => (
          <button key={k} type="button" className={`phase__n-btn${k === n ? ' is-on' : ''}`} aria-pressed={k === n} onClick={() => setN(k)}>
            {k}
          </button>
        ))}
        <span className="phase__n-label">of us?</span>
        <span className="phase__n-note">
          {n} roommates can tolerate at most <strong>{maxTolerated(n)}</strong> cheater{maxTolerated(n) === 1 ? '' : 's'} (n ≥ 2f + 1).
          {live ? '' : ' The live house stays at four.'}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Which thresholds are safe against how many cheaters">
        <text x={left + (fs.length * cell) / 2} y={H - 8} textAnchor="middle" className="phase__axis">f = cheaters or dead phones</text>
        <text x={14} y={top + (ts.length * cell) / 2} textAnchor="middle" transform={`rotate(-90 14 ${top + (ts.length * cell) / 2})`} className="phase__axis">t = shares needed</text>
        {fs.map((f, fi) => <text key={f} x={left + fi * cell + cell / 2} y={top - 10} textAnchor="middle" className="phase__tick">{f}</text>)}
        {ts.map((tv, ti) => {
          const y = top + ti * cell;
          return (
            <g key={tv} className={`phase__row${live && tv === t ? ' phase__row--on' : ''}`} onClick={() => { if (live) onChangeT?.(tv); }} style={{ cursor: live && onChangeT ? 'pointer' : 'default' }}>
              <text x={left - 10} y={y + cell / 2 + 4} textAnchor="end" className="phase__tick">{tv}</text>
              {fs.map((f, fi) => {
                const r = regime(n, tv, f);
                return (
                  <g key={f}>
                    <rect x={left + fi * cell + 2} y={y + 2} width={cell - 4} height={cell - 4} rx={6} fill={COLORS[r]} opacity={!live || tv === t ? 1 : 0.45} />
                    <text x={left + fi * cell + cell / 2} y={y + cell / 2 + 4} textAnchor="middle" className="phase__cell">{REGIME_LABELS[r].title}</text>
                  </g>
                );
              })}
              {live && tv === t ? <rect x={left} y={y} width={fs.length * cell} height={cell} rx={8} className="phase__cursor" /> : null}
            </g>
          );
        })}
      </svg>
      <figcaption className="phase__legend">
        {(Object.keys(REGIME_LABELS) as Regime[]).map((r) => (
          <span key={r} className="legend__item"><i className="legend__swatch" style={{ background: COLORS[r] }} /><strong>{REGIME_LABELS[r].title}</strong>: {REGIME_LABELS[r].blurb}</span>
        ))}
      </figcaption>
    </figure>
  );
}
