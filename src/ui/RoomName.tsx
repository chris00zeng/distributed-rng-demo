/** Room names in running text: bold, in the room's colour (user feedback). */
import type { ReactNode } from 'react';
import { ROOMS, type Room } from '../crypto/arrangements';
import { ROOM_INFO } from '../content/rooms';

export function RoomName({ room }: { room: Room }) {
  return <strong className="room-name" style={{ color: ROOM_INFO[room].color }}>{ROOM_INFO[room].label}</strong>;
}

const LABEL_TO_ROOM = new Map<string, Room>(ROOMS.map((r) => [ROOM_INFO[r].label, r]));
const PATTERN = new RegExp(`(${ROOMS.map((r) => ROOM_INFO[r].label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');

/** Split a string and wrap every room label in a RoomName. Plain text stays plain. */
export function withRoomNames(text: string): ReactNode {
  const parts = text.split(PATTERN);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    const room = LABEL_TO_ROOM.get(part);
    return room ? <RoomName key={i} room={room} /> : part;
  });
}

/** Capitalise the first letter of a label for controls (casing rule: controls start with a capital). */
export function cap(s: string): string {
  return s.length ? s[0]!.toUpperCase() + s.slice(1) : s;
}
