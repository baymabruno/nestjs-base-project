import { NotFoundException } from '@nestjs/common';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
  matchDetails,
  proMatch,
  publicMatch,
} from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HeroService } from './hero.service.js';
import { StatsService } from './stats.service.js';

const query = { minMatches: 1 };

describe('HeroService', () => {
  let prisma: PrismaService;
  let service: HeroService;
  let matches: MatchesService;
  let refresh: () => Promise<void>;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new HeroService(prisma);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const gameData = new GameDataService(prisma, fakeOpenDota());
    await gameData.sync();
    matches = new MatchesService(prisma, gameData);
    refresh = () => new StatsService(prisma).refresh(60);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Stores a parsed pro match with the given purchase log */
  async function parsedMatch(
    id: number,
    radiantWin: boolean,
    purchases: { time: number; key: string }[],
  ) {
    await matches.addProMatches([proMatch({ match_id: id })]);
    const [pending] = await matches.findPendingDetails(1);
    const details = matchDetails(id, { radiantWin });
    for (const player of details.players) player.purchase_log = purchases;
    await matches.saveDetails(pending, details);
  }

  describe('getMatchups', () => {
    // public matches: hero 1 (radiant) against hero 2 (dire)
    beforeEach(async () => {
      await matches.addPublicMatches([
        publicMatch({ match_id: 1, radiant_win: true }),
        publicMatch({ match_id: 2, radiant_win: true }),
        publicMatch({ match_id: 3, radiant_win: false }),
        // hero 2 on radiant with hero 1, as allies
        publicMatch({
          match_id: 4,
          radiant_win: true,
          radiant_team: [1, 2, 3, 4, 5],
          dire_team: [6, 7, 8, 9, 10],
        }),
      ]);
      await refresh();
    });

    it('returns the win rate against each enemy and with each ally', async () => {
      const result = await service.getMatchups(1, query);

      expect(result.hero).toEqual({ id: 1, matches: 4, winRate: 0.75 });
      // only heroes 1 and 2 exist in the game data
      expect(result.enemies).toEqual([
        expect.objectContaining({
          id: 2,
          localizedName: 'Axe',
          matches: 3,
          wins: 2,
          winRate: 0.6667,
          delta: -0.0833,
        }),
      ]);
      expect(result.enemies[0].winRateLow).toBeLessThan(0.6667);
      expect(result.enemies[0].winRateHigh).toBeGreaterThan(0.6667);
      expect(result.allies).toEqual([
        expect.objectContaining({ id: 2, matches: 1, wins: 1, winRate: 1 }),
      ]);
    });

    it('is symmetric for the enemy', async () => {
      const { enemies } = await service.getMatchups(2, query);

      expect(enemies[0]).toMatchObject({ id: 1, matches: 3, wins: 1 });
    });

    it('applies the minimum sample', async () => {
      const result = await service.getMatchups(1, { minMatches: 2 });

      expect(result.enemies).toHaveLength(1);
      expect(result.allies).toEqual([]);
    });

    it('filters by source', async () => {
      const result = await service.getMatchups(1, { ...query, source: 'pro' });

      expect(result.hero.matches).toBe(0);
      expect(result.enemies).toEqual([]);
    });
  });

  describe('getItemTimings', () => {
    it('is empty before the first calculation', async () => {
      expect(
        await service.getItemTimings(1, { ...query, minItemCost: 0 }),
      ).toEqual({ matches: 0, items: [] });
    });

    it('returns the win rate by the time of the first purchase', async () => {
      // radiant (hero 1) wins match 1 and loses match 2
      await parsedMatch(1, true, [
        { time: -60, key: 'tango' },
        { time: 600, key: 'blink' },
        { time: 700, key: 'blink' },
      ]);
      await parsedMatch(2, false, [
        { time: -30, key: 'tango' },
        { time: 1500, key: 'blink' },
      ]);
      await refresh();

      const result = await service.getItemTimings(1, {
        ...query,
        minItemCost: 0,
      });

      expect(result.matches).toBe(2);
      const blink = result.items.find((item) => item.name === 'blink');
      // only the first purchase of each match counts
      expect(blink).toMatchObject({
        matches: 2,
        wins: 1,
        winRate: 0.5,
        purchaseRate: 1,
        avgTime: 1050,
        timings: [
          { bucket: 3, fromMinute: 10, toMinute: 15, matches: 1, winRate: 1 },
          { bucket: 6, fromMinute: 25, toMinute: 30, matches: 1, winRate: 0 },
        ],
      });
      const tango = result.items.find((item) => item.name === 'tango');
      expect(tango?.timings).toEqual([
        {
          bucket: 0,
          fromMinute: null,
          toMinute: 0,
          matches: 2,
          winRate: 0.5,
        },
      ]);
    });

    it('groups the purchases after 60 minutes', async () => {
      await parsedMatch(1, true, [{ time: 4000, key: 'bfury' }]);
      await refresh();

      const [item] = (
        await service.getItemTimings(1, { ...query, minItemCost: 0 })
      ).items;

      expect(item.timings).toEqual([
        { bucket: 13, fromMinute: 60, toMinute: null, matches: 1, winRate: 1 },
      ]);
    });

    it('filters by cost and sample', async () => {
      await parsedMatch(1, true, [
        { time: -60, key: 'tango' },
        { time: 600, key: 'blink' },
      ]);
      await refresh();

      const expensive = await service.getItemTimings(1, {
        ...query,
        minItemCost: 1000,
      });
      expect(expensive.items.map((item) => item.name)).toEqual(['blink']);

      const frequent = await service.getItemTimings(1, {
        minMatches: 2,
        minItemCost: 0,
      });
      expect(frequent.items).toEqual([]);
    });
  });

  it('rejects an unknown hero', async () => {
    await expect(service.getMatchups(999, query)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.getItemTimings(999, { ...query, minItemCost: 0 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
