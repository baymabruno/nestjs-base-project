import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchSource } from '../generated/prisma/client.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  OpenDotaClient,
  OpenDotaRateLimitError,
} from '../opendota/opendota.client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_MS, isWantedPublicMatch } from './ingestion.service.js';

export const DEFAULT_BACKFILL_DAYS = 1;
// pause between pages, so the backfill and the worker together stay under
// the per-minute limit
export const PAGE_PAUSE_MS = 1000;
const PROGRESS_EVERY_PAGES = 50;

export interface BackfillProgress {
  pages: number;
  added: number;
  /** reached the requested period (false: stopped by the quota) */
  complete: boolean;
  /** start of the oldest match read */
  oldest: Date | null;
}

export interface BackfillResult {
  pro: BackfillProgress;
  public: BackfillProgress;
}

interface ListedMatch {
  match_id: number;
  start_time: number;
}

/**
 * Validates the number of days to load: a positive integer up to the
 * retention (older matches would be deleted by the next retention run).
 */
export function parseBackfillDays(
  value: string | undefined,
  retentionDays: number,
): number {
  if (value === undefined || value === '') return DEFAULT_BACKFILL_DAYS;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`Invalid number of days: "${value}"`);
  }
  if (days > retentionDays) {
    throw new Error(
      `${days} days is more than MATCH_RETENTION_DAYS (${retentionDays}): the older matches would be deleted`,
    );
  }
  return days;
}

/**
 * Loads past matches, going back page by page (less_than_match_id):
 * - pro matches from the newest one, which also fills any gap;
 * - public matches from the oldest one stored, so a new run continues where
 *   the previous one stopped. They use at most half of the requests left
 *   today, so the worker keeps fetching match details.
 * The details of the new matches are fetched by the worker, as usual.
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);
  private readonly minRankTier: number;
  private readonly dailyReserve: number;

  constructor(
    private readonly openDota: OpenDotaClient,
    private readonly gameData: GameDataService,
    private readonly matches: MatchesService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.minRankTier = config.get('PUBLIC_MIN_RANK_TIER', { infer: true });
    this.dailyReserve = config.get('OPENDOTA_DAILY_RESERVE', { infer: true });
  }

  async run(days: number, now = new Date()): Promise<BackfillResult> {
    if (!this.gameData.isLoaded) await this.gameData.sync();
    const since = new Date(now.getTime() - days * DAY_MS);

    const pro = await this.backfill(
      'pro',
      since,
      undefined,
      () => this.dailyReserve,
      (lessThan) => this.openDota.getProMatches(lessThan),
      (page) => this.matches.addProMatches(page),
    );

    const oldestPublic = await this.prisma.match.findFirst({
      where: { source: MatchSource.PUBLIC },
      orderBy: { id: 'asc' },
      select: { id: true, startTime: true },
    });
    if (oldestPublic && oldestPublic.startTime < since) {
      // the period is already loaded
      return {
        pro,
        public: {
          pages: 0,
          added: 0,
          complete: true,
          oldest: oldestPublic.startTime,
        },
      };
    }

    // half of what is left above the reserve, measured once the quota is
    // known (after the first page)
    let stopAt: number | null = null;
    const publicResult = await this.backfill(
      'public',
      since,
      oldestPublic ? Number(oldestPublic.id) : undefined,
      (remaining) => {
        stopAt ??= remaining - Math.floor((remaining - this.dailyReserve) / 2);
        return stopAt;
      },
      (lessThan) =>
        this.openDota.getPublicMatches({
          minRank: this.minRankTier,
          lessThanMatchId: lessThan,
        }),
      (page) =>
        this.matches.addPublicMatches(
          page.filter((match) => isWantedPublicMatch(match, this.minRankTier)),
        ),
    );

    return { pro, public: publicResult };
  }

  /**
   * Reads pages going back in time until the date, the end of the list or
   * the request limit (quotaFloor: requests that must be left today).
   */
  private async backfill<T extends ListedMatch>(
    name: string,
    since: Date,
    startBefore: number | undefined,
    quotaFloor: (remaining: number) => number,
    fetchPage: (lessThan?: number) => Promise<T[]>,
    store: (matches: T[]) => Promise<number>,
  ): Promise<BackfillProgress> {
    const progress: BackfillProgress = {
      pages: 0,
      added: 0,
      complete: false,
      oldest: null,
    };
    let lessThan = startBefore;

    for (;;) {
      const remaining = this.openDota.remainingDailyRequests;
      if (remaining !== null && remaining <= quotaFloor(remaining)) {
        this.logger.warn(
          `Stopping ${name} matches: daily request quota (${remaining} left)`,
        );
        return progress;
      }

      const page = await this.fetchWithRetry(() => fetchPage(lessThan));
      if (page === null) return progress;
      if (page.length === 0) {
        progress.complete = true;
        return progress;
      }

      const inPeriod = page.filter(
        (match) => match.start_time * 1000 >= since.getTime(),
      );
      progress.pages++;
      progress.added += await store(inPeriod);
      const oldest = Math.min(...page.map((match) => match.start_time));
      progress.oldest = new Date(oldest * 1000);

      if (progress.pages % PROGRESS_EVERY_PAGES === 0) {
        this.logger.log(
          `${name}: ${progress.pages} pages, ${progress.added} new matches, back to ${progress.oldest.toISOString()}`,
        );
      }
      // the page reached the start of the period
      if (inPeriod.length < page.length) {
        progress.complete = true;
        return progress;
      }

      lessThan = Math.min(...page.map((match) => match.match_id));
      await this.pause(PAGE_PAUSE_MS);
    }
  }

  /**
   * Tries again once after a rate limit (the client waits a minute before
   * the next request); null when it is reached again
   */
  private async fetchWithRetry<T>(fetch: () => Promise<T>): Promise<T | null> {
    try {
      return await fetch();
    } catch (error) {
      if (!(error instanceof OpenDotaRateLimitError)) throw error;
      try {
        return await fetch();
      } catch (retryError) {
        if (!(retryError instanceof OpenDotaRateLimitError)) throw retryError;
        this.logger.warn('Rate limit reached again, stopping');
        return null;
      }
    }
  }

  // overridden by the tests
  protected pause(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
