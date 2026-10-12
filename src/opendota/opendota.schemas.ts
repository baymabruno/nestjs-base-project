import { z } from 'zod';

// Only the fields the application uses are kept (z.object strips the rest).
// API reference: https://docs.opendota.com

const id = z.number().int();

/** GET /proMatches: latest professional (league) matches */
export const proMatchSchema = z.object({
  match_id: id,
  start_time: id,
  duration: id,
  radiant_win: z.boolean().nullable(),
  leagueid: id,
  league_name: z.string().nullable(),
});
export type ProMatch = z.infer<typeof proMatchSchema>;

/** GET /publicMatches: latest public matches, with the heroes of each team */
export const publicMatchSchema = z.object({
  match_id: id,
  start_time: id,
  duration: id,
  radiant_win: z.boolean(),
  lobby_type: id,
  game_mode: id,
  avg_rank_tier: id.nullable(),
  radiant_team: z.array(id),
  dire_team: z.array(id),
});
export type PublicMatch = z.infer<typeof publicMatchSchema>;

const purchaseSchema = z.object({
  // seconds from the horn (negative before it)
  time: id,
  // item name, e.g. "blink" (the key of /constants/items)
  key: z.string(),
});

const matchPlayerSchema = z.object({
  player_slot: id,
  account_id: id.nullish(),
  hero_id: id,
  isRadiant: z.boolean(),
  kills: id,
  deaths: id,
  assists: id,
  item_0: id,
  item_1: id,
  item_2: id,
  item_3: id,
  item_4: id,
  item_5: id,
  item_neutral: id.nullish(),
  // only present in parsed matches
  purchase_log: z.array(purchaseSchema).nullish(),
  // ability ids in the order they were leveled up, talents included
  ability_upgrades_arr: z.array(id).nullish(),
});
export type MatchPlayer = z.infer<typeof matchPlayerSchema>;

/** GET /matches/{match_id} */
export const matchDetailsSchema = z.object({
  match_id: id,
  start_time: id,
  duration: id,
  radiant_win: z.boolean(),
  game_mode: id,
  lobby_type: id,
  leagueid: id.nullish(),
  // replay parser version: null while the match was not parsed
  version: id.nullish(),
  players: z.array(matchPlayerSchema),
});
export type MatchDetails = z.infer<typeof matchDetailsSchema>;

/** GET /constants/heroes, keyed by hero id */
export const heroesSchema = z.record(
  z.string(),
  z.object({
    id,
    name: z.string(),
    localized_name: z.string(),
    primary_attr: z.string(),
    roles: z.array(z.string()),
  }),
);
export type HeroConstant = z.infer<typeof heroesSchema>[string];

/** GET /constants/items, keyed by item name */
export const itemsSchema = z.record(
  z.string(),
  z.object({
    id,
    dname: z.string().nullish(),
    cost: id.nullish(),
  }),
);
export type ItemConstant = z.infer<typeof itemsSchema>[string];

/** GET /constants/ability_ids: ability name by id (some keys are not ids) */
export const abilityIdsSchema = z.record(z.string(), z.string());

/** GET /constants/abilities, keyed by ability name */
export const abilitiesSchema = z.record(
  z.string(),
  z.object({
    dname: z.string().nullish(),
    img: z.string().nullish(),
  }),
);

/** GET /constants/hero_abilities, keyed by hero name (npc_dota_hero_x) */
export const heroAbilitiesSchema = z.record(
  z.string(),
  z.object({
    // only the talents are used (the abilities list mixes names and lists)
    // level 1 to 4 of the talent tree (hero levels 10, 15, 20 and 25)
    talents: z.array(z.object({ name: z.string(), level: id })),
  }),
);

/** GET /constants/patch: game patches in release order */
export const patchesSchema = z.array(
  z.object({
    id,
    name: z.string(),
    date: z.iso.datetime(),
  }),
);
export type PatchConstant = z.infer<typeof patchesSchema>[number];
