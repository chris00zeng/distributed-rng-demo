/** "Rooms assigned", one roommate per line, with the room name in its colour. */
import { PARTY_IDS, type PartyId } from '../protocol/types';
import type { Room } from '../crypto/arrangements';
import { name } from './format';
import { RoomName } from './RoomName';

export function OutcomeLines({ assignment }: { assignment: Record<PartyId, Room> }) {
  return (
    <div className="outcome">
      <span className="outcome__title">Rooms assigned</span>
      <ul className="outcome__list">
        {PARTY_IDS.map((p) => (
          <li key={p}><strong>{name(p)}</strong> gets <RoomName room={assignment[p]} /></li>
        ))}
      </ul>
    </div>
  );
}
