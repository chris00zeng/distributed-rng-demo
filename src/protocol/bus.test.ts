import { describe, expect, it } from 'vitest';
import { makePrng } from '../crypto/prng';
import { Bus } from './bus';

describe('bus', () => {
  it('fans out broadcasts to everyone but the sender, sharing one seq', () => {
    const bus = new Bus(makePrng('bus'));
    bus.send(1, 'all', { kind: 'announce', value: 1n });
    expect(bus.pending()).toBe(3);
    const envs = [bus.deliverNext()!, bus.deliverNext()!, bus.deliverNext()!];
    expect(envs.map((e) => e.to).sort()).toEqual([0, 2, 3]);
    expect(new Set(envs.map((e) => e.seq)).size).toBe(1);
    expect(bus.deliverNext()).toBeNull();
  });

  it('delivers in seeded sender order, then by seq within a sender', () => {
    const bus = new Bus(makePrng('order'));
    const order = bus.order();
    for (const p of [3, 2, 1, 0] as const) {
      bus.send(p, 0 === p ? 1 : 0, { kind: 'announce', value: 1n });
      bus.send(p, 0 === p ? 2 : 1 === p ? 2 : 1, { kind: 'announce', value: 2n });
    }
    const got: number[] = [];
    for (let e = bus.deliverNext(); e; e = bus.deliverNext()) got.push(e.from);
    const expected = order.flatMap((p) => [p, p]);
    expect(got).toEqual(expected);
  });

  it('delivers everything in flight before anything sent in response (breadth-first)', () => {
    const bus = new Bus(makePrng('bfs'));
    for (const p of [0, 1, 2, 3] as const) bus.send(p, 'all', { kind: 'announce', value: 1n });
    const gens: number[] = [];
    for (let e = bus.deliverNext(); e; e = bus.deliverNext()) {
      gens.push(Number(e.msg.kind === 'announce' ? e.msg.value : -1n));
      // Each recipient answers every first-wave message it sees; none of those answers
      // may arrive before the first wave has fully landed.
      if (e.msg.kind === 'announce' && e.msg.value === 1n) bus.send(e.to, 'all', { kind: 'announce', value: 2n });
    }
    expect(gens.slice(0, 12)).toEqual(Array(12).fill(1));
    expect(gens.slice(12)).toEqual(Array(36).fill(2));
  });

  it('drop keeps in-flight messages but discards future ones from that party', () => {
    const bus = new Bus(makePrng('drop'));
    bus.send(2, 'all', { kind: 'announce', value: 1n });
    bus.drop(2);
    expect(bus.pending()).toBe(3);
    bus.send(2, 'all', { kind: 'announce', value: 1n });
    expect(bus.pending()).toBe(3);
    expect(bus.isDropped(2)).toBe(true);
  });
});
