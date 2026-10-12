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
