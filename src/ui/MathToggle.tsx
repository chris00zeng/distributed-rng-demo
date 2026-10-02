/** "Show the math" (PRD R11): raw hashes, nonces and field values on demand. Remembered per browser. */
import { useState } from 'react';

const KEY = 'fair-rooms:show-math';

export function useMathToggle(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState<boolean>(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const set = (next: boolean) => {
    setOn(next);
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* fine without it */ }
  };
  return [on, set];
}

export function MathToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="math-toggle" title="Reveal the hashes, nonces and field values behind the pictures">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>show the math</span>
    </label>
  );
}
