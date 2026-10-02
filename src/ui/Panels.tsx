import { DAVE, PARTY_IDS, type Event, type PartyId, type PartyView, type Role } from '../protocol/types';
import { ROLE_LABELS } from '../content/rungs';
import { name, roomLabel } from './format';
import { panelFacts, panelPhase } from './panelFacts';

type Decision = Extract<Event, { kind: 'decision' }>;

interface Props {
  views: PartyView[];
  roles: Record<PartyId, Role>;
  /** The decision being made at the current step, if the current event is one. */
  decision?: Decision;
  /** Parties that have deviated from the honest path so far in this attempt. */
  deviated?: ReadonlySet<PartyId>;
  onOverride?: (index: number, option: string) => void;
  /** Whose moves the user may play. The ladder is Dave-centric (PRD R27); the Sandbox may widen this. */
  playable?: readonly PartyId[];
}

export function Panels({ views, roles, decision, deviated, onOverride, playable = [DAVE] }: Props) {
  return (
    <div className="panels">
      {PARTY_IDS.map((p) => {
        const view = views[p]!;
        const role = roles[p];
        const cheating = role !== 'honest';
        const facts = panelFacts(view, p);
        const deciding = decision && decision.by === p && playable.includes(p) ? decision : undefined;
        const offPath = deviated?.has(p) ?? false;
        const cls = `panel${cheating ? ' panel--cheater' : ''}${p === 0 ? ' panel--you' : ''}${offPath ? ' panel--deviating' : ''}${deciding ? ' panel--deciding' : ''}`;
        return (
          <article key={p} className={cls} aria-label={`${name(p)}'s view`}>
            <header className="panel__head">
              <h3>{name(p)}</h3>
              <span className="panel__phase">{offPath ? 'off the honest path · ' : ''}{panelPhase(view)}</span>
            </header>
            {cheating ? <p className="panel__role">{name(p)} {ROLE_LABELS[role]}</p> : null}
            {deciding ? <DecisionBox decision={deciding} onOverride={onOverride} /> : null}
            <dl className="panel__facts">
              {facts.map((f, i) => (
                <div key={i} className={`fact fact--${f.kind}`} data-fact={f.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                </div>
              ))}
            </dl>
            {view.note ? <p className="panel__note">{view.note}</p> : null}
            {facts.length === 0 && !view.note ? <p className="panel__note">knows nothing yet</p> : null}
          </article>
        );
      })}
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
