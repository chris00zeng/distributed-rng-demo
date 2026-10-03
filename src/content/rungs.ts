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
  badDealer: 'deals shares that do not add up',
  fakeShare: 'forges a share when Ana\'s phone dies',
  colluder: 'colludes with Ben',
};

export const RUNGS: readonly RungCopy[] = [
  {
    id: 0,
    title: 'Dave rolls',
    protocol: 'One roommate picks the random number for everyone.',
    attack: 'Dave lies about the roll.',
    outcome: 'Dave takes the Royal Suite 100% of the time.',
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
  {
    id: 3,
    title: 'Commit + secret shares',
    protocol: 'As in rung 2, but after committing, each roommate also splits their number into shares and hands one to every other roommate, before anyone reveals. Any 2 shares rebuild the number; 1 share on its own reveals nothing.',
    attack: 'Dave quits, or his phone dies.',
    outcome: 'Fixed. The others rebuild Dave\'s number from their shares and the round completes without him. Everyone at 25%.',
    lesson: 'An abort only matters if the aborter has already learned something. Once the shares are dealt, the outcome is fixed. A cheater\'s dropout and a dead phone are handled identically.',
    attackRole: 'aborter',
    available: true,
  },
  {
    id: 4,
    title: 'One bad dealer',
    protocol: 'Same as rung 3. The roommates now check that the shares they collect agree with each other.',
    attack: 'Dave deals shares that do not add up, or hands in a forged share when Ana\'s phone dies. The others can see the shares disagree, but not whose share is the lie. All they can do is call the round void and start over.',
    outcome: 'Broken by one cheater. "Start over" is exactly what the quitter wanted. Dave: 100%, the rung 2 chart again.',
    lesson: 'Secret sharing assumes an honest dealer. Detecting a lie is not enough; you have to be able to say who told it.',
    attackRole: 'badDealer',
    available: true,
  },
  {
    id: 5,
    title: 'Verifiable secret sharing',
    protocol: 'Each roommate pads their pick with random digits, then publishes commitments to the whole line their shares lie on. Everyone checks the share they received against those commitments before anyone reveals. A share that fails gets a complaint; the dealer must publish that share or is thrown out, which costs nothing because nothing has been revealed yet.',
    attack: 'Same as rung 4: shares that do not add up, or a forged share when Ana\'s phone dies.',
    outcome: 'Fixed. The bad shares are caught, with a name attached, before any reveal. A forged share is simply rejected. Everyone back at 25%.',
    lesson: 'Make cheating detectable, and attributable, before it can pay off. Then nobody ever needs to restart.',
    attackRole: 'badDealer',
    available: true,
  },
  { id: 6, title: 'The threshold limit', protocol: '', attack: '', outcome: '', lesson: '', attackRole: 'colluder', available: false },
];
