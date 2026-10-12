import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StratzClient } from './stratz.client.js';

/**
 * Items of each hero in each position (STRATZ, latest week): the minute of
 * the first purchase (hero_role_item_timings) and the starting items
 * (hero_role_starting_items)
 */
@Injectable()
export class RoleItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stratz: StratzClient,
  ) {}

  /** Replaces both tables; returns how many rows were stored */
  async sync(): Promise<number> {
    const heroes = await this.prisma.hero.findMany({ select: { id: true } });
    if (heroes.length === 0) return 0;
    const heroIds = heroes.map((hero) => hero.id);
    const timings = await this.stratz.getRoleItemTimings(heroIds);
    const starting = await this.stratz.getRoleStartingItems(heroIds);

    const [, stored, , storedStarting] = await this.prisma.$transaction([
      this.prisma.heroRoleItemTiming.deleteMany(),
      this.prisma.heroRoleItemTiming.createMany({
        data: timings,
        skipDuplicates: true,
      }),
      this.prisma.heroRoleStartingItem.deleteMany(),
      this.prisma.heroRoleStartingItem.createMany({
        data: starting,
        skipDuplicates: true,
      }),
    ]);
    return stored.count + storedStarting.count;
  }
}
