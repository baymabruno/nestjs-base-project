import { NotFoundException } from '@nestjs/common';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import { fakeOpenDota } from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RolesService } from './roles.service.js';

const now = new Date('2026-10-12T12:00:00Z');
const query = { minMatches: 1 };

describe('RolesService', () => {
  let prisma: PrismaService;
  let service: RolesService;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new RolesService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    // heroes 1 (Anti-Mage) and 2 (Axe); patch 7.41 since 2026-03-24
    await new GameDataService(prisma, fakeOpenDota()).sync();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const store = (
    rows: {
      day?: string;
      position?: number;
      rankBracket?: number;
      heroId: number;
      matches: number;
      wins: number;
    }[],
  ) =>
    prisma.heroPositionDailyStat.createMany({
      data: rows.map(({ day = '2026-10-10', ...row }) => ({
        position: 1,
        rankBracket: 7,
        ...row,
        day: new Date(`${day}T00:00:00Z`),
      })),
    });

  describe('getHeroes', () => {
    it('is unavailable without data', async () => {
      expect(await service.getHeroes(query, now)).toEqual({
        available: false,
        day: null,
        matches: 0,
        heroes: [],
      });
    });

    it('ranks the heroes of a role with a score and a tier', async () => {
      await store([
        { heroId: 1, matches: 1000, wins: 560 },
        { heroId: 2, matches: 1000, wins: 450 },
      ]);

      const result = await service.getHeroes({ ...query, position: 1 }, now);

      // 2 players per match in a position
      expect(result).toMatchObject({
        available: true,
        day: '2026-10-10',
        matches: 1000,
      });
      expect(result.heroes).toEqual([
        expect.objectContaining({
          id: 1,
          localizedName: 'Anti-Mage',
          winRate: 0.56,
          pickRate: 1,
          score: 85,
          tier: 'S',
        }),
        expect.objectContaining({ id: 2, winRate: 0.45, score: 15, tier: 'D' }),
      ]);
    });

    it('weights the win rate (70%) over the pick rate (30%)', async () => {
      // hero 1 wins more (55%), hero 2 is picked more
      await store([
        { heroId: 1, matches: 1000, wins: 550 },
        { heroId: 2, matches: 3000, wins: 1500 },
      ]);

      const { heroes } = await service.getHeroes(
        { ...query, position: 1 },
        now,
      );

      expect(heroes.map((hero) => [hero.id, hero.score])).toEqual([
        [1, 70],
        [2, 30],
      ]);
    });

    it('filters by position, rank and minimum sample', async () => {
      await store([
        { heroId: 1, position: 1, rankBracket: 7, matches: 100, wins: 50 },
        { heroId: 1, position: 2, rankBracket: 8, matches: 300, wins: 150 },
        { heroId: 2, position: 1, rankBracket: 7, matches: 20, wins: 10 },
      ]);

      const total = async (filters: object) =>
        (await service.getHeroes({ ...query, ...filters }, now)).heroes.map(
          (hero) => [hero.id, hero.matches],
        );
      expect(await total({})).toEqual([
        [1, 400],
        [2, 20],
      ]);
      expect(await total({ position: 2 })).toEqual([[1, 300]]);
      expect(await total({ bracket: 'divine' })).toEqual([
        [1, 100],
        [2, 20],
      ]);
      expect(await total({ minMatches: 50 })).toEqual([[1, 400]]);
    });

    it('uses only the latest day', async () => {
      await store([
        { heroId: 1, day: '2026-10-08', matches: 10, wins: 5 },
        { heroId: 1, day: '2026-10-10', matches: 20, wins: 10 },
      ]);

      const result = await service.getHeroes(query, now);

      expect(result.day).toBe('2026-10-10');
      expect(result.heroes[0].matches).toBe(20);
    });

    it('is unavailable when the latest day is before the current patch', async () => {
      await prisma.patch.create({
        data: {
          id: 61,
          name: '7.42',
          releasedAt: new Date('2026-10-11T10:00:00Z'),
        },
      });
      await store([{ heroId: 1, matches: 20, wins: 10 }]);

      expect((await service.getHeroes(query, now)).available).toBe(false);
    });

    it('gives the middle score to a single hero', async () => {
      await store([{ heroId: 1, matches: 10, wins: 5 }]);

      const [hero] = (await service.getHeroes(query, now)).heroes;

      expect(hero).toMatchObject({ score: 50, tier: 'B' });
    });
  });

  describe('getHeroRoles', () => {
    it('is unavailable without data', async () => {
      expect(await service.getHeroRoles(1, {}, now)).toMatchObject({
        available: false,
        positions: [],
        mostPlayed: null,
      });
    });

    it('returns the hero in each position with the share and the score', async () => {
      await store([
        // Anti-Mage: mostly carry, a few matches as mid
        { heroId: 1, position: 1, matches: 900, wins: 500 },
        { heroId: 1, position: 2, matches: 100, wins: 40 },
        { heroId: 2, position: 1, matches: 900, wins: 400 },
        { heroId: 2, position: 2, matches: 300, wins: 160 },
      ]);

      const result = await service.getHeroRoles(1, {}, now);

      expect(result).toMatchObject({
        available: true,
        day: '2026-10-10',
        all: { matches: 1000, wins: 540, winRate: 0.54 },
        mostPlayed: 1,
      });
      expect(result.positions).toHaveLength(5);
      expect(result.positions[0]).toEqual({
        position: 1,
        matches: 900,
        wins: 500,
        winRate: 0.5556,
        share: 0.9,
        winRateLow: expect.any(Number),
        // 900 of the 900 carry matches (2 per match)
        pickRate: 1,
        rank: 1,
        rankedHeroes: 2,
        // the best of the 2 carries: same pick rate, higher win rate
        score: 85,
        tier: 'S',
      });
      // the worst mid in win rate and in pick rate
      expect(result.positions[1]).toMatchObject({
        matches: 100,
        share: 0.1,
        rank: 2,
        score: 0,
        tier: 'D',
      });
      expect(result.positions[2]).toMatchObject({
        position: 3,
        matches: 0,
        winRate: null,
        winRateLow: null,
        rank: null,
        score: null,
      });
    });

    it('scores only the roles with at least 100 matches', async () => {
      await store([
        { heroId: 1, position: 1, matches: 99, wins: 50 },
        { heroId: 2, position: 1, matches: 500, wins: 250 },
      ]);

      const [carry] = (await service.getHeroRoles(1, {}, now)).positions;

      expect(carry).toMatchObject({ matches: 99, score: null, rank: null });
    });

    it('filters by rank', async () => {
      await store([
        { heroId: 1, position: 1, rankBracket: 7, matches: 100, wins: 50 },
        { heroId: 1, position: 1, rankBracket: 8, matches: 300, wins: 150 },
      ]);

      const result = await service.getHeroRoles(
        1,
        { bracket: 'immortal' },
        now,
      );

      expect(result.all.matches).toBe(300);
    });

    it('rejects an unknown hero', async () => {
      await expect(service.getHeroRoles(999, {}, now)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
