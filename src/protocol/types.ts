/**
 * Shared types for the protocol engine (Technical Plan, Data model & interfaces).
 * Everything below the UI sees only these.
 */
import type { Scalar } from '../crypto/field';
import type { Prng } from '../crypto/prng';
import type { Room } from '../crypto/shuffle';

export type PartyId = 0 | 1 | 2 | 3;
export const PARTY_IDS: readonly PartyId[] = [0, 1, 2, 3];
export const PARTY_NAMES: Readonly<Record<PartyId, string>> = { 0: 'You', 1: 'Ana', 2: 'Ben', 3: 'Dave' };
export const DAVE: PartyId = 3;
export const N_PARTIES = 4;

export type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Role = 'honest' | 'liar' | 'lastMover' | 'aborter' | 'badDealer' | 'fakeShare' | 'colluder';

export type ProtocolConfig =
  | { kind: 'trusted' }                               // rung 0; dealer is Dave
  | { kind: 'announce' }                              // rung 1
  | { kind: 'commitReveal' }                          // rung 2
  | { kind: 'shared'; verify: boolean; t: number };   // rungs 3–6 (PR5, PR8)

export interface Scenario {
  protocol: ProtocolConfig;
  roles: Record<PartyId, Role>;
  seed: string;
  dropout?: PartyId;
}

export type Msg =
  | { kind: 'announce'; value: Scalar }
  | { kind: 'commit'; commitment: Uint8Array }
  | { kind: 'reveal'; value: Scalar; nonce: Uint8Array }
  /** Private: dealer's share of its own value for the recipient (x = recipient id + 1). */
  | { kind: 'share'; dealer: PartyId; x: number; y: Scalar }
  /** Broadcast during reconstruction of a silent dealer's value. */
  | { kind: 'reconstructShare'; dealer: PartyId; x: number; y: Scalar };

export interface Envelope {
  /** One seq per logical send; a broadcast fans out into envelopes sharing it. */
  seq: number;
  from: PartyId;
  to: PartyId;
  msg: Msg;
}

export type Phase = 'announce' | 'commit' | 'deal' | 'reveal' | 'reconstruct' | 'done';

export interface HeldShare {
  dealer: PartyId;
  x: number;
  y: Scalar;
}

/** Exactly what one party knows right now. Panels render this and nothing else. */
export interface PartyView {
  phase: Phase;
  myValue?: Scalar;
  myNonce?: Uint8Array;
  announced: Partial<Record<PartyId, Scalar>>;
  commitments: Partial<Record<PartyId, Uint8Array>>;
  revealed: Partial<Record<PartyId, Scalar>>;
  /** Parties whose reveal did not open their commitment. */
  invalid: PartyId[];
  /** Shares this party holds, one per dealer in normal play (rungs 3+). */
  sharesHeld: HeldShare[];
  /** Values rebuilt from shares because the dealer went silent. */
  reconstructed: Partial<Record<PartyId, Scalar>>;
  /** Parties left out of the round because they went silent before dealing. */
  excluded: PartyId[];
  combined?: Scalar;
  assignment?: Record<PartyId, Room>;
  /** Short note for the panel, e.g. "waiting for the others to reveal". */
  note?: string;
}

export interface Ctx {
  readonly id: PartyId;
  readonly n: number;
  readonly rng: Prng;
  readonly scenario: Scenario;
  send(to: PartyId | 'all', msg: Msg): void;
  /** Stop participating on purpose. The driver decides what that means for this protocol. */
  abort(): void;
  /** Stop participating by accident (dead phone). Same mechanics as abort, different label. */
  dropout(): void;
}

export interface Party {
  readonly id: PartyId;
  onStart(ctx: Ctx): void;
  onMessage(env: Envelope, ctx: Ctx): void;
  /**
   * Called when the bus is empty and the round is not finished, in seeded
   * party order. Return true after acting. Models "waited long enough".
   */
  onIdle?(ctx: Ctx): boolean;
  /** Deep snapshot of what this party knows. Costly; the driver calls it only when recording. */
  view(): PartyView;
  /** Cheap accessors for the driver's hot loop. */
  phase(): Phase;
  assignment(): Record<PartyId, Room> | undefined;
}

export type Event =
  | { kind: 'start'; attempt: number }
  | { kind: 'deliver'; env: Envelope }
  | { kind: 'drop'; party: PartyId }
  | { kind: 'phase'; phase: Phase }
  | { kind: 'abort'; by: PartyId; restart: boolean; cause: 'abort' | 'dropout' }
  | { kind: 'outcome'; assignment: Record<PartyId, Room> }
  | { kind: 'stuck'; reason: string };

export interface RoundLog {
  scenario: Scenario;
  events: Event[];
  /** views[step][party]: snapshot after each event. Empty when not recorded. */
  views: PartyView[][];
}

export interface RoundResult {
  outcome: 'assigned' | 'stuck';
  assignment?: Record<PartyId, Room>;
  attempts: number;
  reason?: string;
}
