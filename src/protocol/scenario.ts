import { DAVE, type PartyId, type ProtocolConfig, type Role, type Rung, type Scenario } from './types';

/**
 * Chosen so a first visitor who steps through sees the story: on rung 2 Dave
 * quits once and then wins; on rung 3 he quits and is reconstructed into the closet.
 */
export const DEFAULT_SEED = 'roommates';

export const RUNG_PROTOCOLS: Record<Rung, ProtocolConfig> = {
  0: { kind: 'trusted' },
  1: { kind: 'announce' },
  2: { kind: 'commitReveal' },
  3: { kind: 'shared', verify: false, t: 2 },
  4: { kind: 'shared', verify: false, t: 2 },
  5: { kind: 'shared', verify: true, t: 2 },
  6: { kind: 'shared', verify: true, t: 2 },
};

export const ALL_HONEST: Record<PartyId, Role> = { 0: 'honest', 1: 'honest', 2: 'honest', 3: 'honest' };

/** The ladder never builds a Scenario by hand: it sets Dave's role on a rung's preset (D19). */
export function rungScenario(rung: Rung, daveRole: Role, seed = DEFAULT_SEED, t?: number): Scenario {
  let protocol = RUNG_PROTOCOLS[rung];
  if (protocol.kind === 'shared' && t !== undefined) protocol = { ...protocol, t };
  return { protocol, roles: { ...ALL_HONEST, [DAVE]: daveRole }, seed };
}
