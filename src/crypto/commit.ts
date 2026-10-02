/**
 * Hash commitments for rung 2: C = SHA-256(value ‖ nonce), with a 32-byte nonce.
 * Binding: a different value gives a different hash (collision resistance).
 * Hiding: the nonce makes the preimage unguessable (Technical Plan, commit).
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes } from '@noble/hashes/utils.js';
import { scalarToBytes, type Scalar } from './field';
import type { Prng } from './prng';

export const NONCE_BYTES = 32;

export function makeNonce(rng: Prng): Uint8Array {
  return rng.bytes(NONCE_BYTES);
}

export function commit(value: Scalar, nonce: Uint8Array): Uint8Array {
  if (nonce.length !== NONCE_BYTES) throw new RangeError('nonce must be 32 bytes');
  return sha256(concatBytes(scalarToBytes(value), nonce));
}

/** Constant-time byte equality (length must match). */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** True iff (value, nonce) opens the commitment. */
export function open(commitment: Uint8Array, value: Scalar, nonce: Uint8Array): boolean {
  if (nonce.length !== NONCE_BYTES || commitment.length !== 32) return false;
  return equalBytes(commit(value, nonce), commitment);
}
