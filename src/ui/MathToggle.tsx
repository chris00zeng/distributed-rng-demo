/** "Show the cryptography" (PRD R11): hashes, nonces, share values, curve points and padding on demand. Remembered per browser. */
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
    <label
      className="math-toggle"
      title="Off: plain words (a sealed number, a share). On: the real hashes, nonces, share values, curve points and padding behind them."
    >
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>Show the cryptography</span>
    </label>
  );
}
