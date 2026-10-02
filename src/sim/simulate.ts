/**
 * N rounds through the driver with derived seeds, tallied per party and room
 * (Technical Plan D13). `simulateSync` for tests; `simulate` yields between
 * chunks so the chart can fill in progressively.
 */
import { deriveSeed } from '../crypto/prng';
import { N_ARRANGEMENTS, ROOMS, type Room } from '../crypto/arrangements';
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
  for (const p of PARTY_IDS) {
    roomCounts[p] = { master: 0, decent: 0, small: 0, closet: 0 };
  }
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

export function simulateSync(scenario: Scenario, rounds = 1000): Tally {
  const tally = emptyTally();
  for (let k = 0; k < rounds; k++) addRound(tally, scenario, k);
  return tally;
}

/**
 * Give the browser a turn between chunks so the chart can paint. Uses
 * `scheduler.yield` where available, else a MessageChannel hop. Not
 * `setTimeout(0)`: background tabs clamp timers to once a second, which
 * made a 1,000-round run crawl when the tab was not in front.
 */
function yieldToBrowser(): Promise<void> {
  const sched = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (sched?.yield) return sched.yield();
  if (typeof MessageChannel !== 'undefined') {
    return new Promise<void>((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
      ch.port2.postMessage(null);
    });
  }
  return new Promise<void>((r) => setTimeout(r, 0));
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
      await yieldToBrowser();
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
