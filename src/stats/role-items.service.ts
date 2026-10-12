import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { HeroRoleItems, HeroRoleItemsQuery } from './schemas/stats.schemas.js';

const BUCKET_MINUTES = 5;

const round = (value: number) => Math.round(value * 10000) / 10000;
const ratio = (part: number, total: number) =>
  total > 0 ? round(part / total) : 0;

/**
 * Hero page with a role selected: the starting items and the minute of the
 * first purchase of each item in the position (STRATZ, latest week)
 */
@Injectable()
export class RoleItemsQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getHeroRoleItems(
    heroId: number,
    { position, minItemCost }: HeroRoleItemsQuery,
  ): Promise<HeroRoleItems> {
    const hero = await this.prisma.hero.findUnique({ where: { id: heroId } });
    if (!hero) throw new NotFoundException(`Hero ${heroId} not found`);

    const [starting, timings] = await Promise.all([
      this.prisma.heroRoleStartingItem.findMany({
        where: { heroId, position },
      }),
      this.prisma.heroRoleItemTiming.findMany({
        where: { heroId, position },
        orderBy: { minute: 'asc' },
      }),
    ]);
    const items = await this.prisma.item.findMany({
      where: {
        id: {
          in: [...new Set([...starting, ...timings].map((row) => row.itemId))],
        },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        cost: true,
        isFinal: true,
      },
    });
    const itemById = new Map(items.map((item) => [item.id, item]));

    const byItem = new Map<number, typeof timings>();
    for (const row of timings) {
      byItem.set(row.itemId, [...(byItem.get(row.itemId) ?? []), row]);
    }

    return {
      startingItems: starting
        .flatMap((row) => {
          const item = itemById.get(row.itemId);
          if (!item) return [];
          return [
            {
              ...item,
              matches: row.matches,
              wins: row.wins,
              winRate: ratio(row.wins, row.matches),
            },
          ];
        })
        .sort((a, b) => b.matches - a.matches),
      timings: [...byItem.entries()]
        .flatMap(([itemId, rows]) => {
          const item = itemById.get(itemId);
          if (!item || (item.cost ?? 0) < minItemCost) return [];
          const buckets = new Map<number, { matches: number; wins: number }>();
          let matches = 0;
          let wins = 0;
          let minutes = 0;
          for (const row of rows) {
            matches += row.matches;
            wins += row.wins;
            minutes += row.minute * row.matches;
            const bucket = Math.floor(row.minute / BUCKET_MINUTES);
            const totals = buckets.get(bucket) ?? { matches: 0, wins: 0 };
            totals.matches += row.matches;
            totals.wins += row.wins;
            buckets.set(bucket, totals);
          }
          return [
            {
              ...item,
              matches,
              wins,
              winRate: ratio(wins, matches),
              avgTime: Math.round((minutes / matches) * 60),
              timings: [...buckets.entries()].map(([bucket, totals]) => ({
                fromMinute: bucket * BUCKET_MINUTES,
                toMinute: (bucket + 1) * BUCKET_MINUTES,
                matches: totals.matches,
                winRate: ratio(totals.wins, totals.matches),
              })),
            },
          ];
        })
        .sort((a, b) => b.matches - a.matches),
    };
  }
}
