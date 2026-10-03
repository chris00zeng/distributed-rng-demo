import type { Event } from '../protocol/types';
import { describeEvent } from './format';
import { SPEEDS } from './useAutoplay';

interface Props {
  step: number;
  last: number;
  event: Event;
  /** True when the current deliver event is part of a broadcast. */
  broadcast: boolean;
  onPrev(): void;
  onNext(): void;
  onNextPhase(): void;
  onReset(): void;
  onEnd(): void;
  /** Auto-play (R7). Omit to hide the controls. */
  autoplay?: { playing: boolean; toggle(): void; ms: number; setMs(ms: number): void };
}

export function StepControls({ step, last, event, broadcast, onPrev, onNext, onNextPhase, onReset, onEnd, autoplay }: Props) {
  return (
    <div className="steps">
      <div className="steps__buttons" role="group" aria-label="Step through the round">
        <button type="button" onClick={onReset} disabled={step === 0} title="Back to the start">⟲</button>
        <button type="button" onClick={onPrev} disabled={step === 0} title="Previous message (←)">‹</button>
        {autoplay ? (
          <button
            type="button"
            className={`steps__play${autoplay.playing ? ' is-playing' : ''}`}
            onClick={autoplay.toggle}
            disabled={step === last && !autoplay.playing}
            title={autoplay.playing ? 'Pause (space)' : 'Play: one step every few seconds (space)'}
            aria-pressed={autoplay.playing}
          >
            {autoplay.playing ? '❚❚' : '▶'}
          </button>
        ) : null}
        <button type="button" onClick={onNext} disabled={step === last} title="Next message (→)">›</button>
        <button type="button" onClick={onNextPhase} disabled={step === last} title="Skip to the next phase">Next phase</button>
        <button type="button" onClick={onEnd} disabled={step === last} title="Jump to the end">End</button>
        {autoplay ? (
          <select className="steps__speed" value={autoplay.ms} onChange={(ev) => autoplay.setMs(Number(ev.target.value))} title="Seconds per step" aria-label="Auto-play speed">
            {SPEEDS.map((s) => <option key={s.ms} value={s.ms}>{s.label} / step</option>)}
          </select>
        ) : null}
        <span className="steps__count">{step + 1} / {last + 1}</span>
      </div>
      <p className="steps__event" aria-live="polite">{describeEvent(event, broadcast)}</p>
    </div>
  );
}
