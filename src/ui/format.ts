/** Plain-words formatting shared by panels, timeline and controls. */
import type { Room } from '../crypto/shuffle';
import { PARTY_IDS, PARTY_NAMES, type Event, type Msg, type PartyId, type Phase } from '../protocol/types';

export const ROOM_LABELS: Record<Room, string> = {
  master: 'Master w/ en-suite',
  decent: 'Decent',
  small: 'Small',
  closet: 'Basically a closet',
};

export function roomLabel(room: string): string {
  return (ROOM_LABELS as Record<string, string>)[room] ?? room;
}

export function name(p: PartyId): string {
  return PARTY_NAMES[p];
}

/** Short hex for a field element: first 6 hex digits plus an ellipsis. */
export function shortScalar(s: bigint): string {
  const hex = s.toString(16).padStart(64, '0');
  return `${hex.slice(0, 6)}…`;
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
