/**
 * Seeded, deterministic PRNG for every random choice in the demo
 * (Technical Plan D7). sfc32 seeded from a string via a 128-bit hash.
 *
 * This is NOT cryptographic randomness. It exists so that a URL can replay a
 * round exactly (PRD R13). A real deployment would use crypto.getRandomValues.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

export interface Prng {
  /** Next uniform 32-bit unsigned integer. */
  u32(): number;
  /** `n` uniform bytes. */
  bytes(n: number): Uint8Array;
  /** Uniform integer in [0, k) by rejection sampling: no modulo bias. */
  below(k: number): number;
}

/** 128-bit string hash (cyrb128) producing four 32-bit seeds for sfc32. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** Largest multiple of k that fits in 32 bits; draws at or above it are rejected. */
export function rejectionThreshold(k: number): number {
  if (!Number.isInteger(k) || k < 1 || k > 0x1_0000_0000) throw new RangeError('k out of range');
  return Math.floor(0x1_0000_0000 / k) * k;
}

/** Rejection-sampled uniform index in [0, k) from a source of u32s. */
export function uniformBelow(k: number, nextU32: () => number): number {
  if (k === 1) return 0;
  const limit = rejectionThreshold(k);
  for (;;) {
    const x = nextU32();
    if (x < limit) return x % k;
  }
}

export function makePrng(seed: string): Prng {
  let [a, b, c, d] = cyrb128(seed);
  const u32 = (): number => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return t >>> 0;
  };
  // Warm up: sfc32's first outputs are correlated with the seed words.
  for (let i = 0; i < 15; i++) u32();
  return {
    u32,
    bytes(n: number): Uint8Array {
      const out = new Uint8Array(n);
      for (let i = 0; i < n; i += 4) {
        const w = u32();
        out[i] = w & 0xff;
        if (i + 1 < n) out[i + 1] = (w >>> 8) & 0xff;
        if (i + 2 < n) out[i + 2] = (w >>> 16) & 0xff;
        if (i + 3 < n) out[i + 3] = (w >>> 24) & 0xff;
      }
      return out;
    },
    below(k: number): number {
      return uniformBelow(k, u32);
    },
  };
}

/**
 * Derive a child seed: `sha256(seed ‖ label)` as hex. Round k of a simulation
 * uses `deriveSeed(scenario.seed, k)` (Technical Plan, Deterministic ordering).
 */
export function deriveSeed(seed: string, label: string | number): string {
  return bytesToHex(sha256(utf8ToBytes(`${seed}\u0000${label}`)));
}
