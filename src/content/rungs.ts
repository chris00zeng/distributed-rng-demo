/**
 * Copy for each level of the ladder (PRD, The attack ladder; R14: each level lands in ~30 s).
 * The code keeps the plan docs' word "rung"; the product says "Level".
 */
import type { Role, Rung } from '../protocol/types';

export interface RungCopy {
  id: Rung;
  title: string;
  /** The story beat, in the roommates' voice: what went wrong last time, what they try now, what Dave is thinking. */
  story: string;
  protocol: string;
  attack: string;
  outcome: string;
  lesson: string;
  /** Which of Dave's roles is the level's headline attack. */
  attackRole: Role;
  /** Built yet? Unbuilt levels are hidden from navigation. */
  available: boolean;
}

export const ROLE_LABELS: Record<Role, string> = {
  honest: 'plays fair (for now)',
  liar: 'lies about the roll',
  lastMover: 'waits, then speaks last',
  aborter: 'quits whenever he loses',
  badDealer: 'deals shares that do not add up',
  fakeShare: 'forges a share the moment Ana\'s phone dies',
  colluder: 'colludes with Ben',
};

export const RUNGS: readonly RungCopy[] = [
  {
    id: 0,
    title: 'Dave rolls',
    story: 'Move-in is Saturday and nobody has rolled for the rooms. Dave volunteers. "I have dice right here," he says, off camera. He has, in fact, never owned dice.',
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
    story: 'Nobody says it out loud, but the Royal Suite went to the one person who rolled unsupervised. Zoe suggests everyone shout out a number and add them up: no single roller to trust. Dave says that is a wonderful idea and that he will go last, since he is driving.',
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
    story: 'After the announce-and-sum fiasco, Ana proposes sealed envelopes: everyone locks in a number before anyone says theirs, and only then do the envelopes open. Dave agrees immediately, which should have been the warning. He has noticed that an envelope stops you changing your number. It does not stop you leaving the room.',
    protocol: 'Everyone first publishes a hash of their number and a secret nonce, then everyone reveals. Nobody can change a number after committing.',
    attack: 'Dave reveals last. He learns the outcome before anyone learns his number. If he does not like it, he quits and the round restarts.',
    outcome: 'Dave quits until he wins. 100% again: the chart looks exactly like level 0.',
    lesson: 'Commitments stop lying, not quitting. The honest roommates cannot even tell a cheater from a dead phone.',
    attackRole: 'aborter',
    available: true,
  },
  {
    id: 3,
    title: 'Commit + secret shares',
    story: 'Three restarts in, Ben has had enough. New rule: after you seal your number, you also hand each roommate a piece of it, so that any two pieces rebuild it. If someone\'s phone "dies" at the convenient moment, the rest of us finish without them. Dave reads the rule twice, slowly, and for the first time has nothing to say.',
    protocol: 'As in level 2, but after committing, each roommate also splits their number into shares and hands one to every other roommate, before anyone reveals. Any 2 shares rebuild the number; 1 share on its own reveals nothing.',
    attack: 'Dave quits, or his phone dies.',
    outcome: 'Fixed. The others rebuild Dave\'s number from their shares and the round completes without him. Everyone at 25%.',
    lesson: 'An abort only matters if the aborter has already learned something. Once the shares are dealt, the outcome is fixed. A cheater\'s dropout and a dead phone are handled identically.',
    attackRole: 'aborter',
    available: true,
  },
  {
    id: 4,
    title: 'One bad dealer',
    story: 'Dave has been quiet for a week, which Zoe finds more alarming than the cheating. He has been thinking. The rule says hand out pieces of your number; it does not say the pieces have to agree with each other. When the others try to rebuild his number from pieces that do not fit, they will know something is wrong. They will not know who. And a round nobody can finish is a round that starts over.',
    protocol: 'Same as level 3. The roommates now check that the shares they collect agree with each other.',
    attack: 'Dave deals shares that do not add up, or hands in a forged share when Ana\'s phone dies. The others can see the shares disagree, but not whose share is the lie. All they can do is call the round void and start over.',
    outcome: 'Broken by one cheater. "Start over" is exactly what the quitter wanted. Dave: 100%, the level 2 chart again.',
    lesson: 'Secret sharing assumes an honest dealer. Detecting a lie is not enough; you have to be able to say who told it.',
    attackRole: 'badDealer',
    available: true,
  },
  {
    id: 5,
    title: 'Verifiable secret sharing',
    story: 'Ana comes back from a weekend with a cryptography textbook and a plan. Every piece you hand out now comes with a public receipt, so a piece that does not fit points straight at the person who dealt it. Complaints are settled before anyone reveals anything, and a dealer who cannot answer one is simply left out. Dave tries both of last week\'s tricks anyway. It is the first time the others have seen him lose on purpose.',
    protocol: 'Each roommate pads their pick with random digits, then publishes commitments to the whole line their shares lie on. Everyone checks the share they received against those commitments before anyone reveals. A share that fails gets a complaint; the dealer must publish that share or is thrown out, which costs nothing because nothing has been revealed yet.',
    attack: 'Same as level 4: shares that do not add up, or a forged share when Ana\'s phone dies.',
    outcome: 'Fixed. The bad shares are caught, with a name attached, before any reveal. A forged share is simply rejected. Everyone back at 25%.',
    lesson: 'Make cheating detectable, and attributable, before it can pay off. Then nobody ever needs to restart.',
    attackRole: 'badDealer',
    available: true,
  },
  {
    id: 6,
    title: 'The threshold limit',
    story: 'With the rules finally holding, Ben asks the question nobody wanted: what if Dave had a friend? Two roommates pooling their pieces can rebuild everyone\'s number before the reveal. Ask for more pieces and two dead phones can block the whole house instead. Dave, listening from the next room, starts texting Ben.',
    protocol: 'Verifiable secret sharing, but now you choose t: how many shares it takes to rebuild a number.',
    attack: 'Collusion. As soon as t roommates pool their shares they can rebuild everyone else\'s number early, then pick their own last: level 1 again, immune to commitments. Raise t to stop that, and t dead phones (or t quitters) leave too few shares to rebuild anyone.',
    outcome: 'Unfixable. Secrecy needs t ≥ f + 1. Liveness needs n − f ≥ t. Together: n ≥ 2f + 1. Four roommates can survive one cheater, never two, whatever t is. Set t = 4 and let Dave quit: he wins, or nobody gets a room.',
    lesson: 'You do not fix this. You choose t, and t is a trade between secrecy and liveness.',
    attackRole: 'aborter',
    available: true,
  },
];
