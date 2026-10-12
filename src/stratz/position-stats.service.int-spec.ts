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

  it('replaces the days returned and keeps the older ones', async () => {
    await new PositionStatsService(
      prisma,
      fakeStratz([row('2026-10-01', 1), row('2026-10-09', 1, 50)]),
    ).sync(30);

    const stored = await new PositionStatsService(
      prisma,
      fakeStratz([row('2026-10-09', 1, 80), row('2026-10-10', 1)]),
    ).sync(30);

    expect(stored).toBe(2);
    const rows = await prisma.heroPositionDailyStat.findMany({
      orderBy: { day: 'asc' },
    });
    expect(
      rows.map((r) => [r.day.toISOString().slice(0, 10), r.matches]),
    ).toEqual([
      ['2026-10-01', 10],
      ['2026-10-09', 80],
      ['2026-10-10', 10],
    ]);
  });

  it('stores nothing when STRATZ has no data', async () => {
    expect(await new PositionStatsService(prisma, fakeStratz()).sync(30)).toBe(
      0,
    );
  });

  it('deletes the days before a date', async () => {
    const service = new PositionStatsService(
      prisma,
      fakeStratz([row('2026-09-01', 1), row('2026-10-10', 1)]),
    );
    await service.sync(30);

    expect(await service.deleteBefore(new Date('2026-10-01'))).toBe(1);
    expect(await prisma.heroPositionDailyStat.count()).toBe(1);
  });
});
