/**
 * The stage (PRD R6, R7): the four roommate cards at the corners, the current
 * message drawn as an animated arrow between them, and the event in words in
 * the middle. Broadcasts fan out as several arrows.
 */
import { withRoomNames } from './RoomName';
import { DAVE, PARTY_IDS, type Event, type PartyId, type PartyView, type Role } from '../protocol/types';
import { describeEvent, msgLabel, name, phaseLabel } from './format';
import { OutcomeLines } from './OutcomeLines';
import { RoommateCard } from './Panels';
import { buildRows, type Row } from './Timeline';

type Decision = Extract<Event, { kind: 'decision' }>;

interface Props {
  events: Event[];
  step: number;
  views: PartyView[];
  prevViews?: PartyView[];
  roles: Record<PartyId, Role>;
  decision?: Decision;
  deviated?: ReadonlySet<PartyId>;
  onOverride?: (index: number, option: string) => void;
  playable?: readonly PartyId[];
  /** One line about the outcome once it is known at this step. */
  resultLine?: string | null;
}

/** Corner of each roommate: Zoe top-left, Ana top-right, Ben bottom-left, Dave bottom-right. */
const CORNER: Record<PartyId, { x: number; y: number }> = { 0: { x: 24, y: 24 }, 1: { x: 76, y: 24 }, 2: { x: 24, y: 76 }, 3: { x: 76, y: 76 } };

/** Who has gone silent (dropped) by this step in the current attempt. */
export function silentAt(events: Event[], step: number): Set<PartyId> {
  const s = new Set<PartyId>();
  for (let i = 0; i <= step && i < events.length; i++) {
    const e = events[i]!;
    if (e.kind === 'start') s.clear();
    if (e.kind === 'drop') s.add(e.party);
  }
  return s;
}

export interface Arrow { from: PartyId; to: PartyId; delivered: boolean; label: string }

/** The arrows to draw at this step: the deliveries of the current logical message, delivered or pending. */
export function arrowsAt(rows: Row[], events: Event[], step: number): Arrow[] {
  const row = rows.find((r) => r.first <= step && step <= r.last);
  if (!row || row.kind !== 'message') return [];
  const first = events[row.first];
  const label = first?.kind === 'deliver' ? msgLabel(first.env.msg) : row.label;
  return row.recipients!.map((to, k) => ({ from: row.from!, to, delivered: row.first + k <= step, label }));
}

export function Stage({ events, step, views, prevViews, roles, decision, deviated, onOverride, playable = [DAVE], resultLine }: Props) {
  const rows = buildRows(events);
  const arrows = arrowsAt(rows, events, step);
  const silent = silentAt(events, step);
  const e = events[step]!;
  const broadcast = arrows.length > 1;
  const banner = e.kind === 'abort' || e.kind === 'void' || e.kind === 'stuck' || e.kind === 'drop' || e.kind === 'start' ? describeEvent(e, broadcast) : null;
  const phase = views[0]?.phase;

  return (
    <div className={`stage${e.kind === 'decision' ? ' stage--decision' : ''}`} data-step={step}>
      <svg className="stage__overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {arrows.map((a, i) => {
          const from = CORNER[a.from], to = CORNER[a.to];
          return (
            <g key={`${step}-${i}`} className={`stage__arrow${a.delivered ? ' stage__arrow--done' : ' stage__arrow--pending'}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} vectorEffect="non-scaling-stroke" />
              {a.delivered ? (
                <circle r="1.2" className="stage__dot">
                  <animateMotion dur="0.45s" fill="freeze" path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} />
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>
      {PARTY_IDS.map((p) => (
        <RoommateCard
          key={p}
          party={p}
          view={views[p]!}
          prevView={prevViews?.[p]}
          role={roles[p]}
          decision={decision && decision.by === p && playable.includes(p) ? decision : undefined}
          offPath={deviated?.has(p) ?? false}
          silent={silent.has(p)}
          traffic={
            arrows.some((a) => a.from === p)
              ? { kind: 'sending', other: broadcast ? 'everyone' : name(arrows[0]!.to) }
              : arrows.some((a) => a.to === p && a.delivered)
                ? { kind: 'receiving', other: name(arrows[0]!.from) }
                : undefined
          }
          onOverride={onOverride}
          className={`stage__card stage__card--${p}${arrows.some((a) => a.from === p) ? ' stage__card--sending' : ''}${arrows.some((a) => a.to === p && a.delivered) ? ' stage__card--receiving' : ''}`}
        />
      ))}
      <div className={`stage__centre${banner ? ' stage__centre--banner' : ''}`} aria-live="polite">
        {phase ? <span className="stage__phase">{phaseLabel(phase)}</span> : null}
        <p className="stage__event">
          {(banner ? withRoomNames(banner) : null) ?? (arrows.length ? (
            <>
              <strong>{name(arrows[0]!.from)}</strong> → <strong>{broadcast ? 'everyone' : name(arrows[0]!.to)}</strong>: {arrows[0]!.label}
              {broadcast ? <span className="stage__count"> ({arrows.filter((a) => a.delivered).length}/{arrows.length} delivered)</span> : null}
            </>
          ) : e.kind === 'outcome' ? <OutcomeLines assignment={e.assignment} /> : withRoomNames(describeEvent(e, false)))}
        </p>
        {resultLine ? <p className="stage__result">{withRoomNames(resultLine)}</p> : null}
      </div>
    </div>
  );
}
