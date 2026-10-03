/**
 * One-click Sandbox experiments (PRD R23): questions the ladder raises but never
 * answers, each a complete Scenario plus what to expect. Data only; the UI lands
 * with the Sandbox tab.
 */
import { DEFAULT_SEED, RUNG_PROTOCOLS } from './scenario';
import type { ProtocolConfig } from './types';

const verified = (t: number): ProtocolConfig => ({ kind: 'shared', verify: true, t });
import type { PartyId, Role, Scenario } from './types';

export interface Experiment {
  id: string;
  title: string;
  question: string;
  expect: string;
  scenario: Scenario;
}

const roles = (z: Role, a: Role, b: Role, d: Role): Record<PartyId, Role> => ({ 0: z, 1: a, 2: b, 3: d });

export const EXPERIMENTS: readonly Experiment[] = [
  {
    id: 'colluders-t2',
    title: 'Two colluders, t = 2',
    question: 'Dave and Ben pool their shares. Can they peek before the reveal, and does peeking help?',
    expect: 'They rebuild everyone’s number as soon as the honest two have dealt. Each of them can still go silent before dealing and be left out, so Dave picks the best of four outcomes: about 68% instead of 25%.',
    scenario: { protocol: verified(2), roles: roles('honest', 'honest', 'colluder', 'colluder'), seed: DEFAULT_SEED },
  },
  {
    id: 'colluders-t3',
    title: 'Two colluders, t = 3',
    question: 'Same ring, but three shares are needed to rebuild a number.',
    expect: 'Two shares are not enough to peek, so they deal honestly: 25% each. Raising t bought secrecy. The phase chart says what it cost.',
    scenario: { protocol: verified(3), roles: roles('honest', 'honest', 'colluder', 'colluder'), seed: DEFAULT_SEED },
  },
  {
    id: 'two-quitters',
    title: 'Two quitters on level 2',
    question: 'Ben and Dave both quit whenever they would lose. Who wins?',
    expect: 'Whoever holds out longer. Both wait for the other to reveal; someone has to blink, and the one who reveals first has given up his chance to quit. The last to decide quits until he wins. They split the suite between them, and Zoe and Ana never see it.',
    scenario: { protocol: RUNG_PROTOCOLS[2], roles: roles('honest', 'honest', 'aborter', 'aborter'), seed: DEFAULT_SEED },
  },
  {
    id: 'dead-phone-t4',
    title: 'No villain at all: a dead phone at t = 4',
    question: 'Everyone is honest, Ana’s phone dies after dealing, and four shares are needed to rebuild a number.',
    expect: 'Three shares cannot rebuild Ana’s number. Every round is stuck and nobody gets a room. Liveness fails with no cheater in sight.',
    scenario: { protocol: verified(4), roles: roles('honest', 'honest', 'honest', 'honest'), seed: DEFAULT_SEED, dropout: 1 },
  },
];
