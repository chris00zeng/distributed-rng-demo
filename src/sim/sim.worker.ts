/**
 * Simulation worker: runs a slice of the rounds and streams partial tallies back
 * (Technical Plan D13, parallel fallback). Round k always uses the seed derived
 * from k, so the merged result is identical to a serial run.
 */
import type { Scenario } from '../protocol/types';
import { addRound, emptyTally, type Tally } from './core';

export interface SimRequest { scenario: Scenario; from: number; to: number; chunk: number }
export interface SimProgress { tally: Tally; done: boolean }

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { scenario, from, to, chunk } = e.data;
  const tally = emptyTally();
  for (let k = from; k < to; k++) {
    addRound(tally, scenario, k);
    if ((k - from + 1) % chunk === 0 && k + 1 < to) (self as unknown as Worker).postMessage({ tally, done: false } satisfies SimProgress);
  }
  (self as unknown as Worker).postMessage({ tally, done: true } satisfies SimProgress);
};
