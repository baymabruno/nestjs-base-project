import { ConfigService } from '@nestjs/config';
import {
  createTestPrisma,
  resetDatabase,
} from '../../test/support/database.js';
import {
  fakeOpenDota,
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
import { IngestionService } from './ingestion.service.js';

const settings = {
  PUBLIC_MIN_RANK_TIER: 70,
  DETAILS_PER_MINUTE: 30,
  OPENDOTA_DAILY_RESERVE: 100,
  MATCH_RETENTION_DAYS: 30,
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
      new ConfigService(settings) as ConfigService<Env, true>,
    );
    return { service, gameData };
  };

  it('loads the game data before storing the first matches', async () => {
    const { service, gameData } = createService({
      getProMatches: async () => [proMatch()],
    });

    expect(await service.collectProMatches()).toBe(1);
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

    expect(await service.collectPublicMatches()).toBe(1);
    expect(getPublicMatches).toHaveBeenCalledWith({ minRank: 70 });
  });

  it('fetches the details of the pending matches', async () => {
    const { service } = createService({
      getProMatches: async () => [proMatch()],
      getMatch: async (id: number) => matchDetails(id),
    });
    await service.collectProMatches();

    expect(await service.fetchDetails()).toBe(1);
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
    await service.collectProMatches();

    expect(await service.fetchDetails()).toBe(1);
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
    await service.collectProMatches();

    expect(await service.fetchDetails()).toBe(0);
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

    expect(await service.fetchDetails()).toBe(0);
    expect(getMatch).not.toHaveBeenCalled();
  });

  it('deletes the matches older than the retention', async () => {
    const { service } = createService({
      getPublicMatches: async () => [
        publicMatch({ match_id: 1, start_time: NOW - 31 * 86400 }),
        publicMatch({ match_id: 2, start_time: NOW - 29 * 86400 }),
      ],
    });
    await service.collectPublicMatches();

    expect(await service.deleteExpiredMatches(new Date(NOW * 1000))).toBe(1);
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
