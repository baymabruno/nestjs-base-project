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
