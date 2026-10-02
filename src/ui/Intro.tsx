/** The story above the ladder (PRD R24) with the house (R25). Collapsible; remembers being closed. */
import { useState } from 'react';
import { ROOMS } from '../crypto/arrangements';
import { ROOM_INFO } from '../content/rooms';
import { STORY } from '../content/story';
import { Floorplan } from './Floorplan';

const KEY = 'fair-rooms:intro-closed';

function readClosed(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function Intro() {
  const [open, setOpen] = useState(() => !readClosed());
  const onToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    const next = e.currentTarget.open;
    setOpen(next);
    try { localStorage.setItem(KEY, next ? '0' : '1'); } catch { /* fine without it */ }
  };
  return (
    <details className="intro" open={open} onToggle={onToggle}>
      <summary className="intro__summary">
        <span className="intro__title">{STORY.title}</span>
        <span className="intro__toggle">{open ? 'hide the story' : 'read the story'}</span>
      </summary>
      <div className="intro__body">
        <div className="intro__text">
          {STORY.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          <p className="intro__hook">{STORY.hook}</p>
          <h3 className="intro__howto-title">How to use this</h3>
          <ol className="intro__howto">
            {STORY.howTo.map((h, i) => <li key={i}>{h}</li>)}
          </ol>
        </div>
        <div className="intro__house">
          <Floorplan title="The house" />
          <ul className="intro__rooms">
            {ROOMS.map((r) => (
              <li key={r}>
                <i className="legend__swatch" style={{ background: ROOM_INFO[r].color }} />
                <strong>{ROOM_INFO[r].label}</strong> <span className="intro__blurb">{ROOM_INFO[r].blurb}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
