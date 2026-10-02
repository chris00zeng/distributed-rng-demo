import { ANNOUNCE_ROLES, createAnnounceParty } from './protocols/announce';
import { COMMIT_REVEAL_ROLES, createCommitRevealParty } from './protocols/commitReveal';
import { TRUSTED_ROLES, createTrustedParty } from './protocols/trusted';
import { DAVE, type Party, type PartyId, type ProtocolConfig, type Role, type Scenario } from './types';

export function createParty(scenario: Scenario, id: PartyId): Party {
  const role = scenario.roles[id];
  switch (scenario.protocol.kind) {
    case 'trusted': return createTrustedParty(role, id);
    case 'announce': return createAnnounceParty(role, id);
    case 'commitReveal': return createCommitRevealParty(role, id);
    case 'shared': throw new Error('shared protocol lands in PR5');
  }
}

/** Roles the pickers offer for a party under a protocol (Technical Plan D20). */
export function rolesFor(protocol: ProtocolConfig, id: PartyId): Role[] {
  switch (protocol.kind) {
    case 'trusted': return id === DAVE ? TRUSTED_ROLES.dealer : TRUSTED_ROLES.other;
    case 'announce': return ANNOUNCE_ROLES;
    case 'commitReveal': return COMMIT_REVEAL_ROLES;
    case 'shared': return ['honest'];
  }
}
