/** The four rooms, best to worst (PRD R10, R25). Colours are reused everywhere a room appears. */
import { ROOMS, type Room } from '../crypto/arrangements';

export interface RoomInfo {
  label: string;
  blurb: string;
  color: string;
  /** Rough floor area, for the floorplan and the sort order. */
  rank: number;
}

export const ROOM_INFO: Record<Room, RoomInfo> = {
  master: { label: 'The Royal Suite', blurb: 'en-suite, balcony, heated floors, a chandelier nobody asked for', color: '#c2410c', rank: 0 },
  decent: { label: 'The Decent One', blurb: 'has a door that closes', color: '#0e7490', rank: 1 },
  small: { label: 'The Shoebox', blurb: 'the bed fits, technically', color: '#6d28d9', rank: 2 },
  closet: { label: 'Basically a Closet', blurb: 'it is a closet', color: '#8a8a96', rank: 3 },
};

export const ROOM_LABELS: Record<Room, string> = Object.fromEntries(
  ROOMS.map((r) => [r, ROOM_INFO[r].label]),
) as Record<Room, string>;

export const BEST_ROOM: Room = 'master';
export { ROOMS };
export type { Room };
