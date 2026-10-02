/** Copy for each rung of the ladder. Filled in rung by rung as the protocols land (PRD R14). */
export interface RungCopy {
  id: number;
  title: string;
}

export const RUNGS: readonly RungCopy[] = [
  { id: 0, title: 'Dave rolls' },
  { id: 1, title: 'Announce and sum' },
  { id: 2, title: 'Commit-reveal' },
  { id: 3, title: 'Commit + secret shares' },
  { id: 4, title: 'One bad dealer' },
  { id: 5, title: 'Verifiable secret sharing' },
  { id: 6, title: 'The threshold limit' },
];
