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

const talentRowSchema = z.object({
  abilityId: z.number().int(),
  matchCount: z.number().int(),
  winCount: z.number().int(),
});

// each alias of heroStats is a list (null for an unknown hero)
const responseSchema = <T extends z.ZodType>(row: T) =>
  z.object({
    data: z
      .object({ heroStats: z.record(z.string(), z.array(row).nullable()) })
      .nullish(),
    errors: z.array(z.object({ message: z.string() })).nullish(),
  });

const abilityNamesSchema = z.object({
  data: z
    .object({
      constants: z.object({
        abilities: z.array(
          z.object({
            id: z.number().int(),
            language: z.object({ displayName: z.string().nullish() }).nullish(),
          }),
        ),
      }),
    })
    .nullish(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

const itemTimingRowSchema = z.object({
  itemId: z.number().int(),
  // minute of the first purchase
  time: z.number().int(),
  matchCount: z.number().int(),
  winCount: z.number().int(),
});

const startingItemRowSchema = z.object({
  itemId: z.number().int(),
  // 0: the first copy of the item
  instance: z.number().int(),
  // given by an ally instead of bought
  wasGiven: z.boolean(),
  matchCount: z.number().int(),
  winCount: z.number().int(),
});

// hero and position (0: every position) of a per hero query
interface Combo {
  heroId: number;
  position: number;
}

// aliases (hero and position) per request
const ALIASES_PER_REQUEST = 50;
const comboAlias = ({ heroId, position }: Combo) => `h${heroId}p${position}`;
const comboArgs = ({ heroId, position }: Combo) =>
  `heroId: ${heroId}, bracketBasicIds: [DIVINE_IMMORTAL]` +
  (position ? `, positionIds: [POSITION_${position}]` : '');
const combos = (heroIds: number[], positions: readonly number[]) =>
  heroIds.flatMap((heroId) =>
    positions.map((position) => ({ heroId, position })),
  );

export interface HeroTalentCount {
  heroId: number;
  /** 0: every position */
  position: number;
  abilityId: number;
  matches: number;
  wins: number;
}

export interface HeroRoleItemCount {
  heroId: number;
  position: number;
  itemId: number;
  matches: number;
  wins: number;
}

export interface HeroRoleItemTimingCount extends HeroRoleItemCount {
  minute: number;
}

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
    const heroStats = await this.query(fields, dayRowSchema);

    return POSITIONS.flatMap((position) =>
      Object.entries(RANK_BRACKETS).flatMap(([bracket, rankBracket]) =>
        (heroStats[alias(position, bracket)] ?? []).map((row) => ({
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

  /**
   * Matches and wins of each talent of the heroes in ranked Divine and
   * Immortal matches of the latest STRATZ week, in every position (0) and in
   * the given ones
   */
  async getHeroTalents(
    heroIds: number[],
    positions: readonly number[] = [0],
  ): Promise<HeroTalentCount[]> {
    const results = await this.perCombo(
      combos(heroIds, positions),
      (combo) =>
        `talent(${comboArgs(combo)}) { abilityId matchCount winCount }`,
      talentRowSchema,
    );
    return results.flatMap(({ combo, rows }) =>
      rows.map((row) => ({
        ...combo,
        abilityId: row.abilityId,
        matches: row.matchCount,
        wins: row.winCount,
      })),
    );
  }

  /**
   * First purchase of each item per minute, for every hero in each position
   * (latest STRATZ week; STRATZ only returns the frequent cells)
   */
  async getRoleItemTimings(
    heroIds: number[],
  ): Promise<HeroRoleItemTimingCount[]> {
    const results = await this.perCombo(
      combos(heroIds, POSITIONS),
      (combo) =>
        `itemFullPurchase(${comboArgs(combo)}) { itemId time matchCount winCount }`,
      itemTimingRowSchema,
    );
    return results.flatMap(({ combo, rows }) =>
      rows.map((row) => ({
        ...combo,
        itemId: row.itemId,
        minute: row.time,
        matches: row.matchCount,
        wins: row.winCount,
      })),
    );
  }

  /**
   * Starting items bought (not given by an ally) by every hero in each
   * position (latest STRATZ week)
   */
  async getRoleStartingItems(heroIds: number[]): Promise<HeroRoleItemCount[]> {
    const results = await this.perCombo(
      combos(heroIds, POSITIONS),
      (combo) =>
        `itemStartingPurchase(${comboArgs(combo)}) ` +
        `{ itemId instance wasGiven matchCount winCount }`,
      startingItemRowSchema,
    );
    return results.flatMap(({ combo, rows }) =>
      rows
        .filter((row) => row.instance === 0 && !row.wasGiven)
        .map((row) => ({
          ...combo,
          itemId: row.itemId,
          matches: row.matchCount,
          wins: row.winCount,
        })),
    );
  }

  /** English names of the abilities and talents, with the values filled in */
  async getAbilityNames(): Promise<Map<number, string>> {
    const response = await this.post(
      '{ constants { abilities(language: ENGLISH) { id language { displayName } } } }',
    );
    const { data, errors } = abilityNamesSchema.parse(response);
    if (errors?.length || !data) {
      throw new StratzError(
        errors?.map((error) => error.message).join('; ') ?? 'Empty answer',
      );
    }
    return new Map(
      data.constants.abilities.flatMap((ability) =>
        ability.language?.displayName
          ? [[ability.id, ability.language.displayName]]
          : [],
      ),
    );
  }

  /** Runs a heroStats field for each combo, ALIASES_PER_REQUEST at a time */
  private async perCombo<T extends z.ZodType>(
    list: Combo[],
    field: (combo: Combo) => string,
    row: T,
  ): Promise<{ combo: Combo; rows: z.infer<T>[] }[]> {
    const results: { combo: Combo; rows: z.infer<T>[] }[] = [];
    for (let i = 0; i < list.length; i += ALIASES_PER_REQUEST) {
      const batch = list.slice(i, i + ALIASES_PER_REQUEST);
      const heroStats = await this.query(
        batch.map((combo) => `${comboAlias(combo)}: ${field(combo)}`),
        row,
      );
      for (const combo of batch) {
        results.push({ combo, rows: heroStats[comboAlias(combo)] ?? [] });
      }
    }
    return results;
  }

  /** Runs the heroStats fields; the answer has one list per alias */
  private async query<T extends z.ZodType>(fields: string[], row: T) {
    const response = await this.post(`{ heroStats { ${fields.join(' ')} } }`);

    const { data, errors } = responseSchema(row).parse(response);
    if (errors?.length || !data) {
      throw new StratzError(
        errors?.map((error) => error.message).join('; ') ?? 'Empty answer',
      );
    }
    return data.heroStats as Record<string, z.infer<T>[] | null>;
  }

  private async post(query: string): Promise<unknown> {
    const response = await this.http.axiosRef.post<unknown>(
      this.url,
      { query },
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          // required by STRATZ for API requests
          'User-Agent': 'STRATZ_API',
        },
      },
    );
    return response.data;
  }
}
