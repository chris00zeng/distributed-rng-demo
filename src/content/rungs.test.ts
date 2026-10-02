import { describe, expect, it } from 'vitest';
import { RUNGS } from './rungs';

describe('ladder copy', () => {
  it('has seven rungs numbered 0 to 6 in order', () => {
    expect(RUNGS.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
