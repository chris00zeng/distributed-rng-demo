import { DAVE, PARTY_IDS, type Event, type PartyId, type PartyView, type Role } from '../protocol/types';
import { ROLE_LABELS } from '../content/rungs';
import { name, roomLabel } from './format';
import { panelDiff } from './panelDiff';
import { panelFacts, panelPhase } from './panelFacts';

type Decision = Extract<Event, { kind: 'decision' }>;

export interface CardProps {
  party: PartyId;
  view: PartyView;
  /** The same party's view one step earlier, for change highlighting (R6). */
  prevView?: PartyView;
  role: Role;
  /** The decision being made at the current step, if it is this party's and playable. */
  decision?: Decision;
  offPath?: boolean;
  /** The party has gone silent (dropped) at this step. */
  silent?: boolean;
  onOverride?: (index: number, option: string) => void;
  className?: string;
}

/** One roommate's card: what they know right now, with the facts that just changed flashed. */
export function RoommateCard({ party: p, view, prevView, role, decision, offPath = false, silent = false, onOverride, className }: CardProps) {
  const cheating = role !== 'honest';
  const facts = panelFacts(view, p);
  const diff = panelDiff(prevView ? panelFacts(prevView, p) : undefined, facts, prevView?.note, view.note);
  const cls = `panel${cheating ? ' panel--cheater' : ''}${offPath ? ' panel--deviating' : ''}${decision ? ' panel--deciding' : ''}${silent ? ' panel--silent' : ''}${className ? ` ${className}` : ''}`;
  return (
    <article className={cls} aria-label={`${name(p)}'s view`}>
      <header className="panel__head">
        <h3>{name(p)}</h3>
        <span className="panel__phase">{silent ? 'silent · ' : ''}{offPath ? 'off the honest path · ' : ''}{panelPhase(view)}</span>
      </header>
      {cheating ? <p className="panel__role">{name(p)} {ROLE_LABELS[role]}</p> : null}
      {decision ? <DecisionBox decision={decision} onOverride={onOverride} /> : null}
      <dl className="panel__facts">
        {facts.map((f) => (
          <div
            key={f.label}
            className={`fact fact--${f.kind}${diff.changed.has(f.label) ? ' fact--changed' : ''}`}
            data-fact={f.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}
          >
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {view.note ? <p className={`panel__note${diff.noteChanged ? ' panel__note--changed' : ''}`}>{view.note}</p> : null}
      {facts.length === 0 && !view.note ? <p className="panel__note">knows nothing yet</p> : null}
    </article>
  );
}

interface Props {
  views: PartyView[];
  prevViews?: PartyView[];
  roles: Record<PartyId, Role>;
  decision?: Decision;
  deviated?: ReadonlySet<PartyId>;
  silent?: ReadonlySet<PartyId>;
  onOverride?: (index: number, option: string) => void;
  /** Whose moves the user may play. The ladder is Dave-centric (PRD R27); the Sandbox may widen this. */
  playable?: readonly PartyId[];
}

/** The four cards in a plain grid (used where the stage does not fit). */
export function Panels({ views, prevViews, roles, decision, deviated, silent, onOverride, playable = [DAVE] }: Props) {
  return (
    <div className="panels">
      {PARTY_IDS.map((p) => (
        <RoommateCard
          key={p}
          party={p}
          view={views[p]!}
          prevView={prevViews?.[p]}
          role={roles[p]}
          decision={decision && decision.by === p && playable.includes(p) ? decision : undefined}
          offPath={deviated?.has(p) ?? false}
          silent={silent?.has(p) ?? false}
          onOverride={onOverride}
        />
      ))}
    </div>
  );
}

/** "Dave's move": the situation, the options, which one was taken, and buttons to take another (R27). */
function DecisionBox({ decision, onOverride }: { decision: Decision; onOverride?: (index: number, option: string) => void }) {
  const ctx = decision.point.context ?? {};
  const wouldGet = typeof ctx.wouldGet === 'string' ? roomLabel(ctx.wouldGet) : null;
  return (
    <div className={`decision${decision.deviates ? ' decision--deviates' : ''}`} role="group" aria-label={`${name(decision.by)}'s move`}>
      <p className="decision__prompt">
        <strong>{name(decision.by)}'s move.</strong> {decision.point.prompt}
        {wouldGet ? <>. {name(decision.by)} would get <em>{wouldGet}</em></> : null}.
        {ctx.ifQuit === 'reconstructed' ? ' If he quits, the others rebuild his number anyway.' : ''}
        {ctx.ifQuit === 'restart' ? ' If he quits, his shares will not add up and the round restarts.' : ''}
      </p>
      <div className="decision__options">
        {decision.point.options.map((o) => {
          const taken = o.id === decision.chosen;
          return (
            <button
              key={o.id}
              type="button"
              className={`decision__opt${taken ? ' is-taken' : ''}${o.honest ? ' is-honest' : ' is-cheat'}`}
              aria-pressed={taken}
              disabled={taken || !onOverride}
              onClick={() => onOverride?.(decision.index, o.id)}
              title={taken ? 'what he did' : `make him ${o.label}`}
            >
              {o.label}{taken ? ' ✓' : ''}
            </button>
          );
        })}
      </div>
      <p className="decision__hint">{decision.deviates ? 'This is a deviation from the honest protocol.' : 'This is the honest move. Pick another to see what happens.'}</p>
    </div>
  );
}
