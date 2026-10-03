/**
 * Roles are policies (Technical Plan D24): given a decision point, which option
 * does a party with this role take? `honest` always takes the honest option.
 * Roles that have no opinion on a point fall through to honest.
 */
import type { DecisionPoint, Policy, Role } from './types';

export function honestOption(point: DecisionPoint): string {
  const h = point.options.find((o) => o.honest);
  if (!h) throw new Error(`decision ${point.kind} has no honest option`);
  return h.id;
}

const honest: Policy = (pt) => honestOption(pt);

const POLICIES: Record<Role, Policy> = {
  honest,
  liar: (pt) => (pt.kind === 'roll' ? 'win' : honestOption(pt)),
  lastMover: (pt) => (pt.kind === 'speak' ? 'wait' : pt.kind === 'steer' ? 'win' : honestOption(pt)),
  aborter: (pt) => {
    if (pt.kind === 'revealTiming') return 'wait';
    if (pt.kind === 'reveal') return pt.context?.wouldWin ? 'reveal' : 'quit';
    return honestOption(pt);
  },
  badDealer: (pt) => {
    if (pt.kind === 'deal') return 'inconsistent';
    if (pt.kind === 'answerComplaint') return 'ignore';
    if (pt.kind === 'revealTiming') return 'wait';
    if (pt.kind === 'reveal') return pt.context?.wouldWin ? 'reveal' : 'quit';
    return honestOption(pt);
  },
  fakeShare: (pt) => {
    if (pt.kind === 'revealTiming') return 'wait';
    if (pt.kind === 'reconstructTiming') return 'wait';
    if (pt.kind === 'reconstructShare') return pt.context?.knowsValue && !pt.context?.wouldWin ? 'forge' : 'true';
    return honestOption(pt);
  },
  // Extended in PR12 (collusion).
  colluder: honest,
};

export function policyFor(role: Role): Policy {
  return POLICIES[role];
}

/** Does the option id exist on the point? Used to validate UI overrides. */
export function hasOption(point: DecisionPoint, id: string): boolean {
  return point.options.some((o) => o.id === id);
}
