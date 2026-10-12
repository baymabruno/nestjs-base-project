import { z } from 'zod';

// Request and response schemas: they validate the requests
// (StandardSchemaValidationPipe) and generate the Swagger documentation

const source = z
  .enum(['pro', 'public'])
  .optional()
  .describe('Only pro or only public matches (default: both)');

const minMatches = z.coerce
  .number()
  .int()
  .min(1)
  .max(100000)
  .default(1)
  .describe('Leaves out results with fewer matches (small samples)');

export const heroesQuerySchema = z
  .strictObject({ source, minMatches })
  .meta({ id: 'HeroesQuery' });

export const heroQuerySchema = z
  .strictObject({
    source,
    minMatches,
    minItemCost: z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Leaves out cheaper items, e.g. 1000 for core items only'),
  })
  .meta({ id: 'HeroQuery' });

export const heroIdSchema = z.strictObject({
  heroId: z.coerce.number().int().positive(),
});

const rate = z.number().describe('From 0 to 1');

const patchSchema = z
  .object({ id: z.number(), name: z.string(), releasedAt: z.iso.datetime() })
  .meta({ id: 'Patch' });

export const metaSchema = z
  .object({
    patch: patchSchema,
    updatedAt: z.iso.datetime().describe('When the statistics were calculated'),
    matches: z
      .object({ pro: z.number(), public: z.number() })
      .describe('Matches of the patch with heroes stored'),
  })
  .meta({ id: 'Meta' });

const heroSchema = z.object({
  id: z.number(),
  name: z.string(),
  localizedName: z.string(),
  primaryAttr: z.string(),
  roles: z.array(z.string()),
});

const heroStatsSchema = heroSchema.extend({
  matches: z.number(),
  wins: z.number(),
  winRate: rate,
  pickRate: rate.describe('Share of the matches with the hero (0 to 1)'),
});

export const heroListSchema = z
  .object({
    patch: patchSchema.nullable(),
    heroes: z.array(heroStatsSchema).describe('Highest win rate first'),
  })
  .meta({ id: 'HeroList' });

export const heroDetailsSchema = z
  .object({
    patch: patchSchema.nullable(),
    hero: heroStatsSchema,
    itemMatches: z
      .number()
      .describe(
        'Matches of the hero with the final items known (details fetched): the base of the item shares',
      ),
    items: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          displayName: z.string().nullable(),
          cost: z.number().nullable(),
          matches: z.number().describe('Matches ending with the item'),
          wins: z.number(),
          winRate: rate,
          avgPurchaseTime: z
            .number()
            .nullable()
            .describe(
              'Average first purchase time in seconds (parsed matches only)',
            ),
        }),
      )
      .describe('Final inventory items, most used first'),
  })
  .meta({ id: 'HeroDetails' });

export type HeroesQuery = z.infer<typeof heroesQuerySchema>;
export type HeroQuery = z.infer<typeof heroQuerySchema>;
export type HeroId = z.infer<typeof heroIdSchema>;
export type Meta = z.infer<typeof metaSchema>;
export type HeroList = z.infer<typeof heroListSchema>;
export type HeroDetails = z.infer<typeof heroDetailsSchema>;

// ---- meta page ----

export const metaHeroesQuerySchema = z
  .strictObject({
    source,
    bracket: z
      .enum(['divine', 'immortal'])
      .optional()
      .describe('Only public matches of this average rank (default: all)'),
    minMatches,
  })
  .meta({ id: 'MetaHeroesQuery' });

const durationStatsSchema = z.object({
  matches: z.number(),
  winRate: rate.nullable().describe('Null without matches'),
});

export const metaHeroesSchema = z
  .object({
    patch: patchSchema.nullable(),
    publicWindowHours: z
      .number()
      .describe(
        'Public matches count for the last hours; pro matches, for the whole patch',
      ),
    matches: z.number().describe('Matches in the filters'),
    heroes: z
      .array(
        heroSchema.extend({
          matches: z.number(),
          wins: z.number(),
          winRate: rate,
          winRateLow: rate.describe(
            'Lower bound of the 95% Wilson interval: the win rate the sample supports',
          ),
          pickRate: rate,
          score: z
            .number()
            .describe(
              '0 to 100: 70% the percentile of winRateLow and 30% the percentile of pickRate among the heroes listed',
            ),
          tier: z.enum(['S', 'A', 'B', 'C', 'D']).describe('From the score'),
          durations: z
            .object({
              short: durationStatsSchema.describe('Under 35 minutes'),
              medium: durationStatsSchema.describe('35 to 50 minutes'),
              long: durationStatsSchema.describe('50 minutes or more'),
            })
            .describe('Win rate by game duration'),
        }),
      )
      .describe('Highest score first'),
  })
  .meta({ id: 'MetaHeroes' });

export type MetaHeroesQuery = z.infer<typeof metaHeroesQuerySchema>;
export type MetaHeroes = z.infer<typeof metaHeroesSchema>;

// ---- hero page ----

export const heroMatchupsQuerySchema = z
  .strictObject({ source, minMatches })
  .meta({ id: 'HeroMatchupsQuery' });

const matchupSchema = z.object({
  id: z.number(),
  name: z.string(),
  localizedName: z.string(),
  matches: z.number(),
  wins: z.number().describe('Wins of the hero of the page'),
  winRate: rate,
  winRateLow: rate.describe('Lower bound of the 95% Wilson interval'),
  winRateHigh: rate.describe('Upper bound of the 95% Wilson interval'),
  delta: z
    .number()
    .describe(
      'Win rate in this matchup minus the overall win rate of the hero',
    ),
});

export const heroMatchupsSchema = z
  .object({
    hero: z.object({
      id: z.number(),
      matches: z.number(),
      winRate: rate.describe('Overall win rate, the reference of the deltas'),
    }),
    enemies: z
      .array(matchupSchema)
      .describe('Win rate of the hero against each enemy hero'),
    allies: z
      .array(matchupSchema)
      .describe('Win rate of the hero with each allied hero'),
  })
  .meta({ id: 'HeroMatchups' });

export const heroItemTimingsQuerySchema = z
  .strictObject({
    source,
    minMatches,
    minItemCost: z.coerce
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Leaves out cheaper items, e.g. 1000 for core items only'),
  })
  .meta({ id: 'HeroItemTimingsQuery' });

export const heroItemTimingsSchema = z
  .object({
    matches: z
      .number()
      .describe('Matches of the hero with the purchase order (parsed)'),
    items: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          displayName: z.string().nullable(),
          cost: z.number().nullable(),
          matches: z.number().describe('Matches in which the item was bought'),
          wins: z.number(),
          winRate: rate,
          purchaseRate: rate.describe('Share of the matches with the item'),
          avgTime: z
            .number()
            .describe('Average time of the first purchase, in seconds'),
          timings: z
            .array(
              z.object({
                bucket: z
                  .number()
                  .describe(
                    '0: before the horn, then 5 minute windows (1: 0-5 min ... 13: 60+)',
                  ),
                fromMinute: z.number().nullable(),
                toMinute: z.number().nullable(),
                matches: z.number(),
                winRate: rate,
              }),
            )
            .describe('Win rate by the time of the first purchase'),
        }),
      )
      .describe('Most bought first'),
  })
  .meta({ id: 'HeroItemTimings' });

export type HeroMatchupsQuery = z.infer<typeof heroMatchupsQuerySchema>;
export type HeroMatchups = z.infer<typeof heroMatchupsSchema>;
export type HeroItemTimingsQuery = z.infer<typeof heroItemTimingsQuerySchema>;
export type HeroItemTimings = z.infer<typeof heroItemTimingsSchema>;

// ---- statistics by role (STRATZ) ----

export const rolesQuerySchema = z
  .strictObject({
    position: z.coerce
      .number()
      .int()
      .min(1)
      .max(5)
      .optional()
      .describe(
        '1 carry, 2 mid, 3 offlane, 4 support, 5 hard support (default: all)',
      ),
    bracket: z
      .enum(['divine', 'immortal'])
      .optional()
      .describe('Average rank of the matches (default: both)'),
    minMatches: z.coerce
      .number()
      .int()
      .min(1)
      .max(1000000)
      .default(100)
      .describe('Leaves out heroes with fewer matches in the role'),
  })
  .meta({ id: 'RolesQuery' });

export const rolesSchema = z
  .object({
    available: z
      .boolean()
      .describe('False while there is no data (STRATZ_API_TOKEN not set)'),
    day: z.iso
      .date()
      .nullable()
      .describe(
        'Day of the data: the latest one of STRATZ, which has whole days only (UTC)',
      ),
    matches: z.number().describe('Matches in the filters'),
    heroes: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          localizedName: z.string(),
          matches: z.number(),
          wins: z.number(),
          winRate: rate,
          winRateLow: rate.describe('Lower bound of the 95% Wilson interval'),
          pickRate: rate.describe(
            'Share of the matches with the hero in the role',
          ),
          score: z
            .number()
            .describe(
              '0 to 100: 70% the percentile of the adjusted win rate and 30% the percentile of the pick rate, among the heroes of the role',
            ),
          tier: z.enum(['S', 'A', 'B', 'C', 'D']),
        }),
      )
      .describe('Highest score first'),
  })
  .meta({ id: 'Roles' });

export type RolesQuery = z.infer<typeof rolesQuerySchema>;
export type Roles = z.infer<typeof rolesSchema>;

// ---- abilities and talents ----

const positionFilter = z.coerce
  .number()
  .int()
  .min(1)
  .max(5)
  .optional()
  .describe(
    '1 carry, 2 mid, 3 offlane, 4 support, 5 hard support (default: all)',
  );

export const heroAbilitiesQuerySchema = z
  .strictObject({
    source,
    position: positionFilter.describe(
      'Talents of a position (default: all); the builds are not by position',
    ),
  })
  .meta({ id: 'HeroAbilitiesQuery' });

const abilitySchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string().nullable(),
  isTalent: z.boolean(),
});

const talentOptionSchema = abilitySchema.omit({ isTalent: true }).extend({
  matches: z.number(),
  wins: z.number(),
  pickRate: rate.describe('Share of the picks of the tier'),
  winRate: rate.nullable().describe('Null without picks'),
});

export const heroAbilitiesSchema = z
  .object({
    skillBuild: z.object({
      matches: z
        .number()
        .describe('Matches of the hero with the first 10 levels known'),
      builds: z
        .array(
          z.object({
            abilities: z
              .array(abilitySchema.nullable())
              .describe('Levels 1 to 10 (null: unknown ability)'),
            matches: z.number(),
            wins: z.number(),
            winRate: rate,
            pickRate: rate.describe('Share of the matches with this build'),
          }),
        )
        .describe('The 5 most common builds, most played first'),
    }),
    talents: z.object({
      available: z
        .boolean()
        .describe('False without STRATZ data (STRATZ_API_TOKEN not set)'),
      updatedAt: z.iso.datetime().nullable(),
      tiers: z
        .array(
          z.object({
            level: z.number().describe('Hero level: 25, 20, 15 or 10'),
            options: z.array(talentOptionSchema).describe('The two talents'),
          }),
        )
        .describe('From level 25 to 10, as in the game'),
    }),
  })
  .meta({ id: 'HeroAbilities' });

export type HeroAbilitiesQuery = z.infer<typeof heroAbilitiesQuerySchema>;
export type HeroAbilities = z.infer<typeof heroAbilitiesSchema>;

// ---- roles of a hero ----

export const heroRolesQuerySchema = z
  .strictObject({ bracket: rolesQuerySchema.shape.bracket })
  .meta({ id: 'HeroRolesQuery' });

const roleTotalsSchema = z.object({
  matches: z.number(),
  wins: z.number(),
  winRate: rate.nullable().describe('Null without matches'),
});

export const heroRolesSchema = z
  .object({
    available: z
      .boolean()
      .describe('False while there is no data (STRATZ_API_TOKEN not set)'),
    day: z.iso.date().nullable().describe('Day of the data (UTC)'),
    all: roleTotalsSchema.describe('Every position'),
    positions: z
      .array(
        roleTotalsSchema.extend({
          position: z.number().describe('1 carry ... 5 hard support'),
          share: rate.describe('Share of the matches of the hero'),
          winRateLow: rate
            .nullable()
            .describe('Lower bound of the 95% Wilson interval'),
          pickRate: rate.describe(
            'Share of the matches with the hero in the role',
          ),
          rank: z
            .number()
            .nullable()
            .describe('Place in the role ranking (null below 100 matches)'),
          rankedHeroes: z.number().describe('Heroes in the role ranking'),
          score: z
            .number()
            .nullable()
            .describe(
              'Score in the role, as in /meta/roles (null below 100 matches)',
            ),
          tier: z.enum(['S', 'A', 'B', 'C', 'D']).nullable(),
        }),
      )
      .describe('Positions 1 to 5'),
    mostPlayed: z
      .number()
      .nullable()
      .describe('Position with the most matches of the hero'),
  })
  .meta({ id: 'HeroRoles' });

export type HeroRolesQuery = z.infer<typeof heroRolesQuerySchema>;
export type HeroRoles = z.infer<typeof heroRolesSchema>;

// ---- items of a hero by role (STRATZ) ----

export const heroRoleItemsQuerySchema = z
  .strictObject({
    position: z.coerce.number().int().min(1).max(5).describe('1 to 5'),
    minItemCost: z.coerce.number().int().min(0).default(0),
  })
  .meta({ id: 'HeroRoleItemsQuery' });

const roleItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  displayName: z.string().nullable(),
  cost: z.number().nullable(),
  matches: z.number(),
  wins: z.number(),
  winRate: rate,
});

export const heroRoleItemsSchema = z
  .object({
    startingItems: z
      .array(roleItemSchema)
      .describe('Bought before the horn, most bought first'),
    timings: z
      .array(
        roleItemSchema.extend({
          avgTime: z
            .number()
            .describe('Average minute of the first purchase, in seconds'),
          timings: z
            .array(
              z.object({
                fromMinute: z.number(),
                toMinute: z.number(),
                matches: z.number(),
                winRate: rate,
              }),
            )
            .describe(
              'Win rate by the minute of the first purchase (5 minutes)',
            ),
        }),
      )
      .describe('Items by the minute of the first purchase, most bought first'),
  })
  .meta({ id: 'HeroRoleItems' });

export type HeroRoleItemsQuery = z.infer<typeof heroRoleItemsQuerySchema>;
export type HeroRoleItems = z.infer<typeof heroRoleItemsSchema>;
