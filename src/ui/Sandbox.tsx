/**
 * The Sandbox (PRD R23): four one-click experiments the ladder raises but never
 * answers, then free-form controls: the level as the protocol, a role for each
 * roommate, an optional dead phone, and t. Reuses the ladder's round, panels,
 * timeline, chart and arrangement grid; every roommate's moves are playable here.
 */
import { useEffect, useMemo, useState } from 'react';
import { ROLE_LABELS, RUNGS } from '../content/rungs';
import { ROOM_INFO } from '../content/rooms';
import { EXPERIMENTS, type Experiment } from '../protocol/experiments';
import { rolesFor } from '../protocol/parties';
import { DEFAULT_SEED, RUNG_PROTOCOLS, T_RANGE } from '../protocol/scenario';
import { DAVE, PARTY_IDS, PARTY_NAMES, type Event, type PartyId, type Role, type Rung, type Scenario } from '../protocol/types';
import { share } from '../sim/simulate';
import { ArrangementGrid } from './ArrangementGrid';
import { FairnessChart } from './Chart';
import { Panels } from './Panels';
import { StepControls } from './StepControls';
import { Timeline, buildRows } from './Timeline';
import { useRound } from './useRound';
import { ROUNDS, useSimulation } from './useSimulation';
import { RoomName, cap, withRoomNames } from './RoomName';

type View = 'step' | 'sim';

interface Draft {
  level: Rung;
  roles: Record<PartyId, Role>;
  dropout: PartyId | 'none';
  t: number;
  seed: string;
}

const ALL_HONEST: Record<PartyId, Role> = { 0: 'honest', 1: 'honest', 2: 'honest', 3: 'honest' };

function levelOf(s: Scenario): Rung {
  const p = s.protocol;
  if (p.kind === 'trusted') return 0;
  if (p.kind === 'announce') return 1;
  if (p.kind === 'commitReveal') return 2;
  return p.verify ? 5 : 3;
}

function toDraft(s: Scenario): Draft {
  return {
    level: levelOf(s),
    roles: { ...s.roles },
    dropout: s.dropout ?? 'none',
    t: s.protocol.kind === 'shared' ? s.protocol.t : 2,
    seed: s.seed,
  };
}

function toScenario(d: Draft): Scenario {
  let protocol = RUNG_PROTOCOLS[d.level];
  if (protocol.kind === 'shared') protocol = { ...protocol, t: d.t };
  const roles = { ...d.roles };
  for (const p of PARTY_IDS) if (!rolesFor(protocol, p).includes(roles[p])) roles[p] = 'honest';
  const s: Scenario = { protocol, roles, seed: d.seed || DEFAULT_SEED };
  if (d.dropout !== 'none') s.dropout = d.dropout;
  return s;
}

export function Sandbox() {
  const [draft, setDraft] = useState<Draft>(() => toDraft(EXPERIMENTS[0]!.scenario));
  const [picked, setPicked] = useState<Experiment | null>(EXPERIMENTS[0]!);
  const [view, setView] = useState<View>('sim');
  const scenario = useMemo(() => toScenario(draft), [draft]);
  const { tally, running, run } = useSimulation(scenario);
  const round = useRound(scenario);
  const rows = useMemo(() => buildRows(round.log.events), [round.log]);
  const currentRow = rows.find((r) => r.first <= round.step && round.step <= r.last);
  const broadcast = (currentRow?.recipients?.length ?? 0) > 1;
  const outcomeStep = useMemo(() => round.log.events.findIndex((e) => e.kind === 'outcome'), [round.log]);
  const shownArrangement = outcomeStep >= 0 && round.step >= outcomeStep ? (round.result.arrangement ?? null) : null;
  const currentDecision = round.event.kind === 'decision' ? (round.event as Extract<Event, { kind: 'decision' }>) : undefined;
  const deviated = useMemo(() => {
    const set = new Set<PartyId>();
    for (let i = 0; i <= round.step; i++) {
      const e = round.log.events[i]!;
      if (e.kind === 'start') set.clear();
      if (e.kind === 'decision' && e.deviates) set.add(e.by);
    }
    return set;
  }, [round.log, round.step]);

  useEffect(() => {
    if (view === 'sim' && tally === null && !running) void run();
  }, [view, tally, running, run]);

  const update = (patch: Partial<Draft>) => { setPicked(null); setDraft((d) => ({ ...d, ...patch })); };
  const pick = (e: Experiment) => { setPicked(e); setDraft(toDraft(e.scenario)); setView('sim'); };

  const protocol = scenario.protocol;
  const best = <RoomName room="master" />;
  const done = tally ? tally.rounds - tally.stuck : 0;
  const levelCopy = RUNGS[draft.level]!;

  return (
    <section className="sandbox" aria-label="Sandbox">
      <h2 className="sandbox__title">Sandbox: try to break it yourself</h2>
      <p className="sandbox__lead">
        Four questions the levels raise but never answer, then the controls to ask your own. Everything here is measured by running the real protocol; nothing is scripted.
      </p>

      <div className="experiments">
        {EXPERIMENTS.map((e) => (
          <article key={e.id} className={`experiment${picked?.id === e.id ? ' experiment--on' : ''}`}>
            <h3>{e.title}</h3>
            <p className="experiment__q">{e.question}</p>
            <button type="button" className="run" onClick={() => pick(e)}>Run it</button>
            {picked?.id === e.id ? <p className="experiment__expect"><strong>Expect:</strong> {e.expect}</p> : null}
          </article>
        ))}
      </div>

      <div className="sandbox__controls">
        <label className="control">
          <span>Protocol (the level)</span>
          <select value={draft.level} onChange={(ev) => update({ level: Number(ev.target.value) as Rung })}>
            {RUNGS.filter((r) => r.available && r.id !== 4 && r.id !== 6).map((r) => (
              <option key={r.id} value={r.id}>Level {r.id}: {r.title}</option>
            ))}
          </select>
        </label>
        {PARTY_IDS.map((p) => (
          <label key={p} className="control control--role">
            <span>{PARTY_NAMES[p]}</span>
            <select value={draft.roles[p]} onChange={(ev) => update({ roles: { ...draft.roles, [p]: ev.target.value as Role } })}>
              {rolesFor(protocol, p).map((role) => (
                <option key={role} value={role}>{role === 'manual' ? `You play ${PARTY_NAMES[p]}` : cap(ROLE_LABELS[role])}</option>
              ))}
            </select>
          </label>
        ))}
        <label className="control">
          <span>Dead phone</span>
          <select value={draft.dropout} onChange={(ev) => update({ dropout: ev.target.value === 'none' ? 'none' : (Number(ev.target.value) as PartyId) })}>
            <option value="none">nobody</option>
            {PARTY_IDS.map((p) => <option key={p} value={p}>{PARTY_NAMES[p]} (dies after dealing)</option>)}
          </select>
        </label>
        {protocol.kind === 'shared' ? (
          <label className="control control--t">
            <span>t: shares needed to rebuild a number ({draft.t})</span>
            <input type="range" min={T_RANGE.min} max={T_RANGE.max} step={1} value={draft.t} onChange={(ev) => update({ t: Number(ev.target.value) })} />
          </label>
        ) : null}
        <label className="control">
          <span>Seed</span>
          <input value={draft.seed} onChange={(ev) => update({ seed: ev.target.value })} spellCheck={false} />
        </label>
        <button type="button" className="rerun" onClick={() => update({ roles: { ...ALL_HONEST } , dropout: 'none' })}>Everyone honest</button>
        <div className="segmented" role="tablist" aria-label="View">
          <button type="button" role="tab" aria-selected={view === 'step'} className={view === 'step' ? 'is-on' : ''} onClick={() => setView('step')}>Step through one round</button>
          <button type="button" role="tab" aria-selected={view === 'sim'} className={view === 'sim' ? 'is-on' : ''} onClick={() => setView('sim')}>Run {ROUNDS.toLocaleString()} rounds</button>
        </div>
      </div>

      <p className="sandbox__protocol"><strong>Level {levelCopy.id}, {levelCopy.title}.</strong> {levelCopy.protocol}</p>

      {view === 'step' ? (
        <div className="view view--step">
          <div className="workspace">
            <div className="col col--panels">
              <h2 className="col__title">What each roommate knows</h2>
              <StepControls step={round.step} last={round.last} event={round.event} broadcast={broadcast} onPrev={round.prev} onNext={round.next} onNextPhase={round.nextPhase} onReset={round.reset} onEnd={round.end} />
              {Object.keys(round.overrides).length ? (
                <p className="overrides">You are playing the roommates' moves. <button type="button" className="rerun" onClick={round.clearOverrides}>Reset to their usual play</button></p>
              ) : null}
              <Panels views={round.views} roles={scenario.roles} decision={currentDecision} deviated={deviated} onOverride={round.override} playable={PARTY_IDS} />
            </div>
            <div className="col col--timeline">
              <h2 className="col__title">Messages</h2>
              <Timeline events={round.log.events} step={round.step} onSelect={round.setStep} />
            </div>
          </div>
          <ArrangementGrid highlight={shownArrangement} caption={shownArrangement === null ? 'Step to the end of the round to see where it lands.' : withRoomNames(`This round landed on arrangement #${shownArrangement}: ${PARTY_NAMES[DAVE]} gets ${ROOM_INFO[round.result.assignment![DAVE]].label}.`)} />
        </div>
      ) : (
        <div className="view view--sim">
          {PARTY_IDS.some((p) => scenario.roles[p] === 'manual') ? (
            <p className="sandbox__lead">Roommates you play act honestly over 1,000 rounds; your moves apply to the single round.</p>
          ) : null}
          <p className="headline" aria-live="polite">
            {tally === null ? (
              <>Measuring…</>
            ) : tally.stuck === tally.rounds ? (
              <>Every round got stuck. Nobody gets a room.</>
            ) : (
              <>
                {PARTY_IDS.map((p, i) => (
                  <span key={p} className="sandbox__stat">{i ? ' · ' : ''}{PARTY_NAMES[p]} <strong>{(share(tally, p, 'master') * 100).toFixed(0)}%</strong></span>
                ))}
                {' '}for {best}{tally.stuck ? <>, with <strong>{tally.stuck.toLocaleString()}</strong> of {tally.rounds.toLocaleString()} rounds stuck</> : null}
                {tally.attempts > tally.rounds && done > 0 ? <>, <strong>{(tally.attempts / tally.rounds).toFixed(1)}</strong> tries per round</> : null}.
              </>
            )}{' '}
            <button type="button" className="rerun" onClick={() => void run()} disabled={running}>{running ? 'Running…' : 'Run again'}</button>
          </p>
          <div className="workspace workspace--sim">
            <div className="col">
              <h2 className="col__title">Who gets which room</h2>
              <FairnessChart tally={tally} total={ROUNDS} />
            </div>
            <div className="col">
              <h2 className="col__title">Which arrangements came up</h2>
              <ArrangementGrid weights={tally?.arrangementCounts} caption="Fair play lights all 24 evenly." />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
