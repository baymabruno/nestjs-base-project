import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeOpenDota, fakeStratz } from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RoleItemsService } from './role-items.service.js';

describe('RoleItemsService', () => {
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = createTestPrisma();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('stores nothing without heroes', async () => {
    expect(await new RoleItemsService(prisma, fakeStratz()).sync()).toBe(0);
  });

  it('replaces the timings and the starting items', async () => {
    await new GameDataService(prisma, fakeOpenDota()).sync();
    await prisma.heroRoleStartingItem.create({
      data: { heroId: 2, position: 3, itemId: 1, matches: 1, wins: 1 },
    });

    expect(await new RoleItemsService(prisma, fakeStratz()).sync()).toBe(2);

    expect(await prisma.heroRoleItemTiming.findMany()).toEqual([
      {
        heroId: 1,
        position: 1,
        itemId: 145,
        minute: 14,
        matches: 300,
        wins: 160,
      },
    ]);
    expect(await prisma.heroRoleStartingItem.findMany()).toEqual([
      { heroId: 1, position: 1, itemId: 44, matches: 900, wins: 470 },
    ]);
  });
});
