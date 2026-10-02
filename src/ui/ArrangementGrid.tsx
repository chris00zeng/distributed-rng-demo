/** The 24 arrangements as mini floorplans (PRD R9, R25). Highlights one, or shades by frequency. */
import { ARRANGEMENTS, type Room } from '../crypto/arrangements';
import { PARTY_IDS, type PartyId } from '../protocol/types';
import { Floorplan } from './Floorplan';

interface Props {
  /** Arrangement number to outline, e.g. the round's result. */
  highlight?: number | null;
  /** Per-arrangement counts; cells are shaded by share of the total. */
  weights?: readonly number[];
  caption?: string;
}

function assignmentOf(k: number): Record<PartyId, Room> {
  const rooms = ARRANGEMENTS[k]!;
  const out = {} as Record<PartyId, Room>;
  for (const p of PARTY_IDS) out[p] = rooms[p]!;
  return out;
}

export function ArrangementGrid({ highlight = null, weights, caption }: Props) {
  const total = weights ? weights.reduce((a, b) => a + b, 0) : 0;
  const max = weights ? Math.max(1, ...weights) : 1;
  return (
    <figure className="agrid" aria-label="The 24 possible room arrangements">
      <div className="agrid__cells">
        {ARRANGEMENTS.map((_, k) => {
          const w = weights?.[k] ?? 0;
          const pct = total ? (100 * w) / total : null;
          const shade = weights ? 0.15 + 0.85 * (w / max) : 1;
          return (
            <div
              key={k}
              className={`agrid__cell${highlight === k ? ' agrid__cell--hit' : ''}${weights && w === 0 ? ' agrid__cell--never' : ''}`}
              style={weights ? { opacity: shade } : undefined}
              title={pct === null ? `arrangement #${k}` : `arrangement #${k}: ${pct.toFixed(1)}% of rounds`}
            >
              <Floorplan mini assignment={assignmentOf(k)} title={`arrangement #${k}`} />
              <span className="agrid__num">#{k}{pct !== null && total ? <small> {pct.toFixed(0)}%</small> : null}</span>
            </div>
          );
        })}
      </div>
      {caption ? <figcaption className="agrid__caption">{caption}</figcaption> : null}
    </figure>
  );
}
