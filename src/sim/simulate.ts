/**
 * N rounds through the driver with derived seeds, tallied per party and room
 * (Technical Plan D13). `simulateSync` for tests; `simulate` yields between
 * chunks so the chart can fill in progressively.
 */
import { deriveSeed } from '../crypto/prng';
import { ROOMS, type Room } from '../crypto/shuffle';
import { runRound } from '../protocol/driver';
import { PARTY_IDS, type PartyId, type Scenario } from '../protocol/types';

export interface Tally {
  rounds: number;
  stuck: number;
  attempts: number;
  roomCounts: Record<PartyId, Record<Room, number>>;
}

export function emptyTally(): Tally {
  const roomCounts = {} as Record<PartyId, Record<Room, number>>;
  for (const p of PARTY_IDS) {
    roomCounts[p] = { master: 0, decent: 0, small: 0, closet: 0 };
  }
  return { rounds: 0, stuck: 0, attempts: 0, roomCounts };
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
}

export function simulateSync(scenario: Scenario, rounds = 1000): Tally {
  const tally = emptyTally();
  for (let k = 0; k < rounds; k++) addRound(tally, scenario, k);
  return tally;
}

export async function simulate(
  scenario: Scenario,
  rounds = 1000,
  onChunk?: (tally: Tally) => void,
  chunk = 25,
  signal?: AbortSignal,
): Promise<Tally> {
  const tally = emptyTally();
  for (let k = 0; k < rounds; k++) {
    if (signal?.aborted) break;
    addRound(tally, scenario, k);
    if ((k + 1) % chunk === 0) {
      onChunk?.(tally);
      await new Promise<void>((r) => setTimeout(r, 0));
    }
  }
  onChunk?.(tally);
  return tally;
}

/** Fraction of completed rounds in which `party` got `room`. */
export function share(tally: Tally, party: PartyId, room: Room): number {
  const done = tally.rounds - tally.stuck;
  return done === 0 ? 0 : tally.roomCounts[party][room] / done;
}

export { ROOMS };
