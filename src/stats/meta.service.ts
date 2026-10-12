import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation.js';
import { MatchSource, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { wilsonLowerBound } from './confidence.js';
import { scoreHeroes } from './score.js';
import { MetaHeroes, MetaHeroesQuery } from './schemas/stats.schemas.js';

const PLAYERS_PER_MATCH = 10;
const RANK_BRACKETS = { divine: 7, immortal: 8 } as const;
const SOURCES = { pro: MatchSource.PRO, public: MatchSource.PUBLIC } as const;
const DURATIONS = ['short', 'medium', 'long'] as const;

interface Totals {
  matches: number;
  wins: number;
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const rateOf = ({ matches, wins }: Totals) =>
  matches > 0 ? round(wins / matches) : null;

/**
 * Meta page: hero statistics of the current patch, read from
 * hero_daily_stats, which the worker rebuilds with the public matches of the
 * window (PUBLIC_WINDOW_HOURS) and the pro matches of the whole patch.
 */
@Injectable()
export class MetaService {
  private readonly publicWindowHours: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.publicWindowHours = config.get('PUBLIC_WINDOW_HOURS', { infer: true });
  }

  async getHeroes({
    source,
    bracket,
    minMatches,
  }: MetaHeroesQuery): Promise<MetaHeroes> {
    const latest = await this.prisma.heroDailyStat.findFirst({
      orderBy: { patchId: 'desc' },
      select: { patchId: true },
    });
    const where: Prisma.HeroDailyStatWhereInput = {
      patchId: latest?.patchId ?? -1,
      ...(source && { source: SOURCES[source] }),
      ...(bracket && { rankBracket: RANK_BRACKETS[bracket] }),
    };

    const [patch, rows, heroes] = await Promise.all([
      latest
        ? this.prisma.patch.findUnique({ where: { id: latest.patchId } })
        : null,
      this.prisma.heroDailyStat.groupBy({
        by: ['heroId', 'durationBucket'],
        where,
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany(),
    ]);

    const byHero = new Map<number, { total: Totals; durations: Totals[] }>();
    for (const row of rows) {
      const matches = row._sum.matches ?? 0;
      const wins = row._sum.wins ?? 0;
      let hero = byHero.get(row.heroId);
      if (!hero) {
        hero = {
          total: { matches: 0, wins: 0 },
          durations: DURATIONS.map(() => ({ matches: 0, wins: 0 })),
        };
        byHero.set(row.heroId, hero);
      }
      hero.total.matches += matches;
      hero.total.wins += wins;
      hero.durations[row.durationBucket].matches += matches;
      hero.durations[row.durationBucket].wins += wins;
    }

    const totalMatches =
      [...byHero.values()].reduce((sum, hero) => sum + hero.total.matches, 0) /
      PLAYERS_PER_MATCH;
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));
    const durationStats = (totals: Totals) => ({
      matches: totals.matches,
      winRate: rateOf(totals),
    });

    return {
      patch: patch && {
        ...patch,
        releasedAt: patch.releasedAt.toISOString(),
      },
      publicWindowHours: this.publicWindowHours,
      matches: totalMatches,
      heroes: scoreHeroes(
        [...byHero.entries()].flatMap(([heroId, stats]) => {
          const hero = heroById.get(heroId);
          if (!hero || stats.total.matches < minMatches) return [];
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
                short: durationStats(stats.durations[0]),
                medium: durationStats(stats.durations[1]),
                long: durationStats(stats.durations[2]),
              },
            },
          ];
        }),
      ),
    };
  }
}
