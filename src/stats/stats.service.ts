import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchSource, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  HeroDetails,
  HeroesQuery,
  HeroList,
  HeroQuery,
  Meta,
} from './schemas/stats.schemas.js';

const PLAYERS_PER_MATCH = 10;

const SOURCES = { pro: MatchSource.PRO, public: MatchSource.PUBLIC } as const;

const toPatch = (patch: { id: number; name: string; releasedAt: Date }) => ({
  ...patch,
  releasedAt: patch.releasedAt.toISOString(),
});

const ratio = (part: number, total: number) =>
  total > 0 ? Math.round((part / total) * 10000) / 10000 : 0;

/**
 * Statistics of the current patch. The worker rebuilds them from the stored
 * matches (refresh), so the API only reads small, pre-aggregated tables.
 */
@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Replaces the statistics with the matches of the patch: every pro match
   * (there are few of them) and the public matches started since the date
   * (the window). The rest is removed, so only the current meta counts.
   */
  async refresh(patchId: number, publicSince: Date): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.heroStat.deleteMany(),
      this.prisma.heroItemStat.deleteMany(),
      this.prisma.heroDailyStat.deleteMany(),
      this.prisma.heroMatchupStat.deleteMany(),
      this.prisma.heroItemTimingStat.deleteMany(),
      this.prisma.heroSkillBuildStat.deleteMany(),
      this.prisma.$executeRaw`
        INSERT INTO hero_stats (patch_id, source, hero_id, matches, wins, updated_at)
        SELECT patch_id, source, hero_id, count(*), count(*) FILTER (WHERE win), now()
        FROM match_players
        WHERE patch_id = ${patchId} AND (source = 'PRO' OR start_time >= ${publicSince})
        GROUP BY patch_id, source, hero_id`,
      // each item once per player (two of the same item count once), with
      // the time of its first purchase when the match was parsed
      this.prisma.$executeRaw`
        INSERT INTO hero_item_stats (patch_id, source, hero_id, item_id, matches, wins,
          purchase_time_sum, purchase_time_count)
        SELECT p.patch_id, p.source, p.hero_id, i.item_id, count(*),
          count(*) FILTER (WHERE p.win), coalesce(sum(t.time), 0), count(t.time)
        FROM match_players p
        CROSS JOIN LATERAL (SELECT DISTINCT unnest(p.items) AS item_id) i
        CROSS JOIN LATERAL (
          SELECT p.purchase_times[array_position(p.purchase_items, i.item_id)] AS time
        ) t
        WHERE p.patch_id = ${patchId} AND (p.source = 'PRO' OR p.start_time >= ${publicSince})
        GROUP BY p.patch_id, p.source, p.hero_id, i.item_id`,
      // per day, rank (tens of the average rank tier; pro matches have none)
      // and duration: under 35 minutes, 35 to 50, 50 or more
      this.prisma.$executeRaw`
        INSERT INTO hero_daily_stats (patch_id, day, source, rank_bracket,
          duration_bucket, hero_id, matches, wins)
        SELECT p.patch_id, (p.start_time AT TIME ZONE 'UTC')::date, p.source,
          coalesce(m.avg_rank_tier / 10, 0),
          CASE WHEN m.duration < 2100 THEN 0 WHEN m.duration < 3000 THEN 1 ELSE 2 END,
          p.hero_id, count(*), count(*) FILTER (WHERE p.win)
        FROM match_players p
        JOIN matches m ON m.id = p.match_id
        WHERE p.patch_id = ${patchId} AND (p.source = 'PRO' OR p.start_time >= ${publicSince})
        GROUP BY 1, 2, 3, 4, 5, 6`,
      // each player with the other 9 of the match (slots under 128: radiant)
      this.prisma.$executeRaw`
        INSERT INTO hero_matchup_stats (patch_id, source, hero_id, other_hero_id,
          ally, matches, wins)
        SELECT a.patch_id, a.source, a.hero_id, b.hero_id,
          (a.player_slot < 128) = (b.player_slot < 128),
          count(*), count(*) FILTER (WHERE a.win)
        FROM match_players a
        JOIN match_players b ON b.match_id = a.match_id
          AND b.player_slot <> a.player_slot
        WHERE a.patch_id = ${patchId} AND (a.source = 'PRO' OR a.start_time >= ${publicSince})
        GROUP BY 1, 2, 3, 4, 5`,
      // first purchase of each item: before the horn (0) or 5 minute windows
      this.prisma.$executeRaw`
        INSERT INTO hero_item_timing_stats (patch_id, source, hero_id, item_id,
          bucket, matches, wins, time_sum)
        SELECT p.patch_id, p.source, p.hero_id, f.item_id,
          CASE WHEN f.time <= 0 THEN 0 ELSE least(f.time / 300 + 1, 13) END,
          count(*), count(*) FILTER (WHERE p.win), sum(f.time)
        FROM match_players p
        CROSS JOIN LATERAL (
          SELECT u.item_id, min(u.time) AS time
          FROM unnest(p.purchase_items, p.purchase_times) AS u(item_id, time)
          GROUP BY u.item_id
        ) f
        WHERE p.patch_id = ${patchId} AND (p.source = 'PRO' OR p.start_time >= ${publicSince}) AND cardinality(p.purchase_items) > 0
        GROUP BY 1, 2, 3, 4, 5`,
      // abilities of the first 10 levels, in order (the build)
      this.prisma.$executeRaw`
        INSERT INTO hero_skill_build_stats (patch_id, source, hero_id, build,
          matches, wins)
        SELECT patch_id, source, hero_id, array_to_string(ability_upgrades[1:10], ','),
          count(*), count(*) FILTER (WHERE win)
        FROM match_players
        WHERE patch_id = ${patchId} AND (source = 'PRO' OR start_time >= ${publicSince}) AND cardinality(ability_upgrades) >= 10
        GROUP BY 1, 2, 3, 4`,
    ]);
  }

  /** Patch of the statistics and how many matches they include */
  async getMeta(): Promise<Meta | null> {
    const latest = await this.prisma.heroStat.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { patchId: true, updatedAt: true },
    });
    if (!latest) return null;

    const [patch, totals] = await Promise.all([
      this.prisma.patch.findUniqueOrThrow({ where: { id: latest.patchId } }),
      this.prisma.heroStat.groupBy({
        by: ['source'],
        _sum: { matches: true },
      }),
    ]);
    const matchesOf = (source: MatchSource) =>
      (totals.find((total) => total.source === source)?._sum.matches ?? 0) /
      PLAYERS_PER_MATCH;

    return {
      patch: toPatch(patch),
      updatedAt: latest.updatedAt.toISOString(),
      matches: {
        pro: matchesOf(MatchSource.PRO),
        public: matchesOf(MatchSource.PUBLIC),
      },
    };
  }

  /** Heroes of the current patch, highest win rate first */
  async listHeroes({ source, minMatches }: HeroesQuery): Promise<HeroList> {
    const where = this.sourceFilter(source);
    const [patch, stats, heroes] = await Promise.all([
      this.currentPatch(),
      this.prisma.heroStat.groupBy({
        by: ['heroId'],
        where,
        _sum: { matches: true, wins: true },
      }),
      this.prisma.hero.findMany(),
    ]);
    const totalMatches =
      stats.reduce((total, stat) => total + (stat._sum.matches ?? 0), 0) /
      PLAYERS_PER_MATCH;
    const heroById = new Map(heroes.map((hero) => [hero.id, hero]));

    return {
      patch,
      heroes: stats
        .flatMap((stat) => {
          const hero = heroById.get(stat.heroId);
          const matches = stat._sum.matches ?? 0;
          const wins = stat._sum.wins ?? 0;
          if (!hero || matches < minMatches) return [];
          return [
            {
              ...hero,
              matches,
              wins,
              winRate: ratio(wins, matches),
              pickRate: ratio(matches, totalMatches),
            },
          ];
        })
        .sort(
          (a, b) =>
            b.winRate - a.winRate || b.matches - a.matches || a.id - b.id,
        ),
    };
  }

  /** A hero with the items of its final inventory, most used first */
  async getHero(
    heroId: number,
    { source, minMatches, minItemCost }: HeroQuery,
  ): Promise<HeroDetails> {
    const { patch, heroes } = await this.listHeroes({
      source,
      minMatches: 1,
    });
    const hero =
      heroes.find((h) => h.id === heroId) ??
      (await this.heroWithoutStats(heroId));

    const [itemStats, itemMatches] = await Promise.all([
      this.prisma.heroItemStat.groupBy({
        by: ['itemId'],
        where: { ...this.sourceFilter(source), heroId },
        _sum: {
          matches: true,
          wins: true,
          purchaseTimeSum: true,
          purchaseTimeCount: true,
        },
      }),
      // the share of each item is over these matches, not all of the hero
      patch
        ? this.prisma.matchPlayer.count({
            where: {
              heroId,
              patchId: patch.id,
              items: { isEmpty: false },
              ...(source && { source: SOURCES[source] }),
            },
          })
        : 0,
    ]);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemStats.map((stat) => stat.itemId) } },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    return {
      patch,
      hero,
      itemMatches,
      items: itemStats
        .flatMap((stat) => {
          const item = itemById.get(stat.itemId);
          const matches = stat._sum.matches ?? 0;
          const wins = stat._sum.wins ?? 0;
          const timeCount = stat._sum.purchaseTimeCount ?? 0;
          if (!item || matches < minMatches || (item.cost ?? 0) < minItemCost) {
            return [];
          }
          return [
            {
              ...item,
              matches,
              wins,
              winRate: ratio(wins, matches),
              avgPurchaseTime: timeCount
                ? Math.round(Number(stat._sum.purchaseTimeSum) / timeCount)
                : null,
            },
          ];
        })
        .sort(
          (a, b) =>
            b.matches - a.matches || b.winRate - a.winRate || a.id - b.id,
        ),
    };
  }

  private async heroWithoutStats(heroId: number) {
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException(`Hero ${heroId} not found`);
    return { ...hero, matches: 0, wins: 0, winRate: 0, pickRate: 0 };
  }

  private async currentPatch() {
    const latest = await this.prisma.heroStat.findFirst({
      select: { patchId: true },
    });
    if (!latest) return null;
    const patch = await this.prisma.patch.findUnique({
      where: { id: latest.patchId },
    });
    return patch && toPatch(patch);
  }

  private sourceFilter(
    source: HeroesQuery['source'],
  ): Prisma.HeroStatWhereInput & Prisma.HeroItemStatWhereInput {
    return source ? { source: SOURCES[source] } : {};
  }
}
