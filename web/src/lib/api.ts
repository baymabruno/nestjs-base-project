// Client of the Dota Metrics API, used on the server (Server Components).
// API_URL is read at runtime, so the same image works in any environment.

const API_URL = process.env.API_URL ?? "http://localhost:3000";

// the worker recalculates the statistics every 15 minutes
const REVALIDATE_SECONDS = 900;

export type Source = "pro" | "public";
export type Bracket = "divine" | "immortal";

export interface Patch {
  id: number;
  name: string;
  releasedAt: string;
}

export interface Meta {
  patch: Patch;
  updatedAt: string;
  matches: { pro: number; public: number };
}

export interface DurationStats {
  matches: number;
  winRate: number | null;
}

export interface MetaHero {
  id: number;
  name: string;
  localizedName: string;
  primaryAttr: string;
  roles: string[];
  matches: number;
  wins: number;
  winRate: number;
  winRateLow: number;
  pickRate: number;
  /** 0 to 100, the same formula of the roles */
  score: number;
  tier: Tier;
  durations: { short: DurationStats; medium: DurationStats; long: DurationStats };
}

export interface MetaHeroes {
  patch: Patch | null;
  /** the statistics cover the matches of the last hours */
  publicWindowHours: number;
  matches: number;
  heroes: MetaHero[];
}

/** The API did not answer or answered with an error */
export class ApiError extends Error {}

async function get<T>(path: string): Promise<T | null> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });
  } catch (error) {
    throw new ApiError(`API unavailable: ${(error as Error).message}`);
  }
  if (response.status === 204) return null;
  if (!response.ok) {
    throw new ApiError(`API answered ${response.status} for ${path}`);
  }
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
}

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  return search.toString();
};

async function required<T>(path: string): Promise<T> {
  const result = await get<T>(path);
  if (!result) throw new ApiError(`Empty answer for ${path}`);
  return result;
}

/** Patch and totals of the statistics (null before the first calculation) */
export function getMeta(): Promise<Meta | null> {
  return get<Meta>("/meta");
}

export function getMetaHeroes(filters: {
  source?: Source;
  bracket?: Bracket;
  minMatches: number;
}): Promise<MetaHeroes> {
  return required(`/meta/heroes?${query(filters)}`);
}

// ---- hero page ----

export interface HeroListItem {
  id: number;
  name: string;
  localizedName: string;
}

export interface HeroItem {
  id: number;
  name: string;
  displayName: string | null;
  cost: number | null;
  /** a complete item, not a component, consumable or recipe */
  isFinal: boolean;
  matches: number;
  wins: number;
  winRate: number;
  avgPurchaseTime: number | null;
}

export interface HeroDetails {
  hero: { id: number; matches: number };
  /** matches with the final items known: the base of the item shares */
  itemMatches?: number;
  items: HeroItem[];
}

export interface Matchup {
  id: number;
  name: string;
  localizedName: string;
  matches: number;
  wins: number;
  winRate: number;
  winRateLow: number;
  winRateHigh: number;
  delta: number;
}

export interface HeroMatchups {
  hero: { id: number; matches: number; winRate: number };
  enemies: Matchup[];
  allies: Matchup[];
}

export interface ItemTiming {
  bucket: number;
  fromMinute: number | null;
  toMinute: number | null;
  matches: number;
  winRate: number;
}

export interface TimedItem {
  id: number;
  name: string;
  displayName: string | null;
  cost: number | null;
  /** a complete item, not a component, consumable or recipe */
  isFinal: boolean;
  matches: number;
  wins: number;
  winRate: number;
  purchaseRate: number;
  avgTime: number;
  timings: ItemTiming[];
}

export interface HeroItemTimings {
  matches: number;
  items: TimedItem[];
}

/** Heroes with matches in the current patch (id and names) */
export async function getHeroList(): Promise<HeroListItem[]> {
  const { heroes } = await required<{ heroes: HeroListItem[] }>(
    "/heroes?minMatches=1",
  );
  return heroes;
}

export function getHeroItems(
  heroId: number,
  source: Source | undefined,
  minMatches: number,
): Promise<HeroDetails> {
  return required(
    `/heroes/${heroId}?${query({ source, minMatches })}`,
  );
}

export function getHeroMatchups(
  heroId: number,
  source: Source | undefined,
  minMatches: number,
): Promise<HeroMatchups> {
  return required(
    `/heroes/${heroId}/matchups?${query({ source, minMatches })}`,
  );
}

export function getHeroItemTimings(
  heroId: number,
  source: Source | undefined,
  minMatches: number,
): Promise<HeroItemTimings> {
  return required(
    `/heroes/${heroId}/item-timings?${query({ source, minMatches })}`,
  );
}

// ---- statistics by role (STRATZ) ----

export type Position = 1 | 2 | 3 | 4 | 5;
export type Tier = "S" | "A" | "B" | "C" | "D";

export interface RoleHero {
  id: number;
  name: string;
  localizedName: string;
  matches: number;
  wins: number;
  winRate: number;
  winRateLow: number;
  pickRate: number;
  score: number;
  tier: Tier;
}

export interface Roles {
  available: boolean;
  /** latest whole day of the STRATZ data (YYYY-MM-DD) */
  day: string | null;
  matches: number;
  heroes: RoleHero[];
}

export function getRoles(filters: {
  position?: Position;
  bracket?: Bracket;
}): Promise<Roles> {
  return required(`/meta/roles?${query({ ...filters, minMatches: 100 })}`);
}

// ---- abilities and talents ----

export interface Ability {
  id: number;
  name: string;
  displayName: string | null;
  isTalent: boolean;
}

export interface SkillBuild {
  abilities: (Ability | null)[];
  matches: number;
  wins: number;
  winRate: number;
  pickRate: number;
}

export interface TalentOption {
  id: number;
  name: string;
  displayName: string | null;
  matches: number;
  wins: number;
  pickRate: number;
  winRate: number | null;
}

export interface HeroAbilities {
  skillBuild: { matches: number; builds: SkillBuild[] };
  talents: {
    available: boolean;
    updatedAt: string | null;
    tiers: { level: number; options: TalentOption[] }[];
  };
}

/** Skill builds (OpenDota) and talents of a position (STRATZ; default all) */
export function getHeroAbilities(
  heroId: number,
  source?: Source,
  position?: Position,
): Promise<HeroAbilities> {
  return required(`/heroes/${heroId}/abilities?${query({ source, position })}`);
}

// ---- roles of a hero (STRATZ) ----

export interface RoleTotals {
  matches: number;
  wins: number;
  winRate: number | null;
}

export interface HeroRoles {
  available: boolean;
  day: string | null;
  all: RoleTotals;
  positions: HeroRole[];
  mostPlayed: Position | null;
}

export interface HeroRole extends RoleTotals {
  position: Position;
  /** share of the matches of the hero */
  share: number;
  winRateLow: number | null;
  pickRate: number;
  /** place among the ranked heroes of the role (null: not ranked) */
  rank: number | null;
  rankedHeroes: number;
  score: number | null;
  tier: Tier | null;
}

/** The hero in each role, on the latest STRATZ day (Divine and Immortal) */
export function getHeroRoles(
  heroId: number,
  bracket?: Bracket,
): Promise<HeroRoles> {
  return required(`/heroes/${heroId}/roles?${query({ bracket })}`);
}

// ---- items of a hero in a role (STRATZ) ----

export interface RoleItem {
  id: number;
  name: string;
  displayName: string | null;
  cost: number | null;
  /** a complete item, not a component, consumable or recipe */
  isFinal: boolean;
  matches: number;
  wins: number;
  winRate: number;
}

export interface RoleTimedItem extends RoleItem {
  /** average minute of the first purchase, in seconds */
  avgTime: number;
  timings: { fromMinute: number; toMinute: number; matches: number; winRate: number }[];
}

export interface HeroRoleItems {
  startingItems: RoleItem[];
  timings: RoleTimedItem[];
}

export function getHeroRoleItems(
  heroId: number,
  position: Position,
  minItemCost: number,
): Promise<HeroRoleItems> {
  return required(
    `/heroes/${heroId}/role-items?${query({ position, minItemCost })}`,
  );
}
