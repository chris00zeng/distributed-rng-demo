import { describe, expect, it } from 'vitest';
import { commit, open, makeNonce, NONCE_BYTES } from './commit';
import { sampleScalar } from './field';
import { makePrng } from './prng';

describe('hash commitments', () => {
  const rng = makePrng('commit');
  const value = sampleScalar(rng);
  const nonce = makeNonce(rng);
  const c = commit(value, nonce);

  it('is 32 bytes and opens with the right value and nonce', () => {
    expect(c.length).toBe(32);
    expect(nonce.length).toBe(NONCE_BYTES);
    expect(open(c, value, nonce)).toBe(true);
  });

  it('fails to open with a wrong value', () => {
    expect(open(c, (value + 1n) % (2n ** 252n), nonce)).toBe(false);
  });

  it('fails to open with a wrong nonce', () => {
    const other = makeNonce(rng);
    expect(open(c, value, other)).toBe(false);
    const flipped = nonce.slice();
    flipped[0]! ^= 1;
    expect(open(c, value, flipped)).toBe(false);
  });

  it('is deterministic and nonce-sensitive', () => {
    expect(commit(value, nonce)).toEqual(c);
    expect(commit(value, makeNonce(rng))).not.toEqual(c);
  });

  it('rejects malformed inputs', () => {
    expect(() => commit(value, new Uint8Array(16))).toThrow(RangeError);
    expect(open(new Uint8Array(31), value, nonce)).toBe(false);
    expect(open(c, value, new Uint8Array(16))).toBe(false);
  });
});
