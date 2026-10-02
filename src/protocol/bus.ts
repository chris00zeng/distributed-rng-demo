/**
 * Simulated message bus (Technical Plan D9). Delivery order is deterministic
 * for a seed: envelopes are ordered by (per-round rank of the sender, seq).
 * A dropped party's outbound messages are discarded.
 */
import { fisherYates } from '../crypto/shuffle';
import type { Prng } from '../crypto/prng';
import { PARTY_IDS, type Envelope, type Msg, type PartyId } from './types';

export class Bus {
  private queue: Envelope[] = [];
  private seq = 0;
  private dropped = new Set<PartyId>();
  private rank: Record<PartyId, number>;

  constructor(rng: Prng) {
    const order = fisherYates(PARTY_IDS, () => rng.u32());
    this.rank = { 0: 0, 1: 0, 2: 0, 3: 0 };
    order.forEach((p, i) => { this.rank[p] = i; });
  }

  send(from: PartyId, to: PartyId | 'all', msg: Msg): void {
    if (this.dropped.has(from)) return;
    const seq = this.seq++;
    const targets = to === 'all' ? PARTY_IDS.filter((p) => p !== from) : [to];
    for (const t of targets) this.queue.push({ seq, from, to: t, msg });
  }

  deliverNext(): Envelope | null {
    if (this.queue.length === 0) return null;
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      const a = this.queue[i]!, b = this.queue[best]!;
      if (this.rank[a.from] < this.rank[b.from] || (a.from === b.from && a.seq < b.seq)) best = i;
    }
    return this.queue.splice(best, 1)[0]!;
  }

  pending(): number {
    return this.queue.length;
  }

  drop(party: PartyId): void {
    this.dropped.add(party);
    this.queue = this.queue.filter((e) => e.from !== party);
  }

  isDropped(party: PartyId): boolean {
    return this.dropped.has(party);
  }

  /** Parties in this round's delivery order. */
  order(): PartyId[] {
    return [...PARTY_IDS].sort((a, b) => this.rank[a] - this.rank[b]);
  }
}
