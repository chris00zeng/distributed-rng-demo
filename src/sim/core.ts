/** Tally bookkeeping shared by the main thread and the simulation worker. */
import { deriveSeed } from '../crypto/prng';
import { N_ARRANGEMENTS, type Room } from '../crypto/arrangements';
import { runRound } from '../protocol/driver';
import { PARTY_IDS, type PartyId, type Scenario } from '../protocol/types';

export interface Tally {
  rounds: number;
  stuck: number;
  attempts: number;
  roomCounts: Record<PartyId, Record<Room, number>>;
  /** How often each of the 24 arrangements came up. */
  arrangementCounts: number[];
}

export function emptyTally(): Tally {
  const roomCounts = {} as Record<PartyId, Record<Room, number>>;
  for (const p of PARTY_IDS) roomCounts[p] = { master: 0, decent: 0, small: 0, closet: 0 };
  return { rounds: 0, stuck: 0, attempts: 0, roomCounts, arrangementCounts: new Array<number>(N_ARRANGEMENTS).fill(0) };
}

export function addRound(tally: Tally, scenario: Scenario, k: number): void {
  const { result } = runRound({ ...scenario, seed: deriveSeed(scenario.seed, k) });
  tally.rounds++;
  tally.attempts += result.attempts;
  if (result.outcome === 'stuck' || !result.assignment) {
    tally.stuck++;
    return;
  }
  for (const p of PARTY_IDS) tally.roomCounts[p][result.assignment[p]]++;
  if (result.arrangement !== undefined) tally.arrangementCounts[result.arrangement]!++;
}

/** Sum several tallies (from parallel workers) into one. */
export function mergeTallies(parts: readonly Tally[]): Tally {
  const out = emptyTally();
  for (const t of parts) {
    out.rounds += t.rounds;
    out.stuck += t.stuck;
    out.attempts += t.attempts;
    for (const p of PARTY_IDS) for (const room of Object.keys(out.roomCounts[p]) as Room[]) out.roomCounts[p][room] += t.roomCounts[p][room];
    t.arrangementCounts.forEach((c, k) => { out.arrangementCounts[k]! += c; });
  }
  return out;
}
