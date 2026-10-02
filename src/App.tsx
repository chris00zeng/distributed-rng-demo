import { useMemo, useState } from 'react';
import { ROLE_LABELS, RUNGS } from './content/rungs';
import { rolesFor } from './protocol/parties';
import { DEFAULT_SEED, rungScenario } from './protocol/scenario';
import { DAVE, PARTY_NAMES, type Role, type Rung } from './protocol/types';
import { share } from './sim/simulate';
import { FairnessChart } from './ui/Chart';
import { ROUNDS, useSimulation } from './ui/useSimulation';

export function App() {
  const [rungId, setRungId] = useState<Rung>(0);
  const [daveRole, setDaveRole] = useState<Role>('honest');
  const [seed, setSeed] = useState(DEFAULT_SEED);

  const rung = RUNGS[rungId]!;
  const scenario = useMemo(() => rungScenario(rungId, daveRole, seed), [rungId, daveRole, seed]);
  const roles = rolesFor(scenario.protocol, DAVE);
  const { tally, running, run } = useSimulation(scenario);

  const selectRung = (id: Rung) => {
    setRungId(id);
    setDaveRole('honest');
  };

  const daveMaster = tally && tally.rounds - tally.stuck > 0 ? share(tally, DAVE, 'master') : null;

  return (
    <main className="app">
      <header className="masthead">
        <h1>Fair Rooms</h1>
        <p className="tagline">
          Four roommates. Four unequal rooms. One of them cheats. How do you roll the dice when
          nobody trusts anybody?
        </p>
      </header>

      <nav className="ladder" aria-label="Attack ladder">
        {RUNGS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`rung${r.id === rungId ? ' rung--active' : ''}${r.available ? '' : ' rung--locked'}`}
            title={r.available ? r.title : `${r.title} (coming soon)`}
            disabled={!r.available}
            aria-current={r.id === rungId ? 'step' : undefined}
            onClick={() => selectRung(r.id)}
          >
            {r.id}
          </button>
        ))}
      </nav>

      <section className="rung-copy">
        <h2>
          <span className="rung-copy__id">Rung {rung.id}</span> {rung.title}
        </h2>
        <dl>
          <dt>Protocol</dt><dd>{rung.protocol}</dd>
          <dt>Attack</dt><dd>{rung.attack}</dd>
          <dt>Outcome</dt><dd>{rung.outcome}</dd>
          <dt>Lesson</dt><dd className="rung-copy__lesson">{rung.lesson}</dd>
        </dl>
      </section>

      <section className="controls">
        <label className="control">
          <span>{PARTY_NAMES[DAVE]}</span>
          <select value={daveRole} onChange={(e) => setDaveRole(e.target.value as Role)}>
            {roles.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
        </label>
        <label className="control">
          <span>Seed</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} />
        </label>
        <button type="button" className="run" onClick={() => void run()} disabled={running}>
          {running ? 'Running…' : `Run ${ROUNDS.toLocaleString()} rounds`}
        </button>
      </section>

      <section className="results">
        <p className="headline" aria-live="polite">
          {daveMaster === null ? (
            <>Press <strong>Run</strong> to measure how often Dave gets the master bedroom.</>
          ) : (
            <>
              Dave gets the master bedroom <strong>{(daveMaster * 100).toFixed(1)}%</strong> of the time.
              Fair would be <strong>25%</strong>.
              {tally && tally.attempts > tally.rounds ? (
                <> It took him <strong>{(tally.attempts / tally.rounds).toFixed(1)}</strong> tries per round.</>
              ) : null}
            </>
          )}
        </p>
        <FairnessChart tally={tally} total={ROUNDS} />
      </section>
    </main>
  );
}
