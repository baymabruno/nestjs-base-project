import { NotFoundException } from '@nestjs/common';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { seedStats } from '../../test/support/seed.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatsService } from './stats.service.js';

describe('StatsService', () => {
  let prisma: PrismaService;
  let service: StatsService;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new StatsService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('has no meta before the first calculation', async () => {
    expect(await service.getMeta()).toBeNull();
    expect((await service.listHeroes({ minMatches: 1 })).patch).toBeNull();
  });

  it('rejects an unknown hero', async () => {
    await expect(
      service.getHero(999, { minMatches: 1, minItemCost: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('with matches', () => {
    beforeEach(async () => {
      await seedStats(prisma);
    });

    it('reports the patch and the matches', async () => {
      expect(await service.getMeta()).toMatchObject({
        patch: { id: 60, name: '7.41' },
        matches: { pro: 1, public: 2 },
        updatedAt: expect.any(String),
      });
    });

    it('lists the heroes with win and pick rates', async () => {
      const { patch, heroes } = await service.listHeroes({ minMatches: 1 });

      expect(patch?.name).toBe('7.41');
      // only heroes 1 and 2 exist in the game data
      expect(heroes).toEqual([
        expect.objectContaining({
          id: 1,
          localizedName: 'Anti-Mage',
          matches: 3,
          wins: 2,
          winRate: 0.6667,
          pickRate: 1,
        }),
        expect.objectContaining({ id: 2, matches: 3, wins: 0, winRate: 0 }),
      ]);
    });

    it('filters by source and sample size', async () => {
      const pro = await service.listHeroes({ source: 'pro', minMatches: 1 });
      expect(pro.heroes.map((h) => [h.id, h.matches, h.wins])).toEqual([
        [1, 1, 0],
        [2, 1, 0],
      ]);

      const frequent = await service.listHeroes({ minMatches: 4 });
      expect(frequent.heroes).toEqual([]);
    });

    it('returns a hero with its items', async () => {
      const { hero, itemMatches, items } = await service.getHero(1, {
        minMatches: 1,
        minItemCost: 0,
      });

      expect(hero).toMatchObject({ id: 1, matches: 3 });
      // only the pro match has the items
      expect(itemMatches).toBe(1);
      // the items come from the pro match (the only one with details)
      expect(items).toEqual([
        expect.objectContaining({
          id: 1,
          displayName: 'Blink Dagger',
          matches: 1,
          wins: 0,
          avgPurchaseTime: 1200,
        }),
        expect.objectContaining({ id: 145, avgPurchaseTime: 600 }),
      ]);
    });

    it('filters the items by cost and sample size', async () => {
      const expensive = await service.getHero(1, {
        minMatches: 1,
        minItemCost: 3000,
      });
      expect(expensive.items.map((item) => item.id)).toEqual([145]);

      const frequent = await service.getHero(1, {
        minMatches: 2,
        minItemCost: 0,
      });
      expect(frequent.items).toEqual([]);
    });

    it('has no items for matches without details', async () => {
      const { items } = await service.getHero(1, {
        source: 'public',
        minMatches: 1,
        minItemCost: 0,
      });

      // public matches have no details in the seed
      expect(items).toEqual([]);
    });

    it('returns a hero without matches', async () => {
      await prisma.heroStat.deleteMany({ where: { heroId: 2 } });

      const { hero } = await service.getHero(2, {
        minMatches: 1,
        minItemCost: 0,
      });

      expect(hero).toMatchObject({ id: 2, matches: 0, winRate: 0 });
    });

    it('keeps only the statistics of the latest calculation', async () => {
      await service.refresh(59, new Date(0));

      expect(await prisma.heroStat.count()).toBe(0);
      expect(await prisma.heroItemStat.count()).toBe(0);
    });
  });
});
