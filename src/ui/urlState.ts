/**
 * The app's state in the query string (PRD R13, Technical Plan D16):
 *   ?rung=2&roles=hhha&seed=roommates[&t=3][&drop=1]
 * `roles` is one letter per roommate in order You, Ana, Ben, Dave. Params
 * equal to their defaults are omitted. Garbage falls back to defaults, and a
 * role the rung's protocol does not offer falls back to honest. `t` and
 * `drop` round-trip for the later Sandbox even though the ladder UI does not
 * set them yet.
 */
import { rolesFor } from '../protocol/parties';
import { DEFAULT_SEED, RUNG_PROTOCOLS } from '../protocol/scenario';
import { PARTY_IDS, type PartyId, type Role, type Rung } from '../protocol/types';

export interface UrlState {
  rung: Rung;
  roles: Record<PartyId, Role>;
  seed: string;
  t?: number;
  drop?: PartyId;
}

export const ROLE_LETTERS: Record<Role, string> = {
  honest: 'h',
  liar: 'l',
  lastMover: 'm',
  aborter: 'a',
  badDealer: 'b',
  fakeShare: 'f',
  colluder: 'c',
};

const LETTER_ROLES: Record<string, Role> = Object.fromEntries(
  Object.entries(ROLE_LETTERS).map(([role, letter]) => [letter, role as Role]),
);

export const DEFAULT_ROLES: Record<PartyId, Role> = { 0: 'honest', 1: 'honest', 2: 'honest', 3: 'honest' };
const DEFAULT_ROLES_STR = 'hhhh';

export function defaultState(): UrlState {
  return { rung: 0, roles: { ...DEFAULT_ROLES }, seed: DEFAULT_SEED };
}

function isRung(n: number): n is Rung {
  return Number.isInteger(n) && n >= 0 && n <= 6;
}

function isPartyId(n: number): n is PartyId {
  return Number.isInteger(n) && n >= 0 && n <= 3;
}

export function encodeRoles(roles: Record<PartyId, Role>): string {
  return PARTY_IDS.map((p) => ROLE_LETTERS[roles[p]]).join('');
}

export function encodeState(state: UrlState): string {
  const q = new URLSearchParams();
  if (state.rung !== 0) q.set('rung', String(state.rung));
  const roles = encodeRoles(state.roles);
  if (roles !== DEFAULT_ROLES_STR) q.set('roles', roles);
  if (state.seed !== DEFAULT_SEED) q.set('seed', state.seed);
  if (state.t !== undefined) q.set('t', String(state.t));
  if (state.drop !== undefined) q.set('drop', String(state.drop));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function decodeState(search: string): UrlState {
  const state = defaultState();
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return state;
  }

  const rung = Number(q.get('rung'));
  if (q.has('rung') && isRung(rung)) state.rung = rung;
  const protocol = RUNG_PROTOCOLS[state.rung];

  const roles = q.get('roles');
  if (roles && roles.length === PARTY_IDS.length) {
    for (const p of PARTY_IDS) {
      const role = LETTER_ROLES[roles[p]!];
      if (role && rolesFor(protocol, p).includes(role)) state.roles[p] = role;
    }
  }

  const seed = q.get('seed');
  if (seed) state.seed = seed;

  if (q.has('t')) {
    const t = Number(q.get('t'));
    if (Number.isInteger(t) && t >= 1 && t <= PARTY_IDS.length) state.t = t;
  }

  if (q.has('drop')) {
    const drop = Number(q.get('drop'));
    if (isPartyId(drop)) state.drop = drop;
  }

  return state;
}
