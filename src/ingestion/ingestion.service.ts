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
import { PublicMatch } from '../opendota/opendota.schemas.js';
import { StatsService } from '../stats/stats.service.js';
import { PositionStatsService } from '../stratz/position-stats.service.js';
import { RoleItemsService } from '../stratz/role-items.service.js';
import { TalentStatsService } from '../stratz/talent-stats.service.js';

// public matches kept: ranked lobby, All Pick
const RANKED_LOBBY = 7;
const ALL_PICK_RANKED = 22;
export const HOUR_MS = 60 * 60 * 1000;

/** Ranked All Pick public match of the minimum rank, with 5 heroes per team */
export const isWantedPublicMatch = (match: PublicMatch, minRankTier: number) =>
  match.lobby_type === RANKED_LOBBY &&
  match.game_mode === ALL_PICK_RANKED &&
  (match.avg_rank_tier ?? 0) >= minRankTier &&
  match.radiant_team.length === 5 &&
  match.dire_team.length === 5;

/**
 * Collects matches from OpenDota: the latest pro and public matches, then the
 * details (items and purchases) of each one, within the daily request quota.
 * Public matches count for PUBLIC_WINDOW_HOURS; pro matches, much fewer, for
 * the whole current patch.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly minRankTier: number;
  private readonly detailsPerMinute: number;
  private readonly dailyReserve: number;
  private readonly publicWindowHours: number;

  constructor(
    private readonly openDota: OpenDotaClient,
    private readonly gameData: GameDataService,
    private readonly matches: MatchesService,
    private readonly stats: StatsService,
    private readonly positionStats: PositionStatsService,
    private readonly talentStats: TalentStatsService,
    private readonly roleItems: RoleItemsService,
    config: ConfigService<Env, true>,
  ) {
    this.minRankTier = config.get('PUBLIC_MIN_RANK_TIER', { infer: true });
    this.detailsPerMinute = config.get('DETAILS_PER_MINUTE', { infer: true });
    this.dailyReserve = config.get('OPENDOTA_DAILY_RESERVE', { infer: true });
    this.publicWindowHours = config.get('PUBLIC_WINDOW_HOURS', {
      infer: true,
    });
  }

  /** Updates the heroes, items and patches */
  syncGameData(): Promise<void> {
    return this.gameData.sync();
  }

  /**
   * Stores the latest pro matches of the current patch; returns how many
   * were new
   */
  async collectProMatches(now = new Date()): Promise<number> {
    await this.ensureGameData();
    const matches = await this.openDota.getProMatches();
    const since = this.proWindowStart(now);
    return this.matches.addProMatches(
      matches.filter((match) => match.start_time * 1000 >= since.getTime()),
    );
  }

  /** Stores the latest high rank public matches; returns how many were new */
  async collectPublicMatches(now = new Date()): Promise<number> {
    await this.ensureGameData();
    const matches = await this.openDota.getPublicMatches({
      minRank: this.minRankTier,
    });
    return this.matches.addPublicMatches(
      matches.filter(
        (match) =>
          isWantedPublicMatch(match, this.minRankTier) &&
          match.start_time * 1000 >= this.publicWindowStart(now).getTime(),
      ),
    );
  }

  /**
   * Fetches the details of the pending matches; returns how many were saved.
   * Pro and public matches share the requests in halves, and a side with
   * fewer pending matches leaves the rest to the other, so a long pro
   * backfill does not stop the public matches (nor the other way around).
   */
  async fetchDetails(now = new Date()): Promise<number> {
    const budget = this.detailsBudget(now);
    if (budget === 0) return 0;

    await this.ensureGameData();
    // public matches about to leave the window are not worth a request
    const publicMatches = await this.matches.findPendingDetails(budget, {
      source: MatchSource.PUBLIC,
      since: this.publicWindowStart(now),
    });
    const pro = await this.matches.findPendingDetails(
      budget - Math.min(publicMatches.length, Math.floor(budget / 2)),
      { source: MatchSource.PRO, since: this.proWindowStart(now) },
    );
    const pending = [...pro, ...publicMatches.slice(0, budget - pro.length)];

    let saved = 0;
    for (const match of pending) {
      try {
        await this.matches.saveDetails(
          match,
          await this.openDota.getMatch(match.id),
        );
        saved++;
      } catch (error) {
        // the quota is over: the next minutes try again
        if (error instanceof OpenDotaRateLimitError) break;
        this.logger.warn(
          `Details of match ${match.id} failed: ${(error as Error).message}`,
        );
        await this.matches.registerDetailsFailure(match);
      }
    }
    return saved;
  }

  /** Rebuilds the statistics of the current patch */
  async refreshStats(now = new Date()): Promise<void> {
    await this.ensureGameData();
    await this.stats.refresh(
      this.gameData.patchAt(now).id,
      this.publicWindowStart(now),
    );
  }

  /** Start of the window of the public matches (PUBLIC_WINDOW_HOURS) */
  publicWindowStart(now = new Date()): Date {
    return new Date(now.getTime() - this.publicWindowHours * HOUR_MS);
  }

  /** Start of the window of the pro matches: the release of the patch */
  proWindowStart(now = new Date()): Date {
    return this.gameData.patchAt(now).releasedAt;
  }

  /**
   * Deletes the public matches older than the window and the pro matches of
   * the previous patches
   */
  async deleteExpiredMatches(now = new Date()): Promise<number> {
    await this.ensureGameData();
    return this.matches.deleteStartedBefore({
      publicBefore: this.publicWindowStart(now),
      proBefore: this.proWindowStart(now),
    });
  }

  /** Whether the statistics by role (STRATZ) are collected */
  get collectsPositionStats(): boolean {
    return this.positionStats.isConfigured;
  }

  /**
   * Stores the STRATZ statistics: by role, of the latest day (STRATZ has
   * whole days only), and the talents and items by role of the latest week.
   * Returns how many rows were stored.
   */
  async syncStratzStats(): Promise<{
    positions: number;
    talents: number;
    items: number;
  }> {
    const positions = await this.positionStats.sync();
    const talents = await this.talentStats.sync();
    const items = await this.roleItems.sync();
    return { positions, talents, items };
  }

  /**
   * Details that can be requested now: the requests left today (minus the
   * reserve for the match lists) spread over the minutes until the quota
   * resets (midnight UTC), up to DETAILS_PER_MINUTE.
   */
  detailsBudget(now: Date): number {
    const remaining = this.openDota.remainingDailyRequests;
    // unknown until the first response
    if (remaining === null) return 1;

    const available = remaining - this.dailyReserve;
    if (available <= 0) return 0;

    const midnight = new Date(now);
    midnight.setUTCHours(24, 0, 0, 0);
    const minutesLeft = Math.max(
      1,
      Math.ceil((midnight.getTime() - now.getTime()) / 60000),
    );
    return Math.min(this.detailsPerMinute, Math.ceil(available / minutesLeft));
  }

  private async ensureGameData() {
    if (!this.gameData.isLoaded) await this.gameData.sync();
    else await this.gameData.ensureAbilities();
  }
}
