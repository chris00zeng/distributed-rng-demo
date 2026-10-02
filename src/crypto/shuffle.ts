/**
 * From a combined field element to a room assignment (Technical Plan D8):
 *   1. seed = SHA-256(S as 32 bytes)
 *   2. word stream = SHA-256(seed ‖ counter) for counter 0, 1, 2…
 *   3. Fisher–Yates over the four rooms, each index drawn by rejection sampling
 *      so there is no modulo bias.
 * Party i receives permutation[i].
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { scalarToBytes, type Scalar } from './field';
import { uniformBelow } from './prng';

export const ROOMS = ['master', 'decent', 'small', 'closet'] as const;
export type Room = (typeof ROOMS)[number];

/** Infinite stream of u32 words from SHA-256(seed ‖ counter), big-endian words. */
export function hashWordStream(seed: Uint8Array): () => number {
  let counter = 0;
  let block = new Uint8Array(0);
  let offset = 0;
  return () => {
    if (offset >= block.length) {
      const ctr = new Uint8Array(4);
      new DataView(ctr.buffer).setUint32(0, counter++, false);
      block = sha256(concatBytes(seed, ctr));
      offset = 0;
    }
    const w = new DataView(block.buffer, block.byteOffset + offset, 4).getUint32(0, false);
    offset += 4;
    return w;
  };
}

/** In-place Fisher–Yates with a caller-supplied uniform source. Returns a new array. */
export function fisherYates<T>(items: readonly T[], nextU32: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = uniformBelow(i + 1, nextU32);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Deterministic room permutation for a combined value S. Index = party id. */
export function assignRooms(combined: Scalar): Room[] {
  const seed = sha256(scalarToBytes(combined));
  return fisherYates(ROOMS, hashWordStream(seed));
}
