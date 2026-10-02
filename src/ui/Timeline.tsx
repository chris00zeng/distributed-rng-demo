import { useEffect, useRef } from 'react';
import { DAVE, PARTY_IDS, type Event, type PartyId } from '../protocol/types';
import { msgLabel, name, phaseLabel, roomLabel } from './format';

/** A row of the sequence diagram: either one logical message or one marker event. */
export interface Row {
  first: number;            // index of the first event in this row
  last: number;             // index of the last event in this row
  kind: 'message' | 'marker';
  from?: PartyId;
  /** recipients in delivery order; recipients[i] was delivered at event first + i */
  recipients?: PartyId[];
  label: string;
  tone: 'normal' | 'phase' | 'abort' | 'drop' | 'outcome' | 'stuck' | 'start' | 'decision' | 'deviate';
  /** parties that are silent (dropped) at this row */
  silent: PartyId[];
}

type Deliver = Extract<Event, { kind: 'deliver' }>;

/** Group consecutive deliveries sharing a sender and seq into one row (a broadcast). */
export function buildRows(events: Event[]): Row[] {
  const rows: Row[] = [];
  let silent: PartyId[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.kind === 'deliver') {
      const prev = rows.at(-1);
      const prevFirst = prev ? events[prev.first] : undefined;
      if (
        prev && prev.kind === 'message' && prev.last === i - 1 && prevFirst?.kind === 'deliver'
        && prevFirst.env.from === e.env.from && (prevFirst as Deliver).env.seq === e.env.seq
      ) {
        prev.last = i;
        prev.recipients!.push(e.env.to);
      } else {
        rows.push({ first: i, last: i, kind: 'message', from: e.env.from, recipients: [e.env.to], label: msgLabel(e.env.msg), tone: 'normal', silent: [...silent] });
      }
      continue;
    }
    let label = '';
    let tone: Row['tone'] = 'normal';
    if (e.kind === 'decision') {
      // Show Dave's every decision; others' only when they deviate (D24, Dave-centric ladder).
      if (e.by !== DAVE && !e.deviates) {
        // Hidden: fold into the previous row so every event still maps to a row.
        const prev = rows.at(-1);
        if (prev) prev.last = i;
        continue;
      }
      const opt = e.point.options.find((o) => o.id === e.chosen);
      label = `${name(e.by)} ${e.deviates ? 'deviates' : 'decides'}: ${opt?.label ?? e.chosen}`;
      rows.push({ first: i, last: i, kind: 'marker', label, tone: e.deviates ? 'deviate' : 'decision', silent: [...silent] });
      continue;
    }
    switch (e.kind) {
      case 'start': silent = []; label = e.attempt === 1 ? 'round begins' : `attempt ${e.attempt}: start over`; tone = 'start'; break;
      case 'phase': label = `phase: ${phaseLabel(e.phase)}`; tone = 'phase'; break;
      case 'abort': label = e.restart ? `${name(e.by)} quits — restart` : `${name(e.by)} quits`; tone = 'abort'; break;
      case 'drop': silent = [...silent, e.party]; label = `${name(e.party)} is silent`; tone = 'drop'; break;
      case 'outcome': label = `rooms: ${PARTY_IDS.map((p) => `${name(p)} ${roomLabel(e.assignment[p]).toLowerCase()}`).join(', ')}`; tone = 'outcome'; break;
      case 'stuck': label = `stuck: ${e.reason}`; tone = 'stuck'; break;
      default: {
        const prev = rows.at(-1);
        if (prev) prev.last = i;
        continue;
      }
    }
    rows.push({ first: i, last: i, kind: 'marker', label, tone, silent: [...silent] });
  }
  return rows;
}

/** Is the whole broadcast at `row` delivered by `step`? Is a row current? */
export function rowState(row: Row, step: number): 'done' | 'current' | 'future' {
  if (row.last <= step) return 'done';
  if (row.first <= step) return 'current';
  return 'future';
}

const W = 420, LANE_X0 = 60, LANE_GAP = 100, ROW_H = 30, TOP = 36, PAD_B = 12;
const laneX = (p: PartyId) => LANE_X0 + p * LANE_GAP;

export function Timeline({ events, step, onSelect }: { events: Event[]; step: number; onSelect: (i: number) => void }) {
  const rows = buildRows(events);
  const H = TOP + rows.length * ROW_H + PAD_B;
  const currentRef = useRef<SVGGElement | null>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  return (
    <div className="timeline" role="group" aria-label="Message timeline">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" className="tl__arrowhead" />
          </marker>
        </defs>
        {PARTY_IDS.map((p) => (
          <g key={p}>
            <text x={laneX(p)} y={18} textAnchor="middle" className="tl__name">{name(p)}</text>
            <line x1={laneX(p)} x2={laneX(p)} y1={TOP - 8} y2={H - PAD_B} className="tl__lifeline" />
          </g>
        ))}
        {rows.map((row, ri) => {
          const y = TOP + ri * ROW_H + ROW_H / 2;
          const state = rowState(row, step);
          const isCursor = row.first <= step && step <= row.last;
          const cls = `tl__row tl__row--${state} tl__row--${row.tone}${isCursor ? ' tl__row--cursor' : ''}`;
          const ref = isCursor ? currentRef : undefined;
          const gaps = row.silent.map((p) => (
            <rect key={`gap-${p}`} x={laneX(p) - 3} y={y - ROW_H / 2} width={6} height={ROW_H} className="tl__gap" />
          ));
          if (row.kind === 'marker') {
            return (
              <g key={ri} ref={ref} className={cls} onClick={() => onSelect(row.first)}>
                {gaps}
                <rect x={8} y={y - 11} width={W - 16} height={22} rx={4} className="tl__band" />
                <text x={W / 2} y={y + 4} textAnchor="middle" className="tl__band-text">{row.label}</text>
              </g>
            );
          }
          const from = row.from!;
          const deliveredCount = state === 'done' ? row.recipients!.length : Math.max(0, step - row.first + 1);
          const xs = row.recipients!.map(laneX);
          const left = Math.min(laneX(from), ...xs);
          const right = Math.max(laneX(from), ...xs);
          return (
            <g key={ri} ref={ref} className={cls} onClick={() => onSelect(row.first)}>
              {gaps}
              <line x1={left} x2={right} y1={y} y2={y} className="tl__spine" />
              {row.recipients!.map((to, k) => {
                const pending = k >= deliveredCount;
                const x1 = laneX(from), x2 = laneX(to);
                const dir = x2 > x1 ? -1 : 1;
                return (
                  <line
                    key={to}
                    x1={x2 + dir * 12} x2={x2 + dir * 2} y1={y} y2={y}
                    className={`tl__arrow${pending ? ' tl__arrow--pending' : ''}`}
                    markerEnd="url(#arrow)"
                  />
                );
              })}
              <circle cx={laneX(from)} cy={y} r={4} className="tl__dot" />
              <text x={(left + right) / 2} y={y - 6} textAnchor="middle" className="tl__label">{row.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
