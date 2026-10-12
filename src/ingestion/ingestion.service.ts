import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../config/env.validation.js';
import { GameDataService } from '../game-data/game-data.service.js';
import { MatchesService } from '../matches/matches.service.js';
import {
  OpenDotaClient,
  OpenDotaRateLimitError,
} from '../opendota/opendota.client.js';
import { PublicMatch } from '../opendota/opendota.schemas.js';
import { StatsService } from '../stats/stats.service.js';
import { PositionStatsService } from '../stratz/position-stats.service.js';

// public matches kept: ranked lobby, All Pick
const RANKED_LOBBY = 7;
const ALL_PICK_RANKED = 22;
export const DAY_MS = 24 * 60 * 60 * 1000;

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
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);
  private readonly minRankTier: number;
  private readonly detailsPerMinute: number;
  private readonly dailyReserve: number;
  private readonly retentionDays: number;

  constructor(
    private readonly openDota: OpenDotaClient,
    private readonly gameData: GameDataService,
    private readonly matches: MatchesService,
    private readonly stats: StatsService,
    private readonly positionStats: PositionStatsService,
    config: ConfigService<Env, true>,
  ) {
    this.minRankTier = config.get('PUBLIC_MIN_RANK_TIER', { infer: true });
    this.detailsPerMinute = config.get('DETAILS_PER_MINUTE', { infer: true });
    this.dailyReserve = config.get('OPENDOTA_DAILY_RESERVE', { infer: true });
    this.retentionDays = config.get('MATCH_RETENTION_DAYS', { infer: true });
  }

  /** Updates the heroes, items and patches */
  syncGameData(): Promise<void> {
    return this.gameData.sync();
  }

  /** Stores the latest pro matches; returns how many were new */
  async collectProMatches(): Promise<number> {
    await this.ensureGameData();
    return this.matches.addProMatches(await this.openDota.getProMatches());
  }

  /** Stores the latest high rank public matches; returns how many were new */
  async collectPublicMatches(): Promise<number> {
    await this.ensureGameData();
    const matches = await this.openDota.getPublicMatches({
      minRank: this.minRankTier,
    });
    return this.matches.addPublicMatches(
      matches.filter((match) => isWantedPublicMatch(match, this.minRankTier)),
    );
  }

  /** Fetches the details of the pending matches; returns how many were saved */
  async fetchDetails(now = new Date()): Promise<number> {
    const budget = this.detailsBudget(now);
    if (budget === 0) return 0;

    await this.ensureGameData();
    let saved = 0;
    for (const match of await this.matches.findPendingDetails(budget)) {
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
  async refreshStats(): Promise<void> {
    await this.ensureGameData();
    await this.stats.refresh(this.gameData.currentPatch().id);
  }

  /** Deletes the matches older than MATCH_RETENTION_DAYS */
  async deleteExpiredMatches(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - this.retentionDays * DAY_MS);
    await this.positionStats.deleteBefore(cutoff);
    return this.matches.deleteStartedBefore(cutoff);
  }

  /** Whether the statistics by role (STRATZ) are collected */
  get collectsPositionStats(): boolean {
    return this.positionStats.isConfigured;
  }

  /**
   * Stores the statistics by role (STRATZ) of the retention period; returns
   * how many rows were stored
   */
  syncPositionStats(): Promise<number> {
    return this.positionStats.sync(this.retentionDays);
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
  }
}
