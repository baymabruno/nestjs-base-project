import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { Env } from '../config/env.validation.js';
import {
  abilitiesSchema,
  abilityIdsSchema,
  heroAbilitiesSchema,
  heroesSchema,
  itemsSchema,
  matchDetailsSchema,
  patchesSchema,
  proMatchSchema,
  publicMatchSchema,
} from './opendota.schemas.js';

/** OpenDota refused the request: the per-minute or daily limit was reached */
export class OpenDotaRateLimitError extends Error {
  constructor() {
    super('OpenDota rate limit reached');
  }
}

export interface PublicMatchesQuery {
  /** minimum average rank tier, e.g. 70 (Divine) */
  minRank?: number;
  /** pages backwards: matches with a lower id */
  lessThanMatchId?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MINUTE_MS = 60 * 1000;
// requests left in the minute that make the client wait for the next one
export const MINUTE_RESERVE = 10;

/**
 * OpenDota API client. Requests run one at a time, spaced by
 * OPENDOTA_REQUEST_INTERVAL_MS, to respect the per-minute limit (60 without
 * an API key). The limit is per IP, shared by the worker and the backfill:
 * when the API reports few requests left in the minute, or refuses one (429),
 * the client waits a minute. The responses are validated, so a change in the
 * API fails here instead of storing wrong data.
 */
@Injectable()
export class OpenDotaClient {
  private readonly logger = new Logger(OpenDotaClient.name);
  private readonly apiKey?: string;
  private readonly interval: number;
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;
  // no request before this time (per-minute limit)
  private notBefore = 0;
  private remainingToday: number | null = null;

  constructor(
    private readonly http: HttpService,
    config: ConfigService<Env, true>,
  ) {
    this.apiKey = config.get('OPENDOTA_API_KEY', { infer: true });
    this.interval = config.get('OPENDOTA_REQUEST_INTERVAL_MS', {
      infer: true,
    });
  }

  /** Requests left today, as reported by the last response (null: unknown) */
  get remainingDailyRequests(): number | null {
    return this.remainingToday;
  }

  getProMatches(lessThanMatchId?: number) {
    return this.get('/proMatches', z.array(proMatchSchema), {
      less_than_match_id: lessThanMatchId,
    });
  }

  getPublicMatches({ minRank, lessThanMatchId }: PublicMatchesQuery = {}) {
    return this.get('/publicMatches', z.array(publicMatchSchema), {
      min_rank: minRank,
      less_than_match_id: lessThanMatchId,
    });
  }

  getMatch(matchId: number) {
    return this.get(`/matches/${matchId}`, matchDetailsSchema);
  }

  getHeroes() {
    return this.get('/constants/heroes', heroesSchema);
  }

  getItems() {
    return this.get('/constants/items', itemsSchema);
  }

  getPatches() {
    return this.get('/constants/patch', patchesSchema);
  }

  getAbilityIds() {
    return this.get('/constants/ability_ids', abilityIdsSchema);
  }

  getAbilities() {
    return this.get('/constants/abilities', abilitiesSchema);
  }

  getHeroAbilities() {
    return this.get('/constants/hero_abilities', heroAbilitiesSchema);
  }

  private get<T>(
    path: string,
    schema: z.ZodType<T>,
    params: Record<string, number | undefined> = {},
  ): Promise<T> {
    const request = this.queue.then(() => this.send(path, schema, params));
    // the next request waits for this one, whether it succeeds or fails
    this.queue = request.catch(() => undefined);
    return request;
  }

  private async send<T>(
    path: string,
    schema: z.ZodType<T>,
    params: Record<string, number | undefined>,
  ): Promise<T> {
    const wait =
      Math.max(this.lastRequestAt + this.interval, this.notBefore) - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastRequestAt = Date.now();

    try {
      const response = await this.http.axiosRef.get<unknown>(path, {
        params: { ...params, api_key: this.apiKey },
      });
      this.trackLimits(response.headers);
      return schema.parse(response.data);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 429) {
        this.trackLimits(error.response.headers);
        this.notBefore = Date.now() + MINUTE_MS;
        this.logger.warn(`Rate limit reached on ${path}, waiting a minute`);
        throw new OpenDotaRateLimitError();
      }
      throw error;
    }
  }

  private trackLimits(headers: Record<string, unknown>) {
    const header = (name: string) => Number(headers[name] ?? NaN);

    const today = header('x-rate-limit-remaining-day');
    if (Number.isFinite(today)) this.remainingToday = today;

    const minute = header('x-rate-limit-remaining-minute');
    if (Number.isFinite(minute) && minute <= MINUTE_RESERVE) {
      this.notBefore = Date.now() + MINUTE_MS;
    }
  }
}
