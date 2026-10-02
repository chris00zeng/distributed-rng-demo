/** Plain-words formatting shared by panels, timeline and controls. */
import { pickOf } from '../crypto/arrangements';
import { ROOM_LABELS } from '../content/rooms';
import { PARTY_IDS, PARTY_NAMES, type Event, type Msg, type PartyId, type Phase } from '../protocol/types';

export { ROOM_LABELS };

export function roomLabel(room: string): string {
  return (ROOM_LABELS as Record<string, string>)[room] ?? room;
}

export function name(p: PartyId): string {
  return PARTY_NAMES[p];
}

/**
 * A contribution in plain words. Picks (0..23) print as themselves. Anything
 * larger is a padded secret (rung 5+): the pick, then the padding in short hex
 * so the two parts stay visibly distinct (D23).
 */
export function shortScalar(s: bigint): string {
  if (s >= 0n && s < 24n) return s.toString();
  const hex = s.toString(16).padStart(64, '0');
  return `${pickOf(s)} (+ padding ${hex.slice(0, 6)}…)`;
}

/**
 * The combined total and where it lands. Small totals print in full ("41 → wraps to #17");
 * padded totals (rung 5+) print the pick they wrap to.
 */
export function totalLabel(total: bigint, k: number): string {
  if (total < 24n) return `${total} → arrangement #${k}`;
  if (total < 100_000n) return `${total} → wraps to arrangement #${k}`;
  return `a padded total → wraps to arrangement #${k}`;
}

/** Just the pick hidden in a contribution. */
export function pickLabel(s: bigint): string {
  return `#${pickOf(s)}`;
}

export function shortBytes(b: Uint8Array): string {
  return Array.from(b.slice(0, 3), (x) => x.toString(16).padStart(2, '0')).join('') + '…';
}

export const PHASE_LABELS: Record<string, string> = {
  announce: 'announcing',
  commit: 'committing',
  deal: 'dealing shares',
  complain: 'checking shares',
  reveal: 'revealing',
  reconstruct: 'reconstructing',
  done: 'done',
};

export function phaseLabel(phase: Phase | string): string {
  return PHASE_LABELS[phase] ?? phase;
}

export function msgLabel(msg: Msg): string {
  switch (msg.kind) {
    case 'announce': return `announces ${shortScalar(msg.value)}`;
    case 'commit': return 'commits (hash)';
    case 'reveal': return `reveals ${shortScalar(msg.value)}`;
    default: {
      const m = msg as { kind: string };
      return m.kind;
    }
  }
}

/** One line describing an event, for the step controls. */
export function describeEvent(e: Event, broadcast = false): string {
  switch (e.kind) {
    case 'start': return e.attempt === 1 ? 'The round begins.' : `Attempt ${e.attempt}: the round starts over.`;
    case 'deliver': {
      const to = broadcast ? 'everyone' : name(e.env.to);
      return `${name(e.env.from)} → ${to}: ${msgLabel(e.env.msg)}`;
    }
    case 'drop': return `${name(e.party)} goes silent.`;
    case 'phase': return `Phase: ${phaseLabel(e.phase)}.`;
    case 'abort': return e.restart ? `${name(e.by)} quits. The round restarts.` : `${name(e.by)} quits. The others carry on without him.`;
    case 'outcome': return `Rooms assigned: ${PARTY_IDS.map((p) => `${name(p)} gets ${roomLabel(e.assignment[p])}`).join(', ')}.`;
    case 'stuck': return `Stuck: ${e.reason}.`;
  }
}
