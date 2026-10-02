import { useCallback, useEffect, useMemo, useState } from 'react';
import { runRound } from '../protocol/driver';
import type { Scenario } from '../protocol/types';

/** One recorded round for the current scenario plus a cursor into its events. */
export function useRound(scenario: Scenario) {
  const { log, result } = useMemo(() => runRound(scenario, { record: true }), [scenario]);
  const last = log.events.length - 1;
  const [step, setStepRaw] = useState(0);

  useEffect(() => { setStepRaw(0); }, [scenario]);

  const setStep = useCallback((i: number) => setStepRaw(Math.max(0, Math.min(last, i))), [last]);
  const next = useCallback(() => setStepRaw((s) => Math.min(last, s + 1)), [last]);
  const prev = useCallback(() => setStepRaw((s) => Math.max(0, s - 1)), []);
  const reset = useCallback(() => setStepRaw(0), []);
  const end = useCallback(() => setStepRaw(last), [last]);
  const nextPhase = useCallback(() => {
    setStepRaw((s) => {
      for (let i = s + 1; i <= last; i++) {
        const e = log.events[i]!;
        if (e.kind === 'phase' || e.kind === 'abort' || e.kind === 'outcome' || e.kind === 'stuck' || e.kind === 'start') return i;
      }
      return last;
    });
  }, [log, last]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); next(); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  const clamped = Math.min(step, last);
  return {
    log,
    result,
    step: clamped,
    last,
    event: log.events[clamped]!,
    views: log.views[clamped]!,
    setStep, next, prev, reset, end, nextPhase,
  };
}
