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
import { MatchSource } from '../generated/prisma/client.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  OpenDotaClient,
  OpenDotaRateLimitError,
} from '../opendota/opendota.client.js';
import { ProMatch, PublicMatch } from '../opendota/opendota.schemas.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BackfillService,
  DEFAULT_BACKFILL_DAYS,
  parseBackfillDays,
} from './backfill.service.js';

const DAY = 86400;
const now = new Date(NOW * 1000);

/** Pages of matches going back in time: one match per day, newest first */
const pager = <T extends { match_id: number }>(
  matches: T[],
  pageSize: number,
) =>
  vi.fn(async (lessThan?: number) =>
    matches
      .filter((match) => lessThan === undefined || match.match_id < lessThan)
      .slice(0, pageSize),
  );

// match n started n days ago; the newest has the highest id
const proDays = (days: number) =>
  Array.from({ length: days }, (_, n) =>
    proMatch({ match_id: 1000 - n, start_time: NOW - n * DAY - 60 }),
  );
const publicDays = (days: number) =>
  Array.from({ length: days }, (_, n) =>
    publicMatch({ match_id: 5000 - n, start_time: NOW - n * DAY - 60 }),
  );

describe('parseBackfillDays', () => {
  it('uses 1 day by default', () => {
    expect(parseBackfillDays(undefined, 30)).toBe(DEFAULT_BACKFILL_DAYS);
    expect(parseBackfillDays('', 30)).toBe(1);
  });

  it('accepts a number of days up to the retention', () => {
    expect(parseBackfillDays('30', 30)).toBe(30);
  });

  it.each(['0', '-1', '2.5', 'abc'])('rejects "%s"', (value) => {
    expect(() => parseBackfillDays(value, 30)).toThrow('Invalid number');
  });

  it('rejects more days than the retention', () => {
    expect(() => parseBackfillDays('31', 30)).toThrow('MATCH_RETENTION_DAYS');
  });
});

describe('BackfillService', () => {
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

  const createService = (client: Partial<OpenDotaClient>) => {
    const openDota = fakeOpenDota({
      remainingDailyRequests: 2000,
      getProMatches: pager<ProMatch>([], 100),
      getPublicMatches: vi.fn(async () => []),
      ...client,
    } as Partial<OpenDotaClient>);
    const gameData = new GameDataService(prisma, openDota);
    const service = new BackfillService(
      openDota,
      gameData,
      new MatchesService(prisma, gameData),
      prisma,
      new ConfigService({
        PUBLIC_MIN_RANK_TIER: 70,
        OPENDOTA_DAILY_RESERVE: 100,
      }) as ConfigService<Env, true>,
    );
    // no real waiting in the tests
    const pause = vi
      .spyOn(service as unknown as { pause: () => Promise<void> }, 'pause')
      .mockResolvedValue();
    return { service, pause, openDota };
  };

  const publicPager = (matches: PublicMatch[], pageSize: number) => {
    const page = pager(matches, pageSize);
    return vi.fn(async ({ lessThanMatchId }: { lessThanMatchId?: number }) =>
      page(lessThanMatchId),
    );
  };

  const count = (source: MatchSource) =>
    prisma.match.count({ where: { source } });

  it('loads the pro matches of the period, page by page', async () => {
    const getProMatches = pager(proDays(20), 3);
    const { service } = createService({ getProMatches });

    const { pro } = await service.run(7, now);

    expect(pro).toMatchObject({ added: 7, pages: 3, complete: true });
    expect(await count(MatchSource.PRO)).toBe(7);
    expect(getProMatches).toHaveBeenNthCalledWith(1, undefined);
    expect(getProMatches).toHaveBeenNthCalledWith(2, 998);
  });

  it('stops at the end of the list', async () => {
    const { service } = createService({
      getProMatches: pager(proDays(4), 3),
    });

    const { pro } = await service.run(7, now);

    expect(pro).toMatchObject({ added: 4, pages: 2, complete: true });
  });

  it('loads the wanted public matches of the period', async () => {
    const matches = publicDays(10);
    matches[1] = { ...matches[1], avg_rank_tier: 50 };
    const getPublicMatches = publicPager(matches, 4);
    const { service } = createService({ getPublicMatches });

    const result = await service.run(5, now);

    // 5 days, one of them below the minimum rank
    expect(result.public).toMatchObject({ added: 4, complete: true });
    expect(getPublicMatches).toHaveBeenCalledWith({
      minRank: 70,
      lessThanMatchId: undefined,
    });
  });

  it('continues from the oldest public match stored', async () => {
    const getPublicMatches = publicPager(publicDays(10), 100);
    const { service } = createService({ getPublicMatches });
    const gameData = new GameDataService(prisma, fakeOpenDota());
    await gameData.sync();
    // stored 2 days ago (the worker stores the newer ones)
    await new MatchesService(prisma, gameData).addPublicMatches([
      publicDays(3)[2],
    ]);

    const result = await service.run(5, now);

    expect(getPublicMatches).toHaveBeenCalledWith({
      minRank: 70,
      lessThanMatchId: 4998,
    });
    // days 3 and 4 added
    expect(result.public.added).toBe(2);
    expect(await count(MatchSource.PUBLIC)).toBe(3);
  });

  it('skips the public matches when the period is already loaded', async () => {
    const getPublicMatches = publicPager(publicDays(10), 100);
    const { service } = createService({ getPublicMatches });
    await service.run(5, now);
    getPublicMatches.mockClear();

    const result = await service.run(3, now);

    expect(result.public).toMatchObject({ pages: 0, complete: true });
    expect(getPublicMatches).not.toHaveBeenCalled();
  });

  it('leaves half of the quota for the worker', async () => {
    // each page costs one request: 1100 left, reserve 100 -> stops at 600
    let remaining = 1100;
    const page = pager(publicDays(30), 1);
    const { service, openDota } = createService({
      getPublicMatches: vi.fn(async ({ lessThanMatchId }) => {
        remaining -= 100;
        return page(lessThanMatchId);
      }),
    } as Partial<OpenDotaClient>);
    Object.defineProperty(openDota, 'remainingDailyRequests', {
      get: () => remaining,
    });

    const result = await service.run(30, now);

    expect(result.public).toMatchObject({ pages: 5, complete: false });
    expect(remaining).toBe(600);
  });

  it('does not start without quota', async () => {
    const getProMatches = vi.fn();
    const { service } = createService({
      remainingDailyRequests: 100,
      getProMatches,
    } as Partial<OpenDotaClient>);

    const { pro } = await service.run(7, now);

    expect(pro).toMatchObject({ pages: 0, complete: false });
    expect(getProMatches).not.toHaveBeenCalled();
  });

  it('tries again after a rate limit', async () => {
    const getProMatches = vi
      .fn()
      .mockRejectedValueOnce(new OpenDotaRateLimitError())
      .mockResolvedValue([]);
    const { service } = createService({ getProMatches });

    const { pro } = await service.run(7, now);

    expect(getProMatches).toHaveBeenCalledTimes(2);
    expect(pro.complete).toBe(true);
  });

  it('stops when the rate limit is reached again', async () => {
    const { service } = createService({
      getProMatches: vi.fn().mockRejectedValue(new OpenDotaRateLimitError()),
    });

    const { pro } = await service.run(7, now);

    expect(pro.complete).toBe(false);
  });

  it('fails on other errors', async () => {
    const { service } = createService({
      getProMatches: vi.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(service.run(7, now)).rejects.toThrow('offline');
  });

  it('rethrows other errors on the retry', async () => {
    const { service } = createService({
      getProMatches: vi
        .fn()
        .mockRejectedValueOnce(new OpenDotaRateLimitError())
        .mockRejectedValue(new Error('offline')),
    });

    await expect(service.run(7, now)).rejects.toThrow('offline');
  });
});
