/**
 * Runs one round (Technical Plan: driver). Starts the parties, pumps the bus
 * one envelope at a time, handles aborts per protocol, and produces a
 * RoundLog (for the timeline and panels) and a RoundResult (for the tally).
 *
 * Invariant when recording: `views[i]` is every party's view *after* `events[i]`.
 */
import { deriveSeed, makePrng } from '../crypto/prng';
import { indexOfArrangement, type Room } from '../crypto/arrangements';
import { PARTY_IDS as IDS } from './types';
import { Bus } from './bus';
import { createParty } from './parties';
import { hasOption, policyFor } from './policies';
import {
  PARTY_IDS, type Ctx, type Event, type Party, type PartyId, type PartyView, type Phase,
  type RoundLog, type RoundResult, type Scenario,
} from './types';

export const MAX_ATTEMPTS = 64;
const PHASE_ORDER: Phase[] = ['announce', 'commit', 'deal', 'reveal', 'reconstruct', 'done'];

export interface RunOptions {
  /** Snapshot every party's view after every event (needed by the UI, costly in bulk). */
  record?: boolean;
  /** Replace the policy's choice at decision ordinal `index` with an option id (UI "make Dave's move"). */
  overrides?: Readonly<Record<number, string>>;
}

/** Does an abort restart the whole round under this protocol? */
function abortRestarts(scenario: Scenario): boolean {
  return scenario.protocol.kind !== 'shared';
}

export function runRound(scenario: Scenario, opts: RunOptions = {}): { log: RoundLog; result: RoundResult } {
  const record = opts.record ?? false;
  const events: Event[] = [];
  const views: PartyView[][] = [];
  const log: RoundLog = { scenario, events, views };
  const decisions = { next: 0, overrides: opts.overrides ?? {} };

  const terminal = (e: Event, final: PartyView[]) => {
    events.push(e);
    if (record) views.push(final);
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { outcome, final } = runAttempt(scenario, attempt, events, views, record, decisions);
    if (outcome.kind === 'assigned') {
      terminal({ kind: 'outcome', assignment: outcome.assignment }, final);
      const k = indexOfArrangement(IDS.map((p) => outcome.assignment[p]));
      return { log, result: { outcome: 'assigned', assignment: outcome.assignment, arrangement: k, attempts: attempt } };
    }
    if (outcome.kind === 'stuck') {
      terminal({ kind: 'stuck', reason: outcome.reason }, final);
      return { log, result: { outcome: 'stuck', attempts: attempt, reason: outcome.reason } };
    }
    if (attempt === MAX_ATTEMPTS) {
      const reason = `no outcome after ${MAX_ATTEMPTS} attempts`;
      terminal({ kind: 'stuck', reason }, final);
      return { log, result: { outcome: 'stuck', attempts: attempt, reason } };
    }
  }
  throw new Error('unreachable');
}

type AttemptOutcome =
  | { kind: 'assigned'; assignment: Record<PartyId, Room> }
  | { kind: 'restart' }
  | { kind: 'stuck'; reason: string };

interface DecisionState { next: number; overrides: Readonly<Record<number, string>> }

function runAttempt(
  scenario: Scenario, attempt: number, events: Event[], views: PartyView[][], record: boolean, decisions: DecisionState,
): { outcome: AttemptOutcome; final: PartyView[] } {
  const rng = makePrng(deriveSeed(scenario.seed, `attempt-${attempt}`));
  const bus = new Bus(rng);
  const parties = PARTY_IDS.map((id) => createParty(scenario, id)) as Party[];
  let aborted: { by: PartyId; cause: 'abort' | 'dropout' } | null = null;
  // Boxed so closures can set it without TypeScript narrowing it to `never` in the loop.
  const voided: { current: { by: PartyId; reason: string } | null } = { current: null };
  let globalPhase: Phase | null = null;

  const current = () => parties.map((p) => p.view());
  const emit = (e: Event) => {
    events.push(e);
    if (record) views.push(current());
  };
  /** Decisions raised inside a handler are logged right after the event that triggered them. */
  const pendingDecisions: Event[] = [];
  const flush = () => { while (pendingDecisions.length) emit(pendingDecisions.shift()!); };
  /** Global phase = the least advanced live party. Emits a phase event on change. */
  const checkPhase = () => {
    let min = PHASE_ORDER.length - 1;
    for (const p of parties) {
      if (bus.isDropped(p.id)) continue;
      min = Math.min(min, PHASE_ORDER.indexOf(p.phase()));
    }
    const phase = PHASE_ORDER[min]!;
    if (phase !== globalPhase) {
      globalPhase = phase;
      emit({ kind: 'phase', phase });
    }
  };

  const ctxs = PARTY_IDS.map((id): Ctx => ({
    id,
    n: PARTY_IDS.length,
    rng,
    scenario,
    send: (to, msg) => bus.send(id, to, msg),
    decide: (point) => {
      if (point.options.length < 2) return point.options[0]?.id ?? '';
      const index = decisions.next++;
      const override = decisions.overrides[index];
      const chosen = override !== undefined && hasOption(point, override) ? override : policyFor(scenario.roles[id])(point, id);
      const opt = point.options.find((o) => o.id === chosen) ?? point.options.find((o) => o.honest)!;
      pendingDecisions.push({ kind: 'decision', by: id, index, point, chosen: opt.id, deviates: !opt.honest });
      return opt.id;
    },
    abort: () => { if (aborted === null) aborted = { by: id, cause: 'abort' }; },
    dropout: () => { if (aborted === null) aborted = { by: id, cause: 'dropout' }; },
    void: (reason) => { if (voided.current === null) voided.current = { by: id, reason }; },
  }));

  for (const p of parties) p.onStart(ctxs[p.id]!);
  emit({ kind: 'start', attempt });
  flush();
  checkPhase();

  const finish = (outcome: AttemptOutcome) => ({ outcome, final: current() });

  for (;;) {
    if (voided.current !== null) {
      emit({ kind: 'void', by: voided.current.by, reason: voided.current.reason });
      return finish({ kind: 'restart' });
    }
    if (aborted !== null) {
      const { by, cause } = aborted;
      const restart = abortRestarts(scenario);
      emit({ kind: 'abort', by, restart, cause });
      if (restart) return finish({ kind: 'restart' });
      bus.drop(by);
      emit({ kind: 'drop', party: by });
      aborted = null;
      checkPhase();
      continue;
    }
    const env = bus.deliverNext();
    if (env) {
      parties[env.to]!.onMessage(env, ctxs[env.to]!);
      emit({ kind: 'deliver', env });
      flush();
      checkPhase();
      continue;
    }
    const done = consensus(parties, bus);
    if (done) return finish(done);
    // Idle: give parties a chance to act on "waited long enough", in bus order.
    let acted = false;
    for (const id of bus.order()) {
      const p = parties[id]!;
      if (!bus.isDropped(id) && p.onIdle?.(ctxs[id]!)) { acted = true; break; }
    }
    flush();
    checkPhase();
    if (!acted) return finish({ kind: 'stuck', reason: 'everyone is waiting for someone else' });
  }
}

/** Assigned iff every non-dropped party has an assignment and they all agree. */
function consensus(parties: Party[], bus: Bus): AttemptOutcome | null {
  let ref: Record<PartyId, Room> | undefined;
  for (const p of parties) {
    if (bus.isDropped(p.id)) continue;
    const a = p.assignment();
    if (!a) return null;
    if (!ref) ref = a;
    else for (const id of PARTY_IDS) if (ref[id] !== a[id]) return { kind: 'stuck', reason: 'roommates disagree on the outcome' };
  }
  return ref ? { kind: 'assigned', assignment: ref } : null;
}
