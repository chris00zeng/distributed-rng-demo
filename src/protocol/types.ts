/**
 * Shared types for the protocol engine (Technical Plan, Data model & interfaces).
 * Everything below the UI sees only these.
 */
import type { Scalar } from '../crypto/field';
import type { Prng } from '../crypto/prng';
import type { Room } from '../crypto/arrangements';

export type PartyId = 0 | 1 | 2 | 3;
export const PARTY_IDS: readonly PartyId[] = [0, 1, 2, 3];
export const PARTY_NAMES: Readonly<Record<PartyId, string>> = { 0: 'Zoe', 1: 'Ana', 2: 'Ben', 3: 'Dave' };
export const DAVE: PartyId = 3;
export const N_PARTIES = 4;

export type Rung = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** `manual`: the user plays this roommate; every decision waits for a choice (honest by default in bulk runs). */
export type Role = 'honest' | 'liar' | 'lastMover' | 'aborter' | 'badDealer' | 'fakeShare' | 'colluder' | 'manual';

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
  /** `commitment` is the wire form (hash, or t × 32-byte curve points). `points` is the
   *  decoded Feldman commitment carried alongside so recipients need not decompress. */
  | { kind: 'commit'; commitment: Uint8Array; points?: unknown[] }
  | { kind: 'reveal'; value: Scalar; nonce: Uint8Array }
  /** Private: dealer's share of its own value for the recipient (x = recipient id + 1). */
  | { kind: 'share'; dealer: PartyId; x: number; y: Scalar }
  /** Broadcast during reconstruction of a silent dealer's value. */
  | { kind: 'reconstructShare'; dealer: PartyId; x: number; y: Scalar }
  /** Rung 5+: my share from `dealer` failed verification. */
  | { kind: 'complaint'; dealer: PartyId }
  /** Rung 5+: I have checked every share I hold; here is who I complained about. */
  | { kind: 'checked'; complaints: PartyId[] }
  /** Rung 5+: a dealer answers a complaint by publishing that recipient's share. */
  | { kind: 'publishShare'; x: number; y: Scalar }
  /** Collusion: an accomplice forwards a share it holds to the ringleader (private). */
  | { kind: 'forward'; dealer: PartyId; x: number; y: Scalar }
  /** Collusion: an accomplice tells the ringleader its own pick (private). */
  | { kind: 'tell'; value: Scalar }
  /** Collusion: the ringleader tells an accomplice whether to deal or go silent (private). */
  | { kind: 'plan'; deal: boolean };

export interface Envelope {
  /** One seq per logical send; a broadcast fans out into envelopes sharing it. */
  seq: number;
  from: PartyId;
  to: PartyId;
  msg: Msg;
}

export type Phase = 'announce' | 'commit' | 'deal' | 'complain' | 'reveal' | 'reconstruct' | 'done';

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
  /** Rung 5+: dealers whose share to me failed verification (complaints I know of). */
  complaints: PartyId[];
  /** Rung 5+: dealers thrown out for not answering a complaint. */
  disqualified: PartyId[];
  /** Rung 5+: parties whose reconstruction share was rejected by verification. */
  rejected: PartyId[];
  /** Rung 5+: my value is a padded pick (D23). */
  padded?: boolean;
  /** Integer total of the contributions this party combined. */
  combined?: Scalar;
  /** The arrangement number: combined mod 24. */
  arrangement?: number;
  assignment?: Record<PartyId, Room>;
  /** Short note for the panel, e.g. "waiting for the others to reveal". */
  note?: string;
}

/** One way a party could act at a decision point. Exactly one option is the honest one. */
export interface DecisionOption {
  id: string;
  label: string;
  honest: boolean;
}

/**
 * A point where a party could deviate from the honest protocol (Technical Plan D24).
 * Honest parties raise these too; the party's policy (its role) picks the option,
 * and the UI may override any decision and replay the round.
 */
export interface DecisionPoint {
  /** Stable kind: 'roll' | 'speak' | 'steer' | 'revealTiming' | 'reveal' | 'deal' | 'reconstruct'. */
  kind: string;
  /** Short situation line for the panel, e.g. "Everyone else has revealed". */
  prompt: string;
  options: DecisionOption[];
  /** What the party knows that bears on the choice (e.g. the room it would get). */
  context?: Record<string, string | number | boolean>;
}

/** Maps a decision point to the id of the option a role takes. */
export type Policy = (point: DecisionPoint, party: PartyId) => string;

export interface Ctx {
  readonly id: PartyId;
  readonly n: number;
  readonly rng: Prng;
  readonly scenario: Scenario;
  send(to: PartyId | 'all', msg: Msg): void;
  /** Ask the party's policy (or a UI override) which option to take. Returns the option id. */
  decide(point: DecisionPoint): string;
  /** Stop participating on purpose. The driver decides what that means for this protocol. */
  abort(): void;
  /** Stop participating by accident (dead phone). Same mechanics as abort, different label. */
  dropout(): void;
  /** Declare the round void (e.g. shares that do not add up). The round restarts for everyone. */
  void(reason: string): void;
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
  /** An honest party found the round unrecoverable and called it void: restart. */
  | { kind: 'void'; by: PartyId; reason: string }
  /** A party chose at a decision point. `index` is its ordinal within the round, for overrides. */
  | { kind: 'decision'; by: PartyId; index: number; point: DecisionPoint; chosen: string; deviates: boolean;
      /** The roommate is played by the user and no choice has been made yet (the honest option stands in). */
      manual?: boolean }
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
  arrangement?: number;
  attempts: number;
  reason?: string;
}
