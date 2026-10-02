/** Copy for each rung of the ladder (PRD, The attack ladder; R14: each rung lands in ~30 s). */
import type { Role, Rung } from '../protocol/types';

export interface RungCopy {
  id: Rung;
  title: string;
  protocol: string;
  attack: string;
  outcome: string;
  lesson: string;
  /** Which of Dave's roles is the rung's headline attack. */
  attackRole: Role;
  /** Built yet? Unbuilt rungs are hidden from navigation. */
  available: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  honest: 'plays fair',
  liar: 'lies about the roll',
  lastMover: 'speaks last',
  aborter: 'quits when he loses',
  badDealer: 'deals inconsistent shares',
  fakeShare: 'submits a fake share',
  colluder: 'colludes with Ben',
};

export const RUNGS: readonly RungCopy[] = [
  {
    id: 0,
    title: 'Dave rolls',
    protocol: 'One roommate picks the random number for everyone.',
    attack: 'Dave lies about the roll.',
    outcome: 'Dave takes the master bedroom 100% of the time.',
    lesson: 'Trusting one party is not randomness.',
    attackRole: 'liar',
    available: true,
  },
  {
    id: 1,
    title: 'Announce and sum',
    protocol: 'Everyone announces a number; the numbers are added up and the total picks the rooms.',
    attack: 'Dave waits to hear the other three, then picks a number that steers the total.',
    outcome: 'Whoever speaks last controls the outcome. Dave: 100%.',
    lesson: 'Order of speaking is power.',
    attackRole: 'lastMover',
    available: true,
  },
  {
    id: 2,
    title: 'Commit-reveal',
    protocol: 'Everyone first publishes a hash of their number and a secret nonce, then everyone reveals. Nobody can change a number after committing.',
    attack: 'Dave reveals last. He learns the outcome before anyone learns his number. If he does not like it, he quits and the round restarts.',
    outcome: 'Dave quits until he wins. 100% again: the chart looks exactly like rung 0.',
    lesson: 'Commitments stop lying, not quitting. The honest roommates cannot even tell a cheater from a dead phone.',
    attackRole: 'aborter',
    available: true,
  },
  { id: 3, title: 'Commit + secret shares', protocol: '', attack: '', outcome: '', lesson: '', attackRole: 'aborter', available: false },
  { id: 4, title: 'One bad dealer', protocol: '', attack: '', outcome: '', lesson: '', attackRole: 'badDealer', available: false },
  { id: 5, title: 'Verifiable secret sharing', protocol: '', attack: '', outcome: '', lesson: '', attackRole: 'badDealer', available: false },
  { id: 6, title: 'The threshold limit', protocol: '', attack: '', outcome: '', lesson: '', attackRole: 'colluder', available: false },
];
