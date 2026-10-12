import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { wilsonLowerBound } from './confidence.js';
import { Roles, RolesQuery } from './schemas/stats.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const RANK_BRACKETS = { divine: 7, immortal: 8 } as const;
// weights of the score
const WIN_RATE_WEIGHT = 0.7;
const PICK_RATE_WEIGHT = 0.3;
// lowest score of each tier
const TIERS = [
  [80, 'S'],
  [65, 'A'],
  [50, 'B'],
  [35, 'C'],
] as const;

const round = (value: number) => Math.round(value * 10000) / 10000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/**
 * Percentile of a value among the values, from 0 (lowest) to 1 (highest);
 * ties share the average position. Unlike min-max scaling, a few extreme
 * heroes do not compress the others.
 */
const percentile = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return (value: number) => {
    if (sorted.length < 2) return 0.5;
    const below = sorted.filter((other) => other < value).length;
    const equal = sorted.filter((other) => other === value).length;
    return (below + (equal - 1) / 2) / (sorted.length - 1);
  };
};

const tierOf = (score: number): 'S' | 'A' | 'B' | 'C' | 'D' =>
  TIERS.find(([minimum]) => score >= minimum)?.[1] ?? 'D';

/**
 * Heroes by role (position 1 to 5) from the STRATZ data, with a score and a
 * tier, like the top heroes of the Dota2ProTracker meta page. Only the days
 * of the current patch count.
 */
@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeroes(
    { position, bracket, days, minMatches }: RolesQuery,
    now = new Date(),
  ): Promise<Roles> {
    const latest = await this.prisma.heroPositionDailyStat.findFirst({
      orderBy: { day: 'desc' },
      select: { day: true },
    });
    if (!latest) {
      return { available: false, from: null, to: null, matches: 0, heroes: [] };
    }

    const patch = await this.prisma.patch.findFirst({
      where: { releasedAt: { lte: now } },
      orderBy: { releasedAt: 'desc' },
    });
    const periodStart = new Date(latest.day.getTime() - (days - 1) * DAY_MS);
    const from =
      patch && patch.releasedAt > periodStart
        ? new Date(isoDay(patch.releasedAt))
        : periodStart;

    const where: Prisma.HeroPositionDailyStatWhereInput = {
      day: { gte: from, lte: latest.day },
      ...(position && { position }),
      ...(bracket && { rankBracket: RANK_BRACKETS[bracket] }),
    };
    const [rows, heroes] = await Promise.all([
      this.prisma.heroPositionDailyStat.groupBy({
        by: ['heroId'],
        where,
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany({
        select: { id: true, name: true, localizedName: true },
      }),
    ]);

    // each match has 2 players in a position, or 10 in all of them
    const playersPerMatch = position ? 2 : 10;
    const matches =
      rows.reduce((sum, row) => sum + (row._sum.matches ?? 0), 0) /
      playersPerMatch;
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));

    const stats = rows.flatMap((row) => {
      const hero = heroById.get(row.heroId);
      const heroMatches = row._sum.matches ?? 0;
      const wins = row._sum.wins ?? 0;
      if (!hero || heroMatches < minMatches) return [];
      return [
        {
          ...hero,
          matches: heroMatches,
          wins,
          winRate: round(wins / heroMatches),
          winRateLow: round(wilsonLowerBound(wins, heroMatches)),
          pickRate: round(heroMatches / matches),
        },
      ];
    });

    const normalizeWinRate = percentile(stats.map((hero) => hero.winRateLow));
    const normalizePickRate = percentile(stats.map((hero) => hero.pickRate));

    return {
      available: true,
      from: isoDay(from),
      to: isoDay(latest.day),
      matches: Math.round(matches),
      heroes: stats
        .map((hero) => {
          const score = Math.round(
            100 *
              (WIN_RATE_WEIGHT * normalizeWinRate(hero.winRateLow) +
                PICK_RATE_WEIGHT * normalizePickRate(hero.pickRate)),
          );
          return { ...hero, score, tier: tierOf(score) };
        })
        .sort((a, b) => b.score - a.score || b.matches - a.matches),
    };
  }
}
