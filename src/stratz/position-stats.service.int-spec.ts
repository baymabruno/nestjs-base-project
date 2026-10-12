import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeStratz } from '../../test/support/opendota-fakes.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PositionStatsService } from './position-stats.service.js';

const row = (day: string, heroId: number, matches = 10) => ({
  day: new Date(`${day}T00:00:00Z`),
  position: 1,
  rankBracket: 7,
  heroId,
  matches,
  wins: 5,
});

describe('PositionStatsService', () => {
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

  it('reports whether STRATZ is configured', () => {
    expect(new PositionStatsService(prisma, fakeStratz()).isConfigured).toBe(
      true,
    );
    expect(
      new PositionStatsService(prisma, fakeStratz([], false)).isConfigured,
    ).toBe(false);
  });

  it('replaces everything with the latest day', async () => {
    await new PositionStatsService(
      prisma,
      fakeStratz([row('2026-10-09', 1), row('2026-10-09', 2)]),
    ).sync();

    const stored = await new PositionStatsService(
      prisma,
      fakeStratz([row('2026-10-10', 1, 80)]),
    ).sync();

    expect(stored).toBe(1);
    const rows = await prisma.heroPositionDailyStat.findMany();
    expect(
      rows.map((r) => [r.day.toISOString().slice(0, 10), r.matches]),
    ).toEqual([['2026-10-10', 80]]);
  });

  it('stores nothing when STRATZ has no data', async () => {
    expect(await new PositionStatsService(prisma, fakeStratz()).sync()).toBe(0);
  });
});
