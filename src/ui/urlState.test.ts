import { describe, expect, it } from 'vitest';
import { rolesFor } from '../protocol/parties';
import { DEFAULT_SEED, RUNG_PROTOCOLS } from '../protocol/scenario';
import { DAVE, PARTY_IDS, type Rung } from '../protocol/types';
import { DEFAULT_ROLES, decodeState, defaultState, encodeState, type UrlState } from './urlState';

describe('url state', () => {
  it('defaults encode to an empty string and decode back to defaults', () => {
    expect(encodeState(defaultState())).toBe('');
    expect(decodeState('')).toEqual(defaultState());
    expect(decodeState('?')).toEqual(defaultState());
  });

  it('round-trips every rung and every Dave role the preset offers', () => {
    for (const rung of [0, 1, 2, 3, 4, 5, 6] as Rung[]) {
      for (const role of rolesFor(RUNG_PROTOCOLS[rung], DAVE)) {
        const state = { rung, roles: { ...DEFAULT_ROLES, [DAVE]: role }, seed: 'abc' };
        const encoded = encodeState(state);
        expect(decodeState(encoded)).toEqual(state);
      }
    }
  });

  it('omits params equal to their defaults', () => {
    expect(encodeState({ rung: 2, roles: { ...DEFAULT_ROLES }, seed: DEFAULT_SEED })).toBe('?rung=2');
    expect(encodeState({ rung: 0, roles: { ...DEFAULT_ROLES, 3: 'liar' }, seed: DEFAULT_SEED })).toBe('?roles=hhhl');
    expect(encodeState({ rung: 0, roles: { ...DEFAULT_ROLES }, seed: 'x y' })).toBe('?seed=x+y');
  });

  it('uses the documented shape', () => {
    expect(encodeState({ rung: 2, roles: { ...DEFAULT_ROLES, 3: 'aborter' }, seed: 'abc' })).toBe('?rung=2&roles=hhha&seed=abc');
  });

  it('garbage falls back to defaults', () => {
    expect(decodeState('?rung=9&roles=zzzz&seed=')).toEqual(defaultState());
    expect(decodeState('?rung=abc&roles=hh&t=0&drop=7')).toEqual(defaultState());
    expect(decodeState('not even a query string')).toEqual(defaultState());
  });

  it('a role the rung does not offer falls back to honest', () => {
    // aborter is a commit-reveal role, not a rung 0 role
    expect(decodeState('?rung=0&roles=hhha').roles[DAVE]).toBe('honest');
    // liar is a rung 0 role only
    expect(decodeState('?rung=1&roles=hhhl').roles[DAVE]).toBe('honest');
    // valid on its rung
    expect(decodeState('?rung=1&roles=hhhm').roles[DAVE]).toBe('lastMover');
    // honest roommates cannot be liars under trusted (dealer only)
    expect(decodeState('?rung=0&roles=lhhl').roles).toEqual({ ...DEFAULT_ROLES, 3: 'liar' });
  });

  it('t and drop round-trip for the Sandbox', () => {
    const state: UrlState = { rung: 2, roles: { ...DEFAULT_ROLES }, seed: DEFAULT_SEED, t: 3, drop: 1 };
    expect(encodeState(state)).toBe('?rung=2&t=3&drop=1');
    expect(decodeState(encodeState(state))).toEqual(state);
    for (const p of PARTY_IDS) expect(decodeState(`?drop=${p}`).drop).toBe(p);
  });

  it('seed round-trips through URL encoding', () => {
    for (const seed of ['a b', 'ü', '&=?', 'x/y']) {
      expect(decodeState(encodeState({ ...defaultState(), seed })).seed).toBe(seed);
    }
  });
});
