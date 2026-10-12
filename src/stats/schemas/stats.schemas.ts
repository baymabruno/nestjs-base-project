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

export const META_MAX_DAYS = 30;

export const metaHeroesQuerySchema = z
  .strictObject({
    source,
    bracket: z
      .enum(['divine', 'immortal'])
      .optional()
      .describe('Only public matches of this average rank (default: all)'),
    days: z.coerce
      .number()
      .int()
      .min(1)
      .max(META_MAX_DAYS)
      .default(8)
      .describe('Days of matches, up to today (UTC)'),
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
    from: z.iso.date().describe('First day included (UTC)'),
    to: z.iso.date().describe('Last day included (UTC)'),
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
          durations: z
            .object({
              short: durationStatsSchema.describe('Under 35 minutes'),
              medium: durationStatsSchema.describe('35 to 50 minutes'),
              long: durationStatsSchema.describe('50 minutes or more'),
            })
            .describe('Win rate by game duration'),
          trend: z
            .number()
            .nullable()
            .describe(
              'Win rate of the second half of the period minus the first half (null with 1 day or no matches in a half)',
            ),
          daily: z
            .array(
              z.object({
                day: z.iso.date(),
                matches: z.number(),
                winRate: rate.nullable(),
              }),
            )
            .describe('Every day of the period, oldest first'),
        }),
      )
      .describe('Highest adjusted win rate (winRateLow) first'),
  })
  .meta({ id: 'MetaHeroes' });

export type MetaHeroesQuery = z.infer<typeof metaHeroesQuerySchema>;
export type MetaHeroes = z.infer<typeof metaHeroesSchema>;
