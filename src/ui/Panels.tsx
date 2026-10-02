import { PARTY_IDS, type PartyId, type PartyView, type Role } from '../protocol/types';
import { ROLE_LABELS } from '../content/rungs';
import { name } from './format';
import { panelFacts, panelPhase } from './panelFacts';

export function Panels({ views, roles }: { views: PartyView[]; roles: Record<PartyId, Role> }) {
  return (
    <div className="panels">
      {PARTY_IDS.map((p) => {
        const view = views[p]!;
        const role = roles[p];
        const cheating = role !== 'honest';
        const facts = panelFacts(view, p);
        return (
          <article key={p} className={`panel${cheating ? ' panel--cheater' : ''}${p === 0 ? ' panel--you' : ''}`} aria-label={`${name(p)}'s view`}>
            <header className="panel__head">
              <h3>{name(p)}</h3>
              <span className="panel__phase">{panelPhase(view)}</span>
            </header>
            {cheating ? <p className="panel__role">{name(p)} {ROLE_LABELS[role]}</p> : null}
            <dl className="panel__facts">
              {facts.map((f, i) => (
                <div key={i} className={`fact fact--${f.kind}`}>
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
