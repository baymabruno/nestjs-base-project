import { ConfigService } from '@nestjs/config';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
  fakeStratz,
  matchDetails,
  NOW,
  proMatch,
  publicMatch,
} from '../../test/support/opendota-fakes.js';
import { Env } from '../config/env.validation.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { DetailsStatus } from '../generated/prisma/client.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  OpenDotaClient,
  OpenDotaRateLimitError,
} from '../opendota/opendota.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StatsService } from '../stats/stats.service.js';
import { PositionStatsService } from '../stratz/position-stats.service.js';
import { RoleItemsService } from '../stratz/role-items.service.js';
import { TalentStatsService } from '../stratz/talent-stats.service.js';
import { IngestionService } from './ingestion.service.js';

const now = new Date(NOW * 1000);

const settings = {
  PUBLIC_MIN_RANK_TIER: 70,
  DETAILS_PER_MINUTE: 30,
  OPENDOTA_DAILY_RESERVE: 100,
  PUBLIC_WINDOW_HOURS: 24,
};

describe('IngestionService', () => {
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

  const createService = (openDota: Partial<OpenDotaClient> = {}) => {
    const client = fakeOpenDota({
      remainingDailyRequests: 2000,
      ...openDota,
    } as Partial<OpenDotaClient>);
    const gameData = new GameDataService(prisma, client);
    const service = new IngestionService(
      client,
      gameData,
      new MatchesService(prisma, gameData),
      new StatsService(prisma),
      new PositionStatsService(
        prisma,
        fakeStratz([
          {
            day: new Date('2026-10-10T00:00:00Z'),
            position: 1,
            rankBracket: 7,
            heroId: 1,
            matches: 10,
            wins: 6,
          },
        ]),
      ),
      new TalentStatsService(
        prisma,
        fakeStratz([], true, [
          { heroId: 1, position: 0, abilityId: 6001, matches: 10, wins: 6 },
        ]),
      ),
      new RoleItemsService(prisma, fakeStratz()),
      new ConfigService(settings) as ConfigService<Env, true>,
    );
    return { service, gameData };
  };

  it('loads the game data before storing the first matches', async () => {
    const { service, gameData } = createService({
      getProMatches: async () => [proMatch()],
    });

    expect(await service.collectProMatches(now)).toBe(1);
    expect(gameData.isLoaded).toBe(true);
  });

  it('keeps only ranked All Pick public matches of the minimum rank', async () => {
    const getPublicMatches = vi.fn(async () => [
      publicMatch({ match_id: 1 }),
      publicMatch({ match_id: 2, avg_rank_tier: 65 }),
      publicMatch({ match_id: 3, avg_rank_tier: null }),
      publicMatch({ match_id: 4, game_mode: 23 }),
      publicMatch({ match_id: 5, lobby_type: 0 }),
      publicMatch({ match_id: 6, dire_team: [2, 7, 8, 9] }),
    ]);
    const { service } = createService({ getPublicMatches });

    expect(await service.collectPublicMatches(now)).toBe(1);
    expect(getPublicMatches).toHaveBeenCalledWith({ minRank: 70 });
  });

  it('fetches the details of the pending matches', async () => {
    const { service } = createService({
      getProMatches: async () => [proMatch()],
      getMatch: async (id: number) => matchDetails(id),
    });
    await service.collectProMatches(now);

    expect(await service.fetchDetails(now)).toBe(1);
    expect(await prisma.matchPlayer.count()).toBe(10);
  });

  it('registers a failure and continues with the next match', async () => {
    const { service } = createService({
      getProMatches: async () => [
        proMatch({ match_id: 1 }),
        proMatch({ match_id: 2 }),
      ],
      getMatch: async (id: number) => {
        if (id === 1) throw new Error('not found');
        return matchDetails(id);
      },
    });
    await service.collectProMatches(now);

    expect(await service.fetchDetails(now)).toBe(1);
    expect(
      await prisma.match.findUniqueOrThrow({ where: { id: 1n } }),
    ).toMatchObject({
      detailsStatus: DetailsStatus.PENDING,
      detailsAttempts: 1,
    });
  });

  it('stops when the rate limit is reached', async () => {
    const getMatch = vi.fn(async () => {
      throw new OpenDotaRateLimitError();
    });
    const { service } = createService({
      getProMatches: async () => [
        proMatch({ match_id: 1 }),
        proMatch({ match_id: 2 }),
      ],
      getMatch,
    });
    await service.collectProMatches(now);

    expect(await service.fetchDetails(now)).toBe(0);
    expect(getMatch).toHaveBeenCalledTimes(1);
    // not counted as a failure of the match
    expect(
      await prisma.match.findUniqueOrThrow({ where: { id: 1n } }),
    ).toMatchObject({ detailsAttempts: 0 });
  });

  it('does not fetch details without quota', async () => {
    const getMatch = vi.fn();
    const { service } = createService({
      remainingDailyRequests: 100,
      getMatch,
    } as Partial<OpenDotaClient>);

    expect(await service.fetchDetails(now)).toBe(0);
    expect(getMatch).not.toHaveBeenCalled();
  });

  it('keeps the public matches of the window and the pro ones of the patch', async () => {
    const { service } = createService({
      getProMatches: async () => [
        proMatch({ match_id: 1 }),
        proMatch({ match_id: 2, start_time: NOW - 25 * 3600 }),
        // before the release of the current patch
        proMatch({ match_id: 5, start_time: NOW - 200 * 86400 }),
      ],
      getPublicMatches: async () => [
        publicMatch({ match_id: 3 }),
        publicMatch({ match_id: 4, start_time: NOW - 25 * 3600 }),
      ],
    });

    expect(await service.collectProMatches(now)).toBe(2);
    expect(await service.collectPublicMatches(now)).toBe(1);
  });

  it('deletes the old public matches and the pro ones of older patches', async () => {
    const { service, gameData } = createService();
    await gameData.sync();
    // stored directly: the collection already leaves the old ones out
    const matches = new MatchesService(prisma, gameData);
    await matches.addPublicMatches([
      publicMatch({ match_id: 1, start_time: NOW - 25 * 3600 }),
      publicMatch({ match_id: 2, start_time: NOW - 23 * 3600 }),
    ]);
    await matches.addProMatches([
      proMatch({ match_id: 3, start_time: NOW - 25 * 3600 }),
      proMatch({ match_id: 4, start_time: NOW - 200 * 86400 }),
    ]);

    expect(await service.deleteExpiredMatches(now)).toBe(2);
    expect(
      (await prisma.match.findMany({ orderBy: { id: 'asc' } })).map((match) =>
        Number(match.id),
      ),
    ).toEqual([2, 3]);
  });

  it('splits the details between pro and public matches', async () => {
    const getMatch = vi.fn(async (id: number) => matchDetails(id));
    const { service } = createService({
      remainingDailyRequests: 2000,
      getProMatches: async () =>
        [1, 2, 3, 4].map((id) => proMatch({ match_id: id })),
      getPublicMatches: async () =>
        [11, 12, 13, 14].map((id) => publicMatch({ match_id: id })),
      getMatch,
    } as Partial<OpenDotaClient>);
    await service.collectProMatches(now);
    await service.collectPublicMatches(now);
    vi.spyOn(service, 'detailsBudget').mockReturnValue(4);

    expect(await service.fetchDetails(now)).toBe(4);
    const requested = getMatch.mock.calls.map(([id]) => id);
    expect(requested.filter((id) => id < 10)).toHaveLength(2);
    expect(requested.filter((id) => id > 10)).toHaveLength(2);
  });

  it('gives the unused pro half to the public matches', async () => {
    const getMatch = vi.fn(async (id: number) => matchDetails(id));
    const { service } = createService({
      getPublicMatches: async () =>
        [11, 12, 13, 14].map((id) => publicMatch({ match_id: id })),
      getMatch,
    });
    await service.collectPublicMatches(now);
    vi.spyOn(service, 'detailsBudget').mockReturnValue(4);

    expect(await service.fetchDetails(now)).toBe(4);
  });

  it('rebuilds the statistics of the current patch', async () => {
    const { service } = createService({
      getPublicMatches: async () => [publicMatch()],
    });
    await service.collectPublicMatches(now);

    await service.refreshStats(now);

    expect(await prisma.heroStat.count({ where: { patchId: 60 } })).toBe(10);
  });

  it('stores the statistics by role and the talents (STRATZ)', async () => {
    const { service, gameData } = createService();
    await gameData.sync();

    expect(service.collectsPositionStats).toBe(true);
    expect(await service.syncStratzStats()).toEqual({
      positions: 1,
      talents: 1,
      // 1 item timing and 1 starting item
      items: 2,
    });
  });

  it('syncs the game data', async () => {
    const { service } = createService();

    await service.syncGameData();

    expect(await prisma.hero.count()).toBe(2);
  });

  describe('detailsBudget', () => {
    const budget = (remaining: number | null, iso: string) =>
      createService({
        remainingDailyRequests: remaining,
      } as Partial<OpenDotaClient>).service.detailsBudget(new Date(iso));

    it('requests one match while the quota is unknown', () => {
      expect(budget(null, '2026-10-11T12:00:00Z')).toBe(1);
    });

    it('spreads the quota over the rest of the day', () => {
      // 1100 available over 720 minutes
      expect(budget(1200, '2026-10-11T12:00:00Z')).toBe(2);
    });

    it('is limited by DETAILS_PER_MINUTE', () => {
      expect(budget(2000, '2026-10-11T23:59:30Z')).toBe(30);
    });

    it('keeps the reserve', () => {
      expect(budget(100, '2026-10-11T12:00:00Z')).toBe(0);
    });
  });
});
