/**
 * How picks become rooms (Technical Plan D21, D22).
 *
 * There are exactly 24 ways to hand four rooms to four roommates. They are
 * numbered 0..23 in lexicographic order. Each roommate contributes a value;
 * the values are added as plain integers and wrapped at 24, and the result
 * is the arrangement number. Party i gets ARRANGEMENTS[k][i].
 *
 * On rungs 0 to 4 a contribution is a bare pick in 0..23. From rung 5 the
 * contribution is a padded secret `pick + 24·r` (D23); `pickOf` reads the pick
 * back and `combine` is unaffected because 24·r ≡ 0 (mod 24).
 */
import type { Scalar } from './field';
import type { Prng } from './prng';

export const ROOMS = ['master', 'decent', 'small', 'closet'] as const;
export type Room = (typeof ROOMS)[number];

export const N_ARRANGEMENTS = 24;

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  const out: T[][] = [];
  items.forEach((head, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([head, ...tail]);
  });
  return out;
}

/** All 24 room orders, lexicographic in ROOMS order. ARRANGEMENTS[k][party] is that party's room. */
export const ARRANGEMENTS: ReadonlyArray<readonly Room[]> = permutations(ROOMS);

const KEY_TO_INDEX = new Map(ARRANGEMENTS.map((a, k) => [a.join(','), k]));

export function arrangement(k: number): readonly Room[] {
  const a = ARRANGEMENTS[k];
  if (!a) throw new RangeError(`arrangement ${k} out of range`);
  return a;
}

/** Index of an arrangement given the rooms in party order. */
export function indexOfArrangement(rooms: readonly Room[]): number {
  const k = KEY_TO_INDEX.get(rooms.join(','));
  if (k === undefined) throw new RangeError('not a valid arrangement');
  return k;
}

/** The pick hidden in a contribution: its remainder mod 24. */
export function pickOf(value: Scalar): number {
  return Number(((value % 24n) + 24n) % 24n);
}

/** Integer sum of contributions, wrapped at 24. Not field arithmetic on purpose. */
export function combine(values: readonly Scalar[]): number {
  let sum = 0n;
  for (const v of values) sum += v;
  return pickOf(sum);
}

/** Uniform pick in 0..23 as a Scalar, so it slots into the same message types. */
export function samplePick(rng: Prng): Scalar {
  return BigInt(rng.below(N_ARRANGEMENTS));
}

/** Arrangement numbers in which `party` gets `room`. Always 6 of the 24. */
export function winningIndices(party: number, room: Room = 'master'): number[] {
  const out: number[] = [];
  ARRANGEMENTS.forEach((a, k) => { if (a[party] === room) out.push(k); });
  return out;
}

/**
 * Direct steering (D22): given the integer total of everyone else's
 * contributions, the smallest pick that lands `party` in `room`.
 */
export function steerPick(othersTotal: Scalar, party: number, room: Room = 'master'): Scalar {
  const base = pickOf(othersTotal);
  for (let p = 0; p < N_ARRANGEMENTS; p++) {
    if (ARRANGEMENTS[(base + p) % N_ARRANGEMENTS]![party] === room) return BigInt(p);
  }
  throw new Error('unreachable: every room appears in some arrangement');
}
