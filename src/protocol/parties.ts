import { ANNOUNCE_ROLES, AnnounceParty } from './protocols/announce';
import { COMMIT_REVEAL_ROLES, CommitRevealParty } from './protocols/commitReveal';
import { SHARED_ROLES, createSharedParty } from './protocols/shared';
import { TRUSTED_ROLES, TrustedParty } from './protocols/trusted';
import { DAVE, type Party, type PartyId, type ProtocolConfig, type Role, type Scenario } from './types';

/** Every party runs the honest protocol; its role is applied as a policy at decision points (D24). */
export function createParty(scenario: Scenario, id: PartyId): Party {
  switch (scenario.protocol.kind) {
    case 'trusted': return new TrustedParty(id);
    case 'announce': return new AnnounceParty(id);
    case 'commitReveal': return new CommitRevealParty(id);
    case 'shared':
      return createSharedParty(id, scenario.protocol.t, scenario.protocol.verify);
  }
}

/** Roles the pickers offer for a party under a protocol (Technical Plan D20). */
export function rolesFor(protocol: ProtocolConfig, id: PartyId): Role[] {
  switch (protocol.kind) {
    case 'trusted': return id === DAVE ? TRUSTED_ROLES.dealer : TRUSTED_ROLES.other;
    case 'announce': return ANNOUNCE_ROLES;
    case 'commitReveal': return COMMIT_REVEAL_ROLES;
    case 'shared': return SHARED_ROLES;
  }
}
