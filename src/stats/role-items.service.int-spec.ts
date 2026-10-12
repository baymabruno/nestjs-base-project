import { NotFoundException } from '@nestjs/common';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeOpenDota } from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoleItemsQueryService } from './role-items.service.js';

describe('RoleItemsQueryService', () => {
  let prisma: PrismaService;
  let service: RoleItemsQueryService;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new RoleItemsQueryService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    // items 1 (Blink Dagger), 44 (Tango) and 145 (Battle Fury)
    await new GameDataService(prisma, fakeOpenDota()).sync();
    await prisma.heroRoleStartingItem.createMany({
      data: [
        { heroId: 1, position: 1, itemId: 44, matches: 900, wins: 470 },
        { heroId: 1, position: 2, itemId: 1, matches: 50, wins: 20 },
      ],
    });
    await prisma.heroRoleItemTiming.createMany({
      data: [
        {
          heroId: 1,
          position: 1,
          itemId: 145,
          minute: 12,
          matches: 100,
          wins: 60,
        },
        {
          heroId: 1,
          position: 1,
          itemId: 145,
          minute: 14,
          matches: 300,
          wins: 150,
        },
        {
          heroId: 1,
          position: 1,
          itemId: 145,
          minute: 17,
          matches: 100,
          wins: 40,
        },
        { heroId: 1, position: 1, itemId: 44, minute: 0, matches: 10, wins: 5 },
      ],
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the starting items of the position', async () => {
    const { startingItems } = await service.getHeroRoleItems(1, {
      position: 1,
      minItemCost: 0,
    });

    expect(startingItems).toEqual([
      expect.objectContaining({
        id: 44,
        name: 'tango',
        matches: 900,
        winRate: 0.5222,
      }),
    ]);
  });

  it('groups the minute of the first purchase in 5 minute windows', async () => {
    const { timings } = await service.getHeroRoleItems(1, {
      position: 1,
      minItemCost: 1000,
    });

    expect(timings).toEqual([
      expect.objectContaining({
        id: 145,
        displayName: 'Battle Fury',
        matches: 500,
        wins: 250,
        winRate: 0.5,
        // (12 * 100 + 14 * 300 + 17 * 100) / 500 = 14.2 minutes
        avgTime: 852,
        timings: [
          { fromMinute: 10, toMinute: 15, matches: 400, winRate: 0.525 },
          { fromMinute: 15, toMinute: 20, matches: 100, winRate: 0.4 },
        ],
      }),
    ]);
  });

  it('rejects an unknown hero', async () => {
    await expect(
      service.getHeroRoleItems(999, { position: 1, minItemCost: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
