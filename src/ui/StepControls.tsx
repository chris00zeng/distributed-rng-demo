import type { Event } from '../protocol/types';
import { describeEvent } from './format';

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
}

export function StepControls({ step, last, event, broadcast, onPrev, onNext, onNextPhase, onReset, onEnd }: Props) {
  return (
    <div className="steps">
      <div className="steps__buttons" role="group" aria-label="Step through the round">
        <button type="button" onClick={onReset} disabled={step === 0} title="Back to the start">⟲</button>
        <button type="button" onClick={onPrev} disabled={step === 0} title="Previous message (←)">‹</button>
        <button type="button" onClick={onNext} disabled={step === last} title="Next message (→)">›</button>
        <button type="button" onClick={onNextPhase} disabled={step === last} title="Skip to the next phase">next phase</button>
        <button type="button" onClick={onEnd} disabled={step === last} title="Jump to the end">end</button>
        <span className="steps__count">{step + 1} / {last + 1}</span>
      </div>
      <p className="steps__event" aria-live="polite">{describeEvent(event, broadcast)}</p>
    </div>
  );
}
