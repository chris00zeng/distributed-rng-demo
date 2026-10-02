import { describe, expect, it } from 'vitest';
import { ristretto255 } from '@noble/curves/ed25519.js';
import {
  L, add, sub, mul, neg, pow, inv, mod, isScalar,
  scalarToBytes, bytesToScalar, bytesToBigInt, sampleScalar, sampleNonZeroScalar,
} from './field';
import { INV_KAT } from './field.kat';
import { makePrng } from './prng';

describe('field Z_ℓ', () => {
  it('ℓ equals the ristretto255 group order used by noble-curves', () => {
    expect(L).toBe(ristretto255.Point.Fn.ORDER);
  });

  it('mod maps negatives and multiples of ℓ into [0, ℓ)', () => {
    expect(mod(-1n)).toBe(L - 1n);
    expect(mod(L)).toBe(0n);
    expect(mod(2n * L + 7n)).toBe(7n);
    expect(mod(-L)).toBe(0n);
  });

  it('inverse matches Python pow(a, -1, ℓ) known-answer vectors', () => {
    for (const [a, expected] of INV_KAT) {
      expect(inv(a)).toBe(expected);
      expect(mul(a, expected)).toBe(1n);
    }
  });

  it('a · inv(a) = 1 for random a', () => {
    const rng = makePrng('field-inverse');
    for (let i = 0; i < 50; i++) {
      const a = sampleNonZeroScalar(rng);
      expect(mul(a, inv(a))).toBe(1n);
    }
  });

  it('inv(0) throws', () => {
    expect(() => inv(0n)).toThrow(RangeError);
  });

  it('pow agrees with repeated multiplication and handles edge exponents', () => {
    const a = 123456789n;
    let acc = 1n;
    for (let e = 0n; e < 20n; e++) {
      expect(pow(a, e)).toBe(acc);
      acc = mul(acc, a);
    }
    expect(pow(a, 0n)).toBe(1n);
    expect(pow(0n, 5n)).toBe(0n);
    expect(() => pow(a, -1n)).toThrow(RangeError);
    // Fermat: a^(ℓ-1) = 1
    expect(pow(a, L - 1n)).toBe(1n);
  });

  it('add/sub/neg are consistent', () => {
    const rng = makePrng('field-addsub');
    for (let i = 0; i < 20; i++) {
      const a = sampleScalar(rng);
      const b = sampleScalar(rng);
      expect(sub(add(a, b), b)).toBe(a);
      expect(add(a, neg(a))).toBe(0n);
    }
  });

  it('32-byte big-endian encoding round-trips and rejects out-of-range values', () => {
    const rng = makePrng('field-bytes');
    for (let i = 0; i < 20; i++) {
      const a = sampleScalar(rng);
      const bytes = scalarToBytes(a);
      expect(bytes.length).toBe(32);
      expect(bytesToScalar(bytes)).toBe(a);
      expect(bytesToBigInt(bytes)).toBe(a);
    }
    expect(scalarToBytes(1n)[31]).toBe(1);
    expect(() => scalarToBytes(L)).toThrow(RangeError);
    expect(() => scalarToBytes(-1n)).toThrow(RangeError);
    expect(() => bytesToScalar(new Uint8Array(31))).toThrow(RangeError);
    const tooBig = new Uint8Array(32).fill(0xff);
    expect(() => bytesToScalar(tooBig)).toThrow(RangeError);
  });

  it('sampleScalar is always in range and uses the full width', () => {
    const rng = makePrng('field-sample');
    let highBitSet = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      const s = sampleScalar(rng);
      expect(isScalar(s)).toBe(true);
      if (s >> 251n === 1n) highBitSet++;
    }
    // ℓ ≈ 2^252, so bit 251 should be set about half the time.
    expect(highBitSet).toBeGreaterThan(n * 0.4);
    expect(highBitSet).toBeLessThan(n * 0.6);
  });
});
