import { ROOMS, type Room } from '../crypto/shuffle';
import { PARTY_IDS, PARTY_NAMES, type PartyId } from '../protocol/types';
import { share, type Tally } from '../sim/simulate';

const ROOM_LABELS: Record<Room, string> = {
  master: 'Master w/ en-suite',
  decent: 'Decent',
  small: 'Small',
  closet: 'Basically a closet',
};

const W = 640, H = 260, PAD_L = 44, PAD_R = 12, PAD_T = 16, PAD_B = 48;
const PLOT_W = W - PAD_L - PAD_R, PLOT_H = H - PAD_T - PAD_B;

export function FairnessChart({ tally, total }: { tally: Tally | null; total: number }) {
  const groupW = PLOT_W / PARTY_IDS.length;
  const barW = (groupW * 0.8) / ROOMS.length;
  const y = (frac: number) => PAD_T + PLOT_H * (1 - frac);
  const fair = 1 / PARTY_IDS.length;
  const done = tally ? tally.rounds - tally.stuck : 0;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Room frequency per roommate over the simulated rounds">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(f)} y2={y(f)} className="chart__grid" />
            <text x={PAD_L - 6} y={y(f) + 4} textAnchor="end" className="chart__tick">{Math.round(f * 100)}%</text>
          </g>
        ))}
        {PARTY_IDS.map((p: PartyId, gi) => {
          const x0 = PAD_L + gi * groupW + groupW * 0.1;
          return (
            <g key={p}>
              {ROOMS.map((room, ri) => {
                const frac = tally ? share(tally, p, room) : 0;
                return (
                  <rect
                    key={room}
                    x={x0 + ri * barW}
                    y={y(frac)}
                    width={barW - 2}
                    height={PLOT_H * frac}
                    className={`chart__bar chart__bar--${room}`}
                  >
                    <title>{`${PARTY_NAMES[p]} · ${ROOM_LABELS[room]}: ${(frac * 100).toFixed(1)}%`}</title>
                  </rect>
                );
              })}
              <text x={x0 + groupW * 0.4} y={H - PAD_B + 18} textAnchor="middle" className="chart__label">{PARTY_NAMES[p]}</text>
            </g>
          );
        })}
        <line x1={PAD_L} x2={W - PAD_R} y1={y(fair)} y2={y(fair)} className="chart__fair" />
        <text x={W - PAD_R} y={y(fair) - 5} textAnchor="end" className="chart__fair-label">fair: 1/4</text>
      </svg>
      <figcaption className="chart__legend">
        {ROOMS.map((room) => (
          <span key={room} className="legend__item"><i className={`legend__swatch chart__bar--${room}`} />{ROOM_LABELS[room]}</span>
        ))}
        <span className="legend__status">
          {tally ? `${done.toLocaleString()} of ${total.toLocaleString()} rounds${tally.stuck ? `, ${tally.stuck} stuck` : ''}` : 'not run yet'}
        </span>
      </figcaption>
    </figure>
  );
}
