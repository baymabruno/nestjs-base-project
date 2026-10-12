import { Injectable } from '@nestjs/common';
import { MatchSource, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { wilsonLowerBound } from './confidence.js';
import { MetaHeroes, MetaHeroesQuery } from './schemas/stats.schemas.js';

const PLAYERS_PER_MATCH = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANK_BRACKETS = { divine: 7, immortal: 8 } as const;
const SOURCES = { pro: MatchSource.PRO, public: MatchSource.PUBLIC } as const;
const DURATIONS = ['short', 'medium', 'long'] as const;
// matches each half of the period needs for a trend (a few matches would
// make a difference of tens of points by chance)
export const MIN_TREND_MATCHES = 30;

interface Totals {
  matches: number;
  wins: number;
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const rateOf = ({ matches, wins }: Totals) =>
  matches > 0 ? round(wins / matches) : null;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const add = (totals: Totals, matches: number, wins: number) => {
  totals.matches += matches;
  totals.wins += wins;
};

/**
 * Meta page: hero statistics of the current patch within a period, read from
 * the daily table (hero_daily_stats) rebuilt by the worker.
 */
@Injectable()
export class MetaService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeroes(
    { source, bracket, days, minMatches }: MetaHeroesQuery,
    now = new Date(),
  ): Promise<MetaHeroes> {
    const to = new Date(isoDay(now));
    const from = new Date(to.getTime() - (days - 1) * DAY_MS);
    const dayList = Array.from({ length: days }, (_, index) =>
      isoDay(new Date(from.getTime() + index * DAY_MS)),
    );
    // the second half of the period, for the trend
    const recentFrom = dayList[Math.ceil(days / 2)];

    const latest = await this.prisma.heroDailyStat.findFirst({
      orderBy: { patchId: 'desc' },
      select: { patchId: true },
    });
    const where: Prisma.HeroDailyStatWhereInput = {
      patchId: latest?.patchId ?? -1,
      day: { gte: from, lte: to },
      ...(source && { source: SOURCES[source] }),
      ...(bracket && { rankBracket: RANK_BRACKETS[bracket] }),
    };

    const [patch, rows, heroes] = await Promise.all([
      latest
        ? this.prisma.patch.findUnique({ where: { id: latest.patchId } })
        : null,
      this.prisma.heroDailyStat.groupBy({
        by: ['heroId', 'day', 'durationBucket'],
        where,
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany(),
    ]);

    const byHero = new Map<
      number,
      {
        total: Totals;
        durations: Totals[];
        daily: Map<string, Totals>;
        halves: [Totals, Totals];
      }
    >();
    for (const row of rows) {
      const matches = row._sum.matches ?? 0;
      const wins = row._sum.wins ?? 0;
      let hero = byHero.get(row.heroId);
      if (!hero) {
        hero = {
          total: { matches: 0, wins: 0 },
          durations: DURATIONS.map(() => ({ matches: 0, wins: 0 })),
          daily: new Map(),
          halves: [
            { matches: 0, wins: 0 },
            { matches: 0, wins: 0 },
          ],
        };
        byHero.set(row.heroId, hero);
      }
      const day = isoDay(row.day);
      add(hero.total, matches, wins);
      add(hero.durations[row.durationBucket], matches, wins);
      const daily = hero.daily.get(day) ?? { matches: 0, wins: 0 };
      add(daily, matches, wins);
      hero.daily.set(day, daily);
      if (recentFrom) {
        add(hero.halves[day >= recentFrom ? 1 : 0], matches, wins);
      }
    }

    const totalMatches =
      [...byHero.values()].reduce((sum, hero) => sum + hero.total.matches, 0) /
      PLAYERS_PER_MATCH;
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));

    return {
      patch: patch && {
        ...patch,
        releasedAt: patch.releasedAt.toISOString(),
      },
      from: isoDay(from),
      to: isoDay(to),
      matches: totalMatches,
      heroes: [...byHero.entries()]
        .flatMap(([heroId, stats]) => {
          const hero = heroById.get(heroId);
          if (!hero || stats.total.matches < minMatches) return [];
          const [first, second] = stats.halves.map((half) =>
            half.matches >= MIN_TREND_MATCHES ? rateOf(half) : null,
          );
          return [
            {
              ...hero,
              ...stats.total,
              winRate: rateOf(stats.total) ?? 0,
              winRateLow: round(
                wilsonLowerBound(stats.total.wins, stats.total.matches),
              ),
              pickRate: round(stats.total.matches / totalMatches),
              durations: {
                short: this.durationStats(stats.durations[0]),
                medium: this.durationStats(stats.durations[1]),
                long: this.durationStats(stats.durations[2]),
              },
              trend:
                first === null || second === null
                  ? null
                  : round(second - first),
              daily: dayList.map((day) => {
                const totals = stats.daily.get(day) ?? { matches: 0, wins: 0 };
                return {
                  day,
                  matches: totals.matches,
                  winRate: rateOf(totals),
                };
              }),
            },
          ];
        })
        .sort(
          (a, b) =>
            b.winRateLow - a.winRateLow || b.matches - a.matches || a.id - b.id,
        ),
    };
  }

  private durationStats(totals: Totals) {
    return { matches: totals.matches, winRate: rateOf(totals) };
  }
}
