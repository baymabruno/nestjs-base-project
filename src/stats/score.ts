// Score (0 to 100) and tier of the heroes, like the top heroes of the
// Dota2ProTracker meta page: 70% the percentile of the adjusted win rate and
// 30% the percentile of the pick rate, among the heroes compared

const WIN_RATE_WEIGHT = 0.7;
const PICK_RATE_WEIGHT = 0.3;
// lowest score of each tier
const TIERS = [
  [80, 'S'],
  [65, 'A'],
  [50, 'B'],
  [35, 'C'],
] as const;

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * Percentile of a value among the values, from 0 (lowest) to 1 (highest);
 * ties share the average position. Unlike min-max scaling, a few extreme
 * heroes do not compress the others.
 */
export const percentile = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (value: number) => {
    if (sorted.length < 2) return 0.5;
    const below = sorted.filter((other) => other < value).length;
    const equal = sorted.filter((other) => other === value).length;
    return (below + (equal - 1) / 2) / (sorted.length - 1);
  };
};

export const tierOf = (score: number): Tier =>
  TIERS.find(([minimum]) => score >= minimum)?.[1] ?? 'D';

/**
 * Adds the score and the tier to each hero and sorts them, highest score
 * first (ties: more matches first)
 */
export function scoreHeroes<
  T extends { winRateLow: number; pickRate: number; matches: number },
>(heroes: T[]): (T & { score: number; tier: Tier })[] {
  const winRate = percentile(heroes.map((hero) => hero.winRateLow));
  const pickRate = percentile(heroes.map((hero) => hero.pickRate));
  return heroes
    .map((hero) => {
      const score = Math.round(
        100 *
          (WIN_RATE_WEIGHT * winRate(hero.winRateLow) +
            PICK_RATE_WEIGHT * pickRate(hero.pickRate)),
      );
      return { ...hero, score, tier: tierOf(score) };
    })
    .sort((a, b) => b.score - a.score || b.matches - a.matches);
}
