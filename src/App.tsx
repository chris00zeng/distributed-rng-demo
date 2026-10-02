import { useMemo, useState } from 'react';
import { ROLE_LABELS, RUNGS } from './content/rungs';
import { rolesFor } from './protocol/parties';
import { DEFAULT_SEED, rungScenario } from './protocol/scenario';
import { DAVE, PARTY_NAMES, type Role, type Rung } from './protocol/types';
import { share } from './sim/simulate';
import { FairnessChart } from './ui/Chart';
import { Panels } from './ui/Panels';
import { StepControls } from './ui/StepControls';
import { Timeline, buildRows } from './ui/Timeline';
import { useRound } from './ui/useRound';
import { ROUNDS, useSimulation } from './ui/useSimulation';
import { useUrlState } from './ui/useUrlState';

export function App() {
  // Rung, roles and seed live in the query string so any run is a shareable link (R13).
  const [urlState, setUrlState] = useUrlState();
  const rungId = urlState.rung;
  const daveRole = urlState.roles[DAVE];
  const seed = urlState.seed;
  const setDaveRole = (role: Role) => setUrlState((s) => ({ ...s, roles: { ...s.roles, [DAVE]: role } }));
  const setSeed = (next: string) => setUrlState({ seed: next || DEFAULT_SEED });
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the address bar still has the link */
    }
  };

  const rung = RUNGS[rungId]!;
  const scenario = useMemo(() => rungScenario(rungId, daveRole, seed), [rungId, daveRole, seed]);
  const roles = rolesFor(scenario.protocol, DAVE);
  const { tally, running, run } = useSimulation(scenario);
  const round = useRound(scenario);
  const rows = useMemo(() => buildRows(round.log.events), [round.log]);
  const currentRow = rows.find((r) => r.first <= round.step && round.step <= r.last);
  const broadcast = (currentRow?.recipients?.length ?? 0) > 1;

  const selectRung = (id: Rung) => {
    setUrlState((s) => ({ ...s, rung: id, roles: { ...s.roles, [DAVE]: 'honest' } }));
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
        <button type="button" className="copy-link" onClick={() => void copyLink()} title="Copy a link that reproduces this exact run">
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <button type="button" className="run" onClick={() => void run()} disabled={running}>
          {running ? 'Running…' : `Run ${ROUNDS.toLocaleString()} rounds`}
        </button>
      </section>

      <div className="workspace">
        <section className="col col--panels" aria-label="What each roommate knows">
          <h2 className="col__title">One round, step by step</h2>
          <StepControls
            step={round.step}
            last={round.last}
            event={round.event}
            broadcast={broadcast}
            onPrev={round.prev}
            onNext={round.next}
            onNextPhase={round.nextPhase}
            onReset={round.reset}
            onEnd={round.end}
          />
          <Panels views={round.views} roles={scenario.roles} />
        </section>

        <section className="col col--timeline" aria-label="Messages">
          <h2 className="col__title">Messages</h2>
          <Timeline events={round.log.events} step={round.step} onSelect={round.setStep} />
        </section>

        <section className="col col--results" aria-label="Fairness over many rounds">
          <h2 className="col__title">{ROUNDS.toLocaleString()} rounds</h2>
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
      </div>
    </main>
  );
}
