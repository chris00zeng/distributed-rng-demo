/** One house, four rooms to scale, colour-coded (PRD R25). */
import type { Room } from '../crypto/arrangements';
import { ROOMS } from '../crypto/arrangements';
import { ROOM_INFO } from '../content/rooms';
import { PARTY_IDS, PARTY_NAMES, type PartyId } from '../protocol/types';

export const PLAN_W = 320;
export const PLAN_H = 200;

interface Box { x: number; y: number; w: number; h: number }

/** SVG wants width/height, not w/h; spreading a Box straight into <rect> drew nothing. */
function rectAttrs({ x, y, w, h }: Box) {
  return { x, y, width: w, height: h };
}

/** Room footprints. The Royal Suite is huge; the closet is a closet. */
const LAYOUT: Record<Room, Box> = {
  master: { x: 4, y: 4, w: 196, h: 128 },
  decent: { x: 204, y: 4, w: 112, h: 96 },
  small: { x: 204, y: 104, w: 112, h: 56 },
  closet: { x: 204, y: 164, w: 52, h: 32 },
};
const ENSUITE: Box = { x: 150, y: 4, w: 50, h: 44 };
const BALCONY: Box = { x: 4, y: 132, w: 196, h: 18 };
const HALL: Box[] = [{ x: 4, y: 150, w: 196, h: 46 }, { x: 260, y: 164, w: 56, h: 32 }];
/** Label size per room so the name fits the footprint. Blurbs live in the legend. */
const LABEL_SIZE: Record<Room, number> = { master: 13, decent: 10, small: 10, closet: 7 };

interface Props {
  /** Who is in which room. Omit for an unassigned house. */
  assignment?: Partial<Record<PartyId, Room>>;
  className?: string;
  title?: string;
}

function occupant(assignment: Partial<Record<PartyId, Room>> | undefined, room: Room): PartyId | undefined {
  if (!assignment) return undefined;
  return PARTY_IDS.find((p) => assignment[p] === room);
}

export function Floorplan({ assignment, className, title }: Props) {
  return (
    <svg
      viewBox={`0 0 ${PLAN_W} ${PLAN_H}`}
      className={`floorplan${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={title ?? (assignment ? 'Who gets which room' : 'The house')}
    >
      {title ? <title>{title}</title> : null}
      <rect x="0" y="0" width={PLAN_W} height={PLAN_H} rx="6" className="fp__shell" />
      {HALL.map((b, i) => <rect key={i} {...rectAttrs(b)} className="fp__hall" />)}
      <rect {...rectAttrs(BALCONY)} className="fp__balcony" />
      {ROOMS.map((room) => {
        const b = LAYOUT[room];
        const who = occupant(assignment, room);
        const info = ROOM_INFO[room];
        return (
          <g key={room} className={`fp__room fp__room--${room}`}>
            <rect {...rectAttrs(b)} fill={info.color} className="fp__floor" />
            {room === 'master' ? <rect {...rectAttrs(ENSUITE)} className="fp__ensuite" /> : null}
            {room === 'master' ? (
              <g className="fp__chandelier" transform={`translate(${b.x + 70} ${b.y + 40})`}>
                <line x1="0" y1="-14" x2="0" y2="0" />
                <circle cx="0" cy="4" r="7" />
                <circle cx="-12" cy="8" r="2.5" /><circle cx="12" cy="8" r="2.5" /><circle cx="0" cy="14" r="2.5" />
              </g>
            ) : null}
            <text x={b.x + 6} y={b.y + LABEL_SIZE[room] + 4} className="fp__label" style={{ fontSize: LABEL_SIZE[room] }}>
              {room === 'closet' ? 'Closet' : info.label}
            </text>
            {who !== undefined ? (
              <text
                x={b.x + b.w / 2}
                y={b.y + b.h / 2 + 12}
                textAnchor="middle"
                className="fp__who"
              >
                {PARTY_NAMES[who]}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={BALCONY.x + 6} y={BALCONY.y + 13} className="fp__tiny">balcony</text>
      <text x={ENSUITE.x + 5} y={ENSUITE.y + 14} className="fp__tiny">en-suite</text>
      <text x={HALL[0]!.x + 6} y={HALL[0]!.y + 28} className="fp__tiny fp__tiny--hall">hall · kitchen · the shared bathroom</text>
    </svg>
  );
}
