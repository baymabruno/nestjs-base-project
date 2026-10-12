import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchSource } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { wilsonLowerBound, wilsonUpperBound } from './confidence.js';
import {
  HeroItemTimings,
  HeroItemTimingsQuery,
  HeroMatchups,
  HeroMatchupsQuery,
} from './schemas/stats.schemas.js';

const SOURCES = { pro: MatchSource.PRO, public: MatchSource.PUBLIC } as const;
// the last timing bucket: purchases at 60 minutes or later
const LAST_BUCKET = 13;
const BUCKET_MINUTES = 5;

const round = (value: number) => Math.round(value * 10000) / 10000;
const ratio = (part: number, total: number) =>
  total > 0 ? round(part / total) : 0;

/** Minutes covered by a timing bucket (null: open end) */
const bucketRange = (bucket: number) => ({
  fromMinute: bucket === 0 ? null : (bucket - 1) * BUCKET_MINUTES,
  toMinute:
    bucket === 0 ? 0 : bucket === LAST_BUCKET ? null : bucket * BUCKET_MINUTES,
});

/**
 * Hero page: matchups (enemies and allies) and the win rate by the time of
 * the first purchase of each item, from the tables rebuilt by the worker.
 */
@Injectable()
export class HeroService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatchups(
    heroId: number,
    { source, minMatches }: HeroMatchupsQuery,
  ): Promise<HeroMatchups> {
    await this.ensureHero(heroId);
    const sourceFilter = source ? { source: SOURCES[source] } : {};

    const [overall, rows, heroes] = await Promise.all([
      this.prisma.heroStat.aggregate({
        where: { heroId, ...sourceFilter },
        _sum: { matches: true, wins: true },
      }),
      this.prisma.heroMatchupStat.groupBy({
        by: ['otherHeroId', 'ally'],
        where: { heroId, ...sourceFilter },
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany({
        select: { id: true, name: true, localizedName: true },
      }),
    ]);
    const heroMatches = overall._sum.matches ?? 0;
    const winRate = ratio(overall._sum.wins ?? 0, heroMatches);
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));

    const matchups = (ally: boolean) =>
      rows
        .filter((row) => row.ally === ally)
        .flatMap((row) => {
          const other = heroById.get(row.otherHeroId);
          const matches = row._sum.matches ?? 0;
          const wins = row._sum.wins ?? 0;
          if (!other || matches < minMatches) return [];
          const rate = ratio(wins, matches);
          return [
            {
              ...other,
              matches,
              wins,
              winRate: rate,
              winRateLow: round(wilsonLowerBound(wins, matches)),
              winRateHigh: round(wilsonUpperBound(wins, matches)),
              delta: round(rate - winRate),
            },
          ];
        })
        .sort((a, b) => b.winRate - a.winRate || b.matches - a.matches);

    return {
      hero: { id: heroId, matches: heroMatches, winRate },
      enemies: matchups(false),
      allies: matchups(true),
    };
  }

  async getItemTimings(
    heroId: number,
    { source, minMatches, minItemCost }: HeroItemTimingsQuery,
  ): Promise<HeroItemTimings> {
    await this.ensureHero(heroId);
    const sourceFilter = source ? { source: SOURCES[source] } : {};

    const latest = await this.prisma.heroItemTimingStat.findFirst({
      select: { patchId: true },
    });
    if (!latest) return { matches: 0, items: [] };

    const [matches, rows] = await Promise.all([
      // matches of the hero with the purchase order
      this.prisma.matchPlayer.count({
        where: {
          heroId,
          patchId: latest.patchId,
          purchaseItems: { isEmpty: false },
          ...sourceFilter,
        },
      }),
      this.prisma.heroItemTimingStat.groupBy({
        by: ['itemId', 'bucket'],
        where: { heroId, ...sourceFilter },
        _sum: { matches: true, wins: true, timeSum: true },
        orderBy: { bucket: 'asc' },
      }),
    ]);
    const items = await this.prisma.item.findMany({
      where: { id: { in: [...new Set(rows.map((row) => row.itemId))] } },
    });

    const byItem = new Map<number, typeof rows>();
    for (const row of rows) {
      byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
    }

    return {
      matches,
      items: items
        .flatMap((item) => {
          const buckets = byItem.get(item.id) ?? [];
          const total = buckets.reduce(
            (sum, row) => {
              sum.matches += row._sum.matches ?? 0;
              sum.wins += row._sum.wins ?? 0;
              sum.time += Number(row._sum.timeSum ?? 0);
              return sum;
            },
            { matches: 0, wins: 0, time: 0 },
          );
          if (total.matches < minMatches || (item.cost ?? 0) < minItemCost) {
            return [];
          }
          return [
            {
              ...item,
              matches: total.matches,
              wins: total.wins,
              winRate: ratio(total.wins, total.matches),
              purchaseRate: ratio(total.matches, matches),
              avgTime: Math.round(total.time / total.matches),
              timings: buckets.map((row) => ({
                bucket: row.bucket,
                ...bucketRange(row.bucket),
                matches: row._sum.matches ?? 0,
                winRate: ratio(row._sum.wins ?? 0, row._sum.matches ?? 0),
              })),
            },
          ];
        })
        .sort((a, b) => b.matches - a.matches || a.id - b.id),
    };
  }

  private async ensureHero(heroId: number) {
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException(`Hero ${heroId} not found`);
  }
}
