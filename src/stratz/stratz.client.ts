import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { Env } from '../config/env.validation.js';

// positions 1 (carry) to 5 (hard support) and the ranks collected
export const POSITIONS = [1, 2, 3, 4, 5] as const;
export const RANK_BRACKETS = { DIVINE: 7, IMMORTAL: 8 } as const;

const dayRowSchema = z.object({
  // unix time (seconds) of the UTC day
  day: z.number().int(),
  heroId: z.number().int(),
  winCount: z.number().int(),
  matchCount: z.number().int(),
});

const responseSchema = z.object({
  data: z
    .object({ heroStats: z.record(z.string(), z.array(dayRowSchema)) })
    .nullish(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

export interface HeroPositionDay {
  day: Date;
  position: number;
  rankBracket: number;
  heroId: number;
  matches: number;
  wins: number;
}

/** The STRATZ API answered with errors */
export class StratzError extends Error {}

const alias = (position: number, bracket: string) => `p${position}_${bracket}`;

/**
 * STRATZ GraphQL API client (https://stratz.com/api). Only used for the hero
 * statistics by position, which OpenDota does not provide at scale.
 */
@Injectable()
export class StratzClient {
  private readonly url: string;
  private readonly token?: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService<Env, true>,
  ) {
    this.url = config.get('STRATZ_API_URL', { infer: true });
    this.token = config.get('STRATZ_API_TOKEN', { infer: true });
  }

  /** Whether STRATZ_API_TOKEN is set */
  get isConfigured(): boolean {
    return !!this.token;
  }

  /**
   * Matches and wins of each hero by day, position and rank (Divine and
   * Immortal, ranked All Pick) of the last days, in a single request.
   */
  async getHeroPositionDays(days: number): Promise<HeroPositionDay[]> {
    const fields = POSITIONS.flatMap((position) =>
      Object.keys(RANK_BRACKETS).map(
        (bracket) =>
          `${alias(position, bracket)}: winDay(take: ${days}, positionIds: [POSITION_${position}], ` +
          `bracketIds: [${bracket}], gameModeIds: [ALL_PICK_RANKED], groupBy: HERO_ID) ` +
          `{ day heroId winCount matchCount }`,
      ),
    );
    const response = await this.http.axiosRef.post<unknown>(
      this.url,
      { query: `{ heroStats { ${fields.join(' ')} } }` },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          // required by STRATZ for API requests
          'User-Agent': 'STRATZ_API',
        },
      },
    );

    const { data, errors } = responseSchema.parse(response.data);
    if (errors?.length || !data) {
      throw new StratzError(
        errors?.map((error) => error.message).join('; ') ?? 'Empty answer',
      );
    }

    return POSITIONS.flatMap((position) =>
      Object.entries(RANK_BRACKETS).flatMap(([bracket, rankBracket]) =>
        (data.heroStats[alias(position, bracket)] ?? []).map((row) => ({
          day: new Date(row.day * 1000),
          position,
          rankBracket,
          heroId: row.heroId,
          matches: row.matchCount,
          wins: row.winCount,
        })),
      ),
    );
  }
}
