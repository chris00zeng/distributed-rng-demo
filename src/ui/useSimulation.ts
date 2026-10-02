import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scenario } from '../protocol/types';
import { simulate, type Tally } from '../sim/simulate';

export const ROUNDS = 1000;

/** Runs the 1,000-round simulation for a scenario, streaming partial tallies. */
export function useSimulation(scenario: Scenario) {
  const [tally, setTally] = useState<Tally | null>(null);
  const [running, setRunning] = useState(false);
  const controller = useRef<AbortController | null>(null);

  // A new scenario invalidates the previous result.
  useEffect(() => {
    controller.current?.abort();
    setTally(null);
    setRunning(false);
  }, [scenario]);

  const run = useCallback(async () => {
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setRunning(true);
    setTally(null);
    const final = await simulate(scenario, ROUNDS, (t) => { if (!ac.signal.aborted) setTally({ ...t }); }, 25, ac.signal);
    if (!ac.signal.aborted) {
      setTally({ ...final });
      setRunning(false);
    }
  }, [scenario]);

  return { tally, running, run };
}
