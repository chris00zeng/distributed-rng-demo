/**
 * Simulated message bus (Technical Plan D9). Delivery is breadth-first and
 * deterministic for a seed: every message already in flight is delivered
 * before any message sent in response to one of them. Each envelope carries a
 * generation (messages sent while handling a generation-g delivery are
 * generation g+1); within a generation, envelopes are ordered by (per-round
 * rank of the sender, seq). A dropped party's outbound messages are discarded.
 */
import { shuffle, type Prng } from '../crypto/prng';
import { PARTY_IDS, type Envelope, type Msg, type PartyId } from './types';

interface Queued { env: Envelope; gen: number }

export class Bus {
  private queue: Queued[] = [];
  private seq = 0;
  /** Generation stamped on the next send: one past the last delivered envelope's. */
  private gen = 0;
  private dropped = new Set<PartyId>();
  private rank: Record<PartyId, number>;

  constructor(rng: Prng) {
    const order = shuffle(PARTY_IDS, rng);
    this.rank = { 0: 0, 1: 0, 2: 0, 3: 0 };
    order.forEach((p, i) => { this.rank[p] = i; });
  }

  send(from: PartyId, to: PartyId | 'all', msg: Msg): void {
    if (this.dropped.has(from)) return;
    const seq = this.seq++;
    const targets = to === 'all' ? PARTY_IDS.filter((p) => p !== from) : [to];
    for (const t of targets) this.queue.push({ env: { seq, from, to: t, msg }, gen: this.gen });
  }

  deliverNext(): Envelope | null {
    if (this.queue.length === 0) return null;
    let best = 0;
    for (let i = 1; i < this.queue.length; i++) {
      if (this.before(this.queue[i]!, this.queue[best]!)) best = i;
    }
    const picked = this.queue.splice(best, 1)[0]!;
    this.gen = picked.gen + 1;
    return picked.env;
  }

  /** Generation first, then the sender's seeded rank, then seq. */
  private before(a: Queued, b: Queued): boolean {
    if (a.gen !== b.gen) return a.gen < b.gen;
    const ra = this.rank[a.env.from], rb = this.rank[b.env.from];
    if (ra !== rb) return ra < rb;
    return a.env.seq < b.env.seq;
  }

  pending(): number {
    return this.queue.length;
  }

  /**
   * Party goes dark: nothing it sends from now on is delivered. Envelopes it
   * already handed to the bus are in flight and still arrive (a phone that dies
   * after sending has still sent).
   */
  drop(party: PartyId): void {
    this.dropped.add(party);
  }

  isDropped(party: PartyId): boolean {
    return this.dropped.has(party);
  }

  /** Parties in this round's delivery order. */
  order(): PartyId[] {
    return [...PARTY_IDS].sort((a, b) => this.rank[a] - this.rank[b]);
  }
}
