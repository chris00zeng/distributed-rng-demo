import { add, type Scalar } from '../../crypto/field';
import { assignRooms, type Room } from '../../crypto/shuffle';
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

  protected finish(values: Partial<Record<PartyId, Scalar>>): void {
    let s: Scalar = 0n;
    for (const p of PARTY_IDS) s = add(s, values[p] ?? 0n);
    this.finishWith(s);
  }

  protected finishWith(combined: Scalar): void {
    const rooms = assignRooms(combined);
    const assignment = {} as Record<PartyId, Room>;
    for (const p of PARTY_IDS) assignment[p] = rooms[p]!;
    this.state.combined = combined;
    this.state.assignment = assignment;
    this.state.phase = 'done';
    this.state.note = undefined;
  }

  protected count(rec: Partial<Record<PartyId, unknown>>): number {
    return PARTY_IDS.filter((p) => rec[p] !== undefined).length;
  }
}
