import { arrangement, combine, type Room } from '../../crypto/arrangements';
import type { Scalar } from '../../crypto/field';
import { PARTY_IDS, type Ctx, type Envelope, type Party, type PartyId, type PartyView, type Phase } from '../types';

/** Shared state and helpers for every protocol party. */
export abstract class BaseParty implements Party {
  protected state: PartyView;

  constructor(readonly id: PartyId, phase: Phase) {
    this.state = { phase, announced: {}, commitments: {}, revealed: {}, invalid: [], sharesHeld: [], reconstructed: {}, excluded: [] };
  }

  abstract onStart(ctx: Ctx): void;
  abstract onMessage(env: Envelope, ctx: Ctx): void;

  view(): PartyView {
    return structuredClone(this.state);
  }

  phase(): Phase {
    return this.state.phase;
  }

  assignment(): Record<PartyId, Room> | undefined {
    return this.state.assignment;
  }

  /** Integer total of the given contributions (not field arithmetic: D21). */
  protected total(values: Partial<Record<PartyId, Scalar>>): Scalar {
    let s: Scalar = 0n;
    for (const p of PARTY_IDS) s += values[p] ?? 0n;
    return s;
  }

  protected finish(values: Partial<Record<PartyId, Scalar>>): void {
    this.finishWith(this.total(values));
  }

  /** `combined` is the integer total; the arrangement is its remainder mod 24. */
  protected finishWith(combined: Scalar): void {
    const k = combine([combined]);
    const rooms = arrangement(k);
    const assignment = {} as Record<PartyId, Room>;
    for (const p of PARTY_IDS) assignment[p] = rooms[p]!;
    this.state.combined = combined;
    this.state.arrangement = k;
    this.state.assignment = assignment;
    this.state.phase = 'done';
    this.state.note = undefined;
  }

  protected count(rec: Partial<Record<PartyId, unknown>>): number {
    return PARTY_IDS.filter((p) => rec[p] !== undefined).length;
  }
}
