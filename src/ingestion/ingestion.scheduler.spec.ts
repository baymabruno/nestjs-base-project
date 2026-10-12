import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Env } from '../config/env.validation.js';
import { IngestionScheduler } from './ingestion.scheduler.js';
import { IngestionService } from './ingestion.service.js';

describe('IngestionScheduler', () => {
  let registry: SchedulerRegistry;
  let ingestion: Record<string, ReturnType<typeof vi.fn>>;
  let scheduler: IngestionScheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    registry = new SchedulerRegistry();
    ingestion = {
      collectProMatches: vi.fn().mockResolvedValue(1),
      collectPublicMatches: vi.fn().mockResolvedValue(2),
      fetchDetails: vi.fn().mockResolvedValue(3),
      syncGameData: vi.fn().mockResolvedValue(undefined),
      deleteExpiredMatches: vi.fn().mockResolvedValue(4),
      refreshStats: vi.fn().mockResolvedValue(undefined),
    };
    const config = new ConfigService({
      PRO_MATCHES_INTERVAL_MINUTES: 15,
      PUBLIC_MATCHES_INTERVAL_MINUTES: 5,
      STATS_INTERVAL_MINUTES: 15,
    }) as ConfigService<Env, true>;
    scheduler = new IngestionScheduler(
      ingestion as unknown as IngestionService,
      registry,
      config,
    );
  });

  afterEach(() => {
    for (const name of registry.getIntervals()) registry.deleteInterval(name);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('collects the matches when it starts', async () => {
    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(0);

    expect(ingestion.collectProMatches).toHaveBeenCalledTimes(1);
    expect(ingestion.collectPublicMatches).toHaveBeenCalledTimes(1);
    expect(ingestion.refreshStats).toHaveBeenCalledTimes(1);
  });

  it('runs each job at its interval', async () => {
    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(15 * 60 * 1000);

    expect(registry.getIntervals()).toEqual([
      'pro-matches',
      'public-matches',
      'match-details',
      'stats',
    ]);
    // first run + one per interval
    expect(ingestion.collectProMatches).toHaveBeenCalledTimes(2);
    expect(ingestion.collectPublicMatches).toHaveBeenCalledTimes(4);
    expect(ingestion.fetchDetails).toHaveBeenCalledTimes(15);
    expect(ingestion.refreshStats).toHaveBeenCalledTimes(2);
  });

  it('logs only the details runs that saved matches', async () => {
    ingestion.fetchDetails.mockResolvedValue(0);
    scheduler.onApplicationBootstrap();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(Logger.prototype.log).not.toHaveBeenCalledWith(
      expect.stringContaining('Match details'),
    );
  });

  it('runs the daily jobs', async () => {
    await scheduler.syncGameData();
    await scheduler.deleteExpiredMatches();

    expect(ingestion.syncGameData).toHaveBeenCalled();
    expect(ingestion.deleteExpiredMatches).toHaveBeenCalled();
  });

  it('skips a job while it is running', async () => {
    let finish!: () => void;
    const job = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));

    const first = scheduler.run('job', job);
    await scheduler.run('job', job);
    finish();
    await first;

    expect(job).toHaveBeenCalledTimes(1);
  });

  it('logs a failed job and runs it again later', async () => {
    const job = vi.fn().mockRejectedValueOnce(new Error('offline'));

    await scheduler.run('job', job);
    await scheduler.run('job', job);

    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'Job job failed: offline',
      expect.any(String),
    );
    expect(job).toHaveBeenCalledTimes(2);
  });
});
