import { useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, RUNGS } from './content/rungs';
import { ROOM_INFO } from './content/rooms';
import { rolesFor } from './protocol/parties';
import { DEFAULT_SEED, T_RANGE, rungRoles, rungScenario } from './protocol/scenario';
import { ThresholdChart } from './ui/ThresholdChart';
import { maxTolerated } from './content/threshold';
import { DAVE, PARTY_NAMES, type Event, type PartyId, type Role, type Rung } from './protocol/types';
import { share } from './sim/simulate';
import { ArrangementGrid } from './ui/ArrangementGrid';
import { FairnessChart } from './ui/Chart';
import { Intro } from './ui/Intro';
import { MathToggle, useMathToggle } from './ui/MathToggle';
import { mathMode } from './ui/mathMode';
import { PolynomialVisual } from './ui/PolynomialVisual';
import { Panels } from './ui/Panels';
import { StepControls } from './ui/StepControls';
import { Timeline, buildRows } from './ui/Timeline';
import { useRound } from './ui/useRound';
import { ROUNDS, useSimulation } from './ui/useSimulation';
import { useUrlState } from './ui/useUrlState';

type View = 'step' | 'sim';

function regimeAt(t: number, f: number): string {
  // Local import avoided at module top to keep the threshold module optional for rungs 0 to 5.
  const secret = t >= f + 1;
  const live = 4 - f >= t;
  return secret && live ? 'safe' : 'other';
}

export function App() {
  // Rung, roles and seed live in the query string so any run is a shareable link (R13).
  const [urlState, setUrlState] = useUrlState();
  const rungId = urlState.rung;
  const daveRole = urlState.roles[DAVE];
  const seed = urlState.seed;
  const setDaveRole = (role: Role) => setUrlState((s) => ({ ...s, roles: { ...s.roles, [DAVE]: role } }));
  const setSeed = (next: string) => setUrlState({ seed: next || DEFAULT_SEED });
  const t = rungId === 6 ? Math.min(T_RANGE.max, Math.max(T_RANGE.min, urlState.t ?? 2)) : undefined;
  const setT = (next: number) => setUrlState((s) => ({ ...s, t: next }));
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

  const [view, setView] = useState<View>('step');
  const [showMath, setShowMath] = useMathToggle();
  mathMode.set(showMath);
  const rung = RUNGS[rungId]!;
  const scenario = useMemo(() => rungScenario(rungId, daveRole, seed, t), [rungId, daveRole, seed, t]);
  const roles = rungRoles(rungId, rolesFor(scenario.protocol, DAVE));
  const { tally, running, run } = useSimulation(scenario);
  const round = useRound(scenario);
  const rows = useMemo(() => buildRows(round.log.events), [round.log]);
  const currentRow = rows.find((r) => r.first <= round.step && round.step <= r.last);
  const broadcast = (currentRow?.recipients?.length ?? 0) > 1;
  const outcomeStep = useMemo(() => round.log.events.findIndex((e) => e.kind === 'outcome'), [round.log]);
  const currentDecision = round.event.kind === 'decision' ? (round.event as Extract<Event, { kind: 'decision' }>) : undefined;
  // Who has left the honest path in the current attempt, as of this step (R27 highlighting).
  const deviated = useMemo(() => {
    const set = new Set<PartyId>();
    for (let i = 0; i <= round.step; i++) {
      const e = round.log.events[i]!;
      if (e.kind === 'start') set.clear();
      if (e.kind === 'decision' && e.deviates) set.add(e.by);
    }
    return set;
  }, [round.log, round.step]);
  const hasOverrides = Object.keys(round.overrides).length > 0;
  const shownArrangement = outcomeStep >= 0 && round.step >= outcomeStep ? (round.result.arrangement ?? null) : null;

  // Entering the simulation view with no result yet starts the run (R26).
  useEffect(() => {
    if (view === 'sim' && tally === null && !running) void run();
  }, [view, tally, running, run]);

  const selectRung = (id: Rung) => {
    setUrlState((s) => ({ ...s, rung: id, roles: { ...s.roles, [DAVE]: 'honest' } }));
  };

  const best = ROOM_INFO.master.label;
  const daveBest = tally && tally.rounds - tally.stuck > 0 ? share(tally, DAVE, 'master') : null;
  const allStuck = tally !== null && tally.rounds > 0 && tally.stuck === tally.rounds;

  return (
    <main className={`app ${showMath ? 'math-on' : 'math-off'}`}>
      <header className="masthead">
        <h1>Fair Rooms</h1>
        <p className="tagline">
          Four roommates. Four unequal rooms. One of them cheats. How do you roll the dice when
          nobody trusts anybody?
        </p>
      </header>

      <Intro />

      <nav className="ladder" aria-label="Levels">
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
          <span className="rung-copy__id">Level {rung.id}</span> {rung.title}
        </h2>
        <p className="rung-copy__story">{rung.story}</p>
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
        {t !== undefined ? (
          <label className="control control--t">
            <span>t: shares needed to rebuild a number ({t})</span>
            <input type="range" min={T_RANGE.min} max={T_RANGE.max} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
          </label>
        ) : null}
        <button type="button" className="copy-link" onClick={() => void copyLink()} title="Copy a link that reproduces this exact run">
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <MathToggle on={showMath} onChange={setShowMath} />
        <div className="segmented" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'step'} className={view === 'step' ? 'is-on' : ''} onClick={() => setView('step')}>
            Step through one round
          </button>
          <button type="button" role="tab" aria-selected={view === 'sim'} className={view === 'sim' ? 'is-on' : ''} onClick={() => setView('sim')}>
            Run {ROUNDS.toLocaleString()} rounds
          </button>
        </div>
      </section>

      {t !== undefined ? (
        <section className="threshold" aria-label="The threshold limit">
          <h2 className="col__title">Which t is safe against how many cheaters?</h2>
          <p className="threshold__text">
            With four roommates, t = {t} tolerates <strong>{[0, 1, 2, 3].filter((f) => ['safe'].includes(regimeAt(t, f))).length - 1}</strong> cheater{[0, 1, 2, 3].filter((f) => ['safe'].includes(regimeAt(t, f))).length - 1 === 1 ? '' : 's'}.
            No choice of t survives two: the most four people can ever tolerate is <strong>{maxTolerated(4)}</strong>, because n ≥ 2f + 1.
            Set t to 4 and make Dave quit to watch liveness fail live.
          </p>
          <ThresholdChart n={4} t={t} onChangeT={setT} />
        </section>
      ) : null}

      {view === 'step' ? (
        <section className="view view--step" aria-label="One round, step by step">
          <div className="workspace">
            <div className="col col--panels">
              <h2 className="col__title">What each roommate knows</h2>
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
              {hasOverrides ? (
                <p className="overrides">
                  You are playing {PARTY_NAMES[DAVE]}'s moves.{' '}
                  <button type="button" className="rerun" onClick={round.clearOverrides}>Reset to his usual play</button>
                </p>
              ) : null}
              <Panels
                views={round.views}
                roles={scenario.roles}
                decision={currentDecision}
                deviated={deviated}
                onOverride={round.override}
              />
            </div>
            <div className="col col--timeline">
              <h2 className="col__title">Messages</h2>
              <Timeline events={round.log.events} step={round.step} onSelect={round.setStep} />
            </div>
          </div>
          {scenario.protocol.kind === 'shared' ? <PolynomialVisual views={round.views} showMath={showMath} /> : null}
          <h2 className="col__title">The 24 arrangements</h2>
          <ArrangementGrid
            highlight={shownArrangement}
            caption={
              shownArrangement === null
                ? 'The picks add up to one of these 24 numbers. Step to the end of the round to see which.'
                : `This round landed on arrangement #${shownArrangement}: ${PARTY_NAMES[DAVE]} gets ${ROOM_INFO[round.result.assignment![DAVE]].label}.`
            }
          />
        </section>
      ) : (
        <section className="view view--sim" aria-label="Fairness over many rounds">
          <p className="headline" aria-live="polite">
            {allStuck ? (
              <>Every round got stuck: with t = {t ?? 2}, one missing roommate leaves too few shares to rebuild anyone. Nobody gets a room.</>
            ) : tally && tally.stuck > 0 && daveBest !== null ? (
              <>
                <strong>{tally.stuck.toLocaleString()}</strong> of {tally.rounds.toLocaleString()} rounds got stuck: too few shares to rebuild a quitter's number.
                Of the rounds that finished, Dave gets {best} <strong>{(daveBest * 100).toFixed(1)}%</strong> of the time. He wins, or nobody gets a room.
              </>
            ) : daveBest === null ? (
              <>Measuring how often Dave gets {best}…</>
            ) : (
              <>
                Dave gets {best} <strong>{(daveBest * 100).toFixed(1)}%</strong> of the time.
                Fair would be <strong>25%</strong>.
                {tally && tally.attempts > tally.rounds ? (
                  <> It took him <strong>{(tally.attempts / tally.rounds).toFixed(1)}</strong> tries per round.</>
                ) : null}
              </>
            )}
            {' '}
            <button type="button" className="rerun" onClick={() => void run()} disabled={running}>
              {running ? 'Running…' : 'Run again'}
            </button>
          </p>
          <div className="workspace workspace--sim">
            <div className="col">
              <h2 className="col__title">Who gets which room</h2>
              <FairnessChart tally={tally} total={ROUNDS} />
            </div>
            <div className="col">
              <h2 className="col__title">Which arrangements came up</h2>
              <ArrangementGrid
                weights={tally?.arrangementCounts}
                caption="Fair play lights all 24 evenly. A cheater's rounds pile onto the six where he gets the suite."
              />
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
