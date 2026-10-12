import { ConfigService } from '@nestjs/config';
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
import { Env } from '../config/env.validation.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchesService } from '../matches/matches.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { MetaService } from './meta.service.js';
import { StatsService } from './stats.service.js';

const HOUR = 3600;
const now = new Date(NOW * 1000);
const query = { minMatches: 1 };

describe('MetaService', () => {
  let prisma: PrismaService;
  let service: MetaService;
  let matches: MatchesService;
  // the window of the tests: the last 24 hours before NOW
  const refresh = () =>
    new StatsService(prisma).refresh(
      60,
      new Date(now.getTime() - 24 * HOUR * 1000),
    );

  beforeAll(() => {
    prisma = createTestPrisma();
    service = new MetaService(
      prisma,
      new ConfigService({ PUBLIC_WINDOW_HOURS: 24 }) as ConfigService<
        Env,
        true
      >,
    );
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const gameData = new GameDataService(prisma, fakeOpenDota());
    await gameData.sync();
    matches = new MatchesService(prisma, gameData);
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
    expect(await service.getHeroes(query)).toEqual({
      patch: null,
      publicWindowHours: 24,
      matches: 0,
      heroes: [],
    });
  });

  it('calculates the rates of the window', async () => {
    await matches.addPublicMatches([
      radiantWins(1),
      radiantWins(2),
      radiantWins(3),
      direWins(4),
    ]);
    await refresh();

    const result = await service.getHeroes(query);

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
    // best adjusted win rate (70) and a tie in the pick rate (half of 30)
    expect(result.heroes[0]).toMatchObject({ score: 85, tier: 'S' });
  });

  it('leaves out the matches older than the window', async () => {
    await matches.addPublicMatches([
      radiantWins(1, { start_time: NOW - 2 * HOUR }),
      radiantWins(2, { start_time: NOW - 30 * HOUR }),
    ]);
    await refresh();

    expect((await service.getHeroes(query)).matches).toBe(1);
  });

  it('counts the pro matches of the whole patch', async () => {
    const started = new Date(now.getTime() - 30 * HOUR * 1000);
    await matches.addProMatches([
      proMatch({ match_id: 3, start_time: started.getTime() / 1000 }),
    ]);
    await prisma.matchPlayer.createMany({
      data: [1, 2].map((heroId, index) => ({
        matchId: 3n,
        playerSlot: index * 128,
        heroId,
        win: index === 1,
        source: 'PRO' as const,
        patchId: 60,
        startTime: started,
      })),
    });
    await refresh();

    const [hero] = (await service.getHeroes({ ...query, source: 'pro' }))
      .heroes;
    expect(hero.matches).toBe(1);
  });

  it('separates the win rate by game duration', async () => {
    await matches.addPublicMatches([
      radiantWins(1, { duration: 30 * 60 }),
      direWins(2, { duration: 40 * 60 }),
      radiantWins(3, { duration: 55 * 60 }),
    ]);
    await refresh();

    const [antiMage] = (await service.getHeroes(query)).heroes;

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
      (await service.getHeroes({ ...query, ...filters })).heroes[0].matches;
    expect(await total({})).toBe(3);
    expect(await total({ source: 'pro' })).toBe(1);
    expect(await total({ source: 'public' })).toBe(2);
    expect(await total({ bracket: 'divine' })).toBe(1);
    expect(await total({ bracket: 'immortal' })).toBe(1);
  });

  it('ranks by the score and applies the minimum sample', async () => {
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

    const ranked = await service.getHeroes(query);
    expect(ranked.heroes.map((hero) => [hero.id, hero.winRate])).toEqual([
      [1, 0.75],
      [2, 1],
    ]);

    const frequent = await service.getHeroes({ minMatches: 5 });
    expect(frequent.heroes).toEqual([]);
  });
});
