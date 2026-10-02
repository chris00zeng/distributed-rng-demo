import { useCallback, useEffect, useState } from 'react';
import { decodeState, defaultState, encodeState, type UrlState } from './urlState';

const hasWindow = () => typeof window !== 'undefined' && typeof window.history?.replaceState === 'function';

/**
 * App state that lives in the query string: read once on load, written with
 * replaceState on every change so the address bar is always a shareable link
 * without polluting history.
 */
export function useUrlState(): [UrlState, (patch: Partial<UrlState> | ((s: UrlState) => UrlState)) => void] {
  const [state, setState] = useState<UrlState>(() => (hasWindow() ? decodeState(window.location.search) : defaultState()));

  useEffect(() => {
    if (!hasWindow()) return;
    const next = `${window.location.pathname}${encodeState(state)}${window.location.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (next !== current) window.history.replaceState(null, '', next);
  }, [state]);

  const update = useCallback((patch: Partial<UrlState> | ((s: UrlState) => UrlState)) => {
    setState((s) => (typeof patch === 'function' ? patch(s) : { ...s, ...patch }));
  }, []);

  return [state, update];
}
