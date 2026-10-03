import { describe, expect, it } from 'vitest';
import { RUNGS } from './rungs';
import { rolesFor } from '../protocol/parties';
import { RUNG_PROTOCOLS } from '../protocol/scenario';
import { DAVE } from '../protocol/types';

describe('level copy', () => {
  it('has seven levels numbered 0 to 6 in order', () => {
    expect(RUNGS.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('every available level has full copy, a story beat, and an attack role the protocol offers Dave', () => {
    for (const r of RUNGS.filter((r) => r.available)) {
      for (const field of ['story', 'protocol', 'attack', 'outcome', 'lesson'] as const) expect(r[field].length).toBeGreaterThan(10);
      expect(rolesFor(RUNG_PROTOCOLS[r.id], DAVE)).toContain(r.attackRole);
    }
  });

  it('user-facing copy says "level", never "rung"', () => {
    for (const r of RUNGS) {
      for (const field of ['title', 'story', 'protocol', 'attack', 'outcome', 'lesson'] as const) expect(r[field]).not.toMatch(/\brung\b/i);
    }
  });
});
