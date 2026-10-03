import { useCallback, useEffect, useRef, useState } from 'react';

export const SPEEDS = [
  { label: '0.5 s', ms: 500 },
  { label: '1 s', ms: 1000 },
  { label: '2 s', ms: 2000 },
] as const;

interface Options {
  step: number;
  last: number;
  next(): void;
  /** True when the current step is one the user should decide on (auto-play pauses before moving on). */
  holdHere: boolean;
  /** Reset playback when this changes (e.g. the scenario). */
  resetKey: unknown;
}

/**
 * Auto-play for the step-through (PRD R7): advances one step every `ms`,
 * pauses by itself at a decision the user may override, and stops at the end.
 * Space toggles play when focus is not in a form control. Foreground use only;
 * background tabs throttle timers, which is fine for a thing you watch.
 */
export function useAutoplay({ step, last, next, holdHere, resetKey }: Options) {
  const [playing, setPlaying] = useState(false);
  const [ms, setMs] = useState<number>(SPEEDS[1].ms);
  const heldAt = useRef<number | null>(null);

  // A new round stops playback.
  useEffect(() => { setPlaying(false); heldAt.current = null; }, [resetKey]);

  // Stop at the end; pause at a decision point (once per visit, so "play" resumes past it).
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    if (holdHere && heldAt.current !== step) { heldAt.current = step; setPlaying(false); }
  }, [playing, step, last, holdHere]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(next, ms);
    return () => clearInterval(id);
  }, [playing, ms, next]);

  const toggle = useCallback(() => {
    setPlaying((p) => (!p && step >= last ? false : !p));
  }, [step, last]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
      if (ev.key === ' ') { ev.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  return { playing, toggle, ms, setMs };
}
