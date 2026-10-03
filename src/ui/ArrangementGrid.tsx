/** The 24 arrangements as rows of room-coloured chips (PRD R9, R25). Highlights one, or shades by frequency.
 *  Each cell shows one chip per roommate in a fixed order; the chip's colour is the room they get and its size
 *  follows the room's size. Hovering or focusing a name emphasises that roommate's chips and lights the six
 *  arrangements where they win the Royal Suite. */
import { useState } from 'react';
import { ARRANGEMENTS, type Room } from '../crypto/arrangements';
import { BEST_ROOM, ROOM_INFO } from '../content/rooms';
import { PARTY_IDS, PARTY_NAMES, type PartyId } from '../protocol/types';

interface Props {
  /** Arrangement number to outline, e.g. the round's result. */
  highlight?: number | null;
  /** Per-arrangement counts; cells are shaded by share of the total. */
  weights?: readonly number[];
  caption?: string;
}

function describe(k: number): string {
  return PARTY_IDS.map((p) => `${PARTY_NAMES[p]}: ${ROOM_INFO[ARRANGEMENTS[k]![p]!].label}`).join(', ');
}

export function ArrangementGrid({ highlight = null, weights, caption }: Props) {
  const [focus, setFocus] = useState<PartyId | null>(null);
  const total = weights ? weights.reduce((a, b) => a + b, 0) : 0;
  const max = weights ? Math.max(1, ...weights) : 1;
  return (
    <figure
      className={`agrid${focus !== null ? ' agrid--focus' : ''}`}
      aria-label="The 24 possible room arrangements"
      onMouseLeave={() => setFocus(null)}
    >
      <div className="agrid__names" aria-label="Roommates, in chip order">
        {PARTY_IDS.map((p) => (
          <button
            key={p}
            type="button"
            className={`agrid__name${focus === p ? ' agrid__name--on' : ''}`}
            onMouseEnter={() => setFocus(p)}
            onFocus={() => setFocus(p)}
            onBlur={() => setFocus(null)}
            aria-pressed={focus === p}
            title={`Show where ${PARTY_NAMES[p]} gets ${ROOM_INFO[BEST_ROOM].label}`}
          >
            {PARTY_NAMES[p]}
          </button>
        ))}
        <span className="agrid__hint">hover a name to see where they win the suite</span>
      </div>
      <div className="agrid__cells">
        {ARRANGEMENTS.map((rooms, k) => {
          const w = weights?.[k] ?? 0;
          const pct = total ? (100 * w) / total : null;
          const shade = weights ? 0.15 + 0.85 * (w / max) : 1;
          const wins = focus !== null && rooms[focus] === BEST_ROOM;
          const cls = ['agrid__cell'];
          if (highlight === k) cls.push('agrid__cell--hit');
          if (weights && w === 0) cls.push('agrid__cell--never');
          if (wins) cls.push('agrid__cell--win');
          return (
            <div
              key={k}
              className={cls.join(' ')}
              style={{ '--shade': shade } as React.CSSProperties}
              title={`arrangement #${k}${pct === null ? '' : `: ${pct.toFixed(1)}% of rounds`} — ${describe(k)}`}
            >
              <div className="agrid__chips" role="img" aria-label={describe(k)}>
                {PARTY_IDS.map((p) => {
                  const room: Room = rooms[p]!;
                  return (
                    <i
                      key={p}
                      className={`agrid__chip agrid__chip--${room}${focus !== null && focus !== p ? ' agrid__chip--dim' : ''}`}
                      style={{ background: ROOM_INFO[room].color }}
                      onMouseEnter={() => setFocus(p)}
                      title={`${PARTY_NAMES[p]}: ${ROOM_INFO[room].label}`}
                    >
                      {PARTY_NAMES[p][0]}
                    </i>
                  );
                })}
              </div>
              <span className="agrid__num">#{k}{pct !== null && total ? <small> {pct.toFixed(0)}%</small> : null}</span>
            </div>
          );
        })}
      </div>
      {caption ? <figcaption className="agrid__caption">{caption}</figcaption> : null}
    </figure>
  );
}
