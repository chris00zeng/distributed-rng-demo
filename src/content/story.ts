/** Intro copy (PRD R24). Short enough to read in under a minute. */
export const STORY = {
  title: 'Four roommates. Four rooms. One lease.',
  paragraphs: [
    'Zoe, Ana, Ben and Dave just signed a lease on a place with four very unequal rooms. The Royal Suite has an en-suite, a balcony, heated floors and a chandelier nobody asked for. The closet is, in fact, a closet.',
    'Everyone is in a different city until move-in day, so the rooms get assigned over the group chat. Someone has to roll the dice. Nobody trusts anybody to roll off camera, and Dave has a history: the last flat, the "lost" deposit, the parking space that was somehow always his. He is charming about it. That is the problem.',
    'Fair means every roommate has the same one-in-four chance at every room. There are only 24 ways to hand out four rooms, so the roll is a number from 0 to 23: everyone picks a number, the picks are added up and wrapped around at 24, and the result is the arrangement. If even one pick is honestly random, the result is fair. Every level of this ladder is about protecting that one assumption from Dave.',
  ],
  hook: 'So: how do four people who don’t trust each other roll one die?',
  howTo: [
    'Pick a level. Each one is a protocol, and each one closes the hole Dave found in the last.',
    'Choose how Dave plays. The dropdown only offers the cheats that level allows.',
    'Step through one round to watch who knows what, or run 1,000 rounds to see who ends up where.',
  ],
} as const;
