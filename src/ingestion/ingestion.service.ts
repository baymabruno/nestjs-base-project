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

// public matches kept: ranked lobby, All Pick
const RANKED_LOBBY = 7;
const ALL_PICK_RANKED = 22;
const DAY_MS = 24 * 60 * 60 * 1000;

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
      matches.filter((match) => this.isWanted(match)),
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

  /** Deletes the matches older than MATCH_RETENTION_DAYS */
  deleteExpiredMatches(now = new Date()): Promise<number> {
    return this.matches.deleteStartedBefore(
      new Date(now.getTime() - this.retentionDays * DAY_MS),
    );
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

  private isWanted(match: PublicMatch) {
    return (
      match.lobby_type === RANKED_LOBBY &&
      match.game_mode === ALL_PICK_RANKED &&
      (match.avg_rank_tier ?? 0) >= this.minRankTier &&
      match.radiant_team.length === 5 &&
      match.dire_team.length === 5
    );
  }

  private async ensureGameData() {
    if (!this.gameData.isLoaded) await this.gameData.sync();
  }
}
