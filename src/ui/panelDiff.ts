/** What changed on a roommate's card between two steps (PRD R6: highlight the last step). */
import type { Fact } from './panelFacts';

export interface PanelDiff {
  /** Labels of facts whose value changed or that appeared. */
  changed: ReadonlySet<string>;
  /** Did the note change (including appearing or disappearing)? */
  noteChanged: boolean;
}

export function panelDiff(prev: readonly Fact[] | undefined, next: readonly Fact[], prevNote?: string, nextNote?: string): PanelDiff {
  const changed = new Set<string>();
  const before = new Map<string, string>();
  for (const f of prev ?? []) before.set(f.label, f.value);
  for (const f of next) {
    const was = before.get(f.label);
    if (was === undefined || was !== f.value) changed.add(f.label);
  }
  return { changed, noteChanged: (prevNote ?? '') !== (nextNote ?? '') };
}
