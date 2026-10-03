import { describe, expect, it } from 'vitest';
import { panelDiff } from './panelDiff';
import type { Fact } from './panelFacts';

const f = (label: string, value: string): Fact => ({ label, value, kind: 'public' });

describe('panelDiff', () => {
  it('flags facts that appeared or changed, not ones that stayed', () => {
    const prev = [f('My number', '14'), f('Revealed to me', 'Ana: 16')];
    const next = [f('My number', '14'), f('Revealed to me', 'Ana: 16 · Ben: 3'), f('Total', '33 → wraps to #9')];
    const d = panelDiff(prev, next, 'waiting', 'waiting');
    expect([...d.changed].sort()).toEqual(['Revealed to me', 'Total']);
    expect(d.noteChanged).toBe(false);
  });

  it('treats a missing previous step as everything new, and notices note changes', () => {
    const d = panelDiff(undefined, [f('My number', '14')], undefined, 'knows nothing yet');
    expect([...d.changed]).toEqual(['My number']);
    expect(d.noteChanged).toBe(true);
    expect(panelDiff([], [], 'a', undefined).noteChanged).toBe(true);
    expect(panelDiff([], [], undefined, undefined).noteChanged).toBe(false);
  });

  it('a fact that disappeared is not flagged (nothing to highlight)', () => {
    const d = panelDiff([f('Total', '9')], [], undefined, undefined);
    expect(d.changed.size).toBe(0);
  });
});
