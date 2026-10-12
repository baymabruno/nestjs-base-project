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
  durations: { short: DurationStats; medium: DurationStats; long: DurationStats };
  trend: number | null;
  daily: { day: string; matches: number; winRate: number | null }[];
}

export interface MetaHeroes {
  patch: Patch | null;
  from: string;
  to: string;
  matches: number;
  heroes: MetaHero[];
}

export interface MetaFilters {
  source?: Source;
  bracket?: Bracket;
  days: number;
  minMatches: number;
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

/** Patch and totals of the statistics (null before the first calculation) */
export function getMeta(): Promise<Meta | null> {
  return get<Meta>("/meta");
}

export async function getMetaHeroes(filters: MetaFilters): Promise<MetaHeroes> {
  const params = new URLSearchParams({
    days: String(filters.days),
    minMatches: String(filters.minMatches),
  });
  if (filters.source) params.set("source", filters.source);
  if (filters.bracket) params.set("bracket", filters.bracket);
  const result = await get<MetaHeroes>(`/meta/heroes?${params}`);
  if (!result) throw new ApiError("Empty answer for /meta/heroes");
  return result;
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

/** Heroes with matches in the current patch (id and names) */
export async function getHeroList(): Promise<HeroListItem[]> {
  const { heroes } = await required<{ heroes: HeroListItem[] }>(
    "/heroes?minMatches=1",
  );
  return heroes;
}

export function getHeroItems(
  heroId: number,
  source?: Source,
): Promise<HeroDetails> {
  return required(
    `/heroes/${heroId}?${query({ source, minMatches: 1, minItemCost: 1000 })}`,
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
  source?: Source,
): Promise<HeroItemTimings> {
  return required(
    `/heroes/${heroId}/item-timings?${query({ source, minMatches: 1 })}`,
  );
}
