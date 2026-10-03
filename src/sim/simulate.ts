/**
 * N rounds through the driver with derived seeds, tallied per party and room
 * (Technical Plan D13). `simulateSync` for tests and workers; `simulate` for the
 * UI: a pool of Web Workers splits the rounds across cores (rung 5's curve
 * arithmetic needs it) and streams merged partial tallies; without Workers it
 * falls back to chunked main-thread execution.
 */
import { ROOMS, type Room } from '../crypto/arrangements';
import type { PartyId, Scenario } from '../protocol/types';
import { addRound, emptyTally, mergeTallies, type Tally } from './core';
import type { SimProgress, SimRequest } from './sim.worker';

export { addRound, emptyTally, mergeTallies, type Tally };

export function simulateSync(scenario: Scenario, rounds = 1000): Tally {
  const tally = emptyTally();
  for (let k = 0; k < rounds; k++) addRound(tally, scenario, k);
  return tally;
}

/**
 * Give the browser a turn between chunks so the chart can paint. Uses
 * `scheduler.yield` where available, else a MessageChannel hop. Not
 * `setTimeout(0)`: background tabs clamp timers to once a second.
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

const workersSupported = typeof Worker !== 'undefined' && typeof import.meta.url === 'string';

function workerCount(): number {
  const hc = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
  return Math.max(1, Math.min(8, (hc ?? 4) - 1));
}

let pool: Worker[] | null = null;
function getPool(n: number): Worker[] {
  if (!pool || pool.length !== n) {
    pool?.forEach((w) => w.terminate());
    pool = Array.from({ length: n }, () => new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' }));
  }
  return pool;
}

export async function simulate(
  scenario: Scenario,
  rounds = 1000,
  onChunk?: (tally: Tally) => void,
  chunk = 25,
  signal?: AbortSignal,
): Promise<Tally> {
  if (workersSupported && rounds >= 100) {
    try {
      return await simulateParallel(scenario, rounds, onChunk, chunk, signal);
    } catch {
      /* fall through to the main thread */
    }
  }
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

function simulateParallel(
  scenario: Scenario, rounds: number, onChunk: ((t: Tally) => void) | undefined, chunk: number, signal?: AbortSignal,
): Promise<Tally> {
  const n = Math.min(workerCount(), Math.max(1, Math.floor(rounds / chunk)));
  const workers = getPool(n);
  const parts: Tally[] = workers.map(() => emptyTally());
  return new Promise<Tally>((resolve, reject) => {
    let finished = 0;
    const cleanup = () => workers.forEach((w) => { w.onmessage = null; w.onerror = null; });
    const onAbort = () => { cleanup(); pool?.forEach((w) => w.terminate()); pool = null; resolve(mergeTallies(parts)); };
    signal?.addEventListener('abort', onAbort, { once: true });
    workers.forEach((w, i) => {
      const from = Math.floor((rounds * i) / n);
      const to = Math.floor((rounds * (i + 1)) / n);
      w.onerror = (e) => { cleanup(); reject(e.error ?? new Error('simulation worker failed')); };
      w.onmessage = (e: MessageEvent<SimProgress>) => {
        parts[i] = e.data.tally;
        onChunk?.(mergeTallies(parts));
        if (e.data.done && ++finished === n) {
          cleanup();
          signal?.removeEventListener('abort', onAbort);
          resolve(mergeTallies(parts));
        }
      };
      w.postMessage({ scenario, from, to, chunk } satisfies SimRequest);
    });
  });
}

/** Fraction of completed rounds in which `party` got `room`. */
export function share(tally: Tally, party: PartyId, room: Room): number {
  const done = tally.rounds - tally.stuck;
  return done === 0 ? 0 : tally.roomCounts[party][room] / done;
}

export { ROOMS };
