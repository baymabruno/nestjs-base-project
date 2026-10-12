import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
  NOW,
  proMatch,
  publicMatch,
} from '../../test/support/opendota-fakes.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MetaService } from './meta.service.js';
import { StatsService } from './stats.service.js';

const DAY = 86400;
const now = new Date(NOW * 1000);
const query = { days: 8, minMatches: 1 };

describe('MetaService', () => {
  let prisma: PrismaService;
  let service: MetaService;
  let matches: MatchesService;
  let refresh: () => Promise<void>;

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new MetaService(prisma);
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

  // hero 1 plays on radiant and hero 2 on dire (see publicMatch)
  const radiantWins = (id: number, overrides = {}) =>
    publicMatch({ match_id: id, radiant_win: true, ...overrides });
  const direWins = (id: number, overrides = {}) =>
    publicMatch({ match_id: id, radiant_win: false, ...overrides });

  it('is empty before the first calculation', async () => {
    const result = await service.getHeroes(query, now);

    expect(result).toMatchObject({ patch: null, matches: 0, heroes: [] });
    expect(result.to).toBe(now.toISOString().slice(0, 10));
  });

  it('calculates the rates of the period', async () => {
    await matches.addPublicMatches([
      radiantWins(1),
      radiantWins(2),
      radiantWins(3),
      direWins(4),
    ]);
    await refresh();

    const result = await service.getHeroes(query, now);

    expect(result.patch?.name).toBe('7.41');
    expect(result.matches).toBe(4);
    // only heroes 1 and 2 exist in the game data
    expect(result.heroes.map((hero) => hero.id)).toEqual([1, 2]);
    expect(result.heroes[0]).toMatchObject({
      localizedName: 'Anti-Mage',
      matches: 4,
      wins: 3,
      winRate: 0.75,
      pickRate: 1,
    });
    expect(result.heroes[0].winRateLow).toBeCloseTo(0.3006, 4);
  });

  it('leaves out the matches outside the period', async () => {
    await matches.addPublicMatches([
      radiantWins(1),
      radiantWins(2, { start_time: NOW - 10 * DAY }),
    ]);
    await refresh();

    expect((await service.getHeroes(query, now)).matches).toBe(1);
    expect((await service.getHeroes({ ...query, days: 30 }, now)).matches).toBe(
      2,
    );
  });

  it('separates the win rate by game duration', async () => {
    await matches.addPublicMatches([
      radiantWins(1, { duration: 30 * 60 }),
      direWins(2, { duration: 40 * 60 }),
      radiantWins(3, { duration: 55 * 60 }),
    ]);
    await refresh();

    const [antiMage] = (await service.getHeroes(query, now)).heroes;

    expect(antiMage.durations).toEqual({
      short: { matches: 1, winRate: 1 },
      medium: { matches: 1, winRate: 0 },
      long: { matches: 1, winRate: 1 },
    });
  });

  it('filters by source and rank', async () => {
    await matches.addPublicMatches([
      radiantWins(1, { avg_rank_tier: 75 }),
      radiantWins(2, { avg_rank_tier: 81 }),
    ]);
    await matches.addProMatches([proMatch({ match_id: 3 })]);
    await prisma.matchPlayer.createMany({
      data: [1, 2].map((heroId, index) => ({
        matchId: 3n,
        playerSlot: index * 128,
        heroId,
        win: index === 1,
        source: 'PRO' as const,
        patchId: 60,
        startTime: now,
      })),
    });
    await refresh();

    const total = async (filters: object) =>
      (await service.getHeroes({ ...query, ...filters }, now)).heroes[0]
        .matches;
    expect(await total({})).toBe(3);
    expect(await total({ source: 'pro' })).toBe(1);
    expect(await total({ source: 'public' })).toBe(2);
    expect(await total({ bracket: 'divine' })).toBe(1);
    expect(await total({ bracket: 'immortal' })).toBe(1);
  });

  it('reports the daily results and the trend', async () => {
    await matches.addPublicMatches([
      // first half of a 4 day period: 0 wins of 1
      direWins(1, { start_time: NOW - 3 * DAY }),
      // second half: 2 wins of 2
      radiantWins(2, { start_time: NOW - DAY }),
      radiantWins(3),
    ]);
    await refresh();

    const [antiMage] = (await service.getHeroes({ ...query, days: 4 }, now))
      .heroes;

    expect(antiMage.trend).toBe(1);
    expect(antiMage.daily.map((day) => [day.matches, day.winRate])).toEqual([
      [1, 0],
      [0, null],
      [1, 1],
      [1, 1],
    ]);
  });

  it('has no trend for a single day', async () => {
    await matches.addPublicMatches([radiantWins(1)]);
    await refresh();

    const [antiMage] = (await service.getHeroes({ ...query, days: 1 }, now))
      .heroes;

    expect(antiMage.trend).toBeNull();
    expect(antiMage.daily).toHaveLength(1);
  });

  it('ranks by the adjusted win rate and applies the minimum sample', async () => {
    // hero 1 wins 3 of 4 (75%); hero 2 plays only the last one and wins it
    // (100%), but with 1 match its adjusted win rate is lower
    const withoutHero2 = { dire_team: [7, 8, 9, 10, 11] };
    await matches.addPublicMatches([
      radiantWins(1, withoutHero2),
      radiantWins(2, withoutHero2),
      radiantWins(3, withoutHero2),
      direWins(4),
    ]);
    await refresh();

    const ranked = await service.getHeroes(query, now);
    expect(ranked.heroes.map((hero) => [hero.id, hero.winRate])).toEqual([
      [1, 0.75],
      [2, 1],
    ]);

    const frequent = await service.getHeroes({ ...query, minMatches: 5 }, now);
    expect(frequent.heroes).toEqual([]);
  });
});
