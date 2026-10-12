import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeOpenDota, fakeStratz } from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TalentStatsService } from './talent-stats.service.js';

const now = new Date('2026-10-12T05:00:00Z');

describe('TalentStatsService', () => {
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

  const service = () =>
    new TalentStatsService(
      prisma,
      fakeStratz([], true, [
        { heroId: 1, position: 0, abilityId: 6001, matches: 100, wins: 55 },
        { heroId: 1, position: 0, abilityId: 6002, matches: 50, wins: 20 },
      ]),
    );

  it('stores nothing without heroes', async () => {
    expect(await service().sync(now)).toBe(0);
  });

  it('replaces the talents and the ability names', async () => {
    await new GameDataService(prisma, fakeOpenDota()).sync();
    await prisma.heroTalentStat.create({
      data: {
        heroId: 2,
        position: 0,
        abilityId: 9,
        matches: 1,
        wins: 1,
        updatedAt: now,
      },
    });

    expect(await service().sync(now)).toBe(2);

    expect(
      await prisma.heroTalentStat.findMany({ orderBy: { abilityId: 'asc' } }),
    ).toEqual([
      {
        heroId: 1,
        position: 0,
        abilityId: 6001,
        matches: 100,
        wins: 55,
        updatedAt: now,
      },
      {
        heroId: 1,
        position: 0,
        abilityId: 6002,
        matches: 50,
        wins: 20,
        updatedAt: now,
      },
    ]);
    expect(
      await prisma.abilityDisplayName.findUnique({
        where: { abilityId: 6003 },
      }),
    ).toEqual({ abilityId: 6003, displayName: '+15% Mana Break Burn' });
  });
});
