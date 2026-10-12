import type { Bracket, Position, Source } from "@/lib/api";

// Filters of the meta and hero pages, kept in the URL

export const SAMPLE_OPTIONS = [1, 20, 100, 500] as const;
// default: every hero ("Todas")
const DEFAULT_MIN_MATCHES = 1;

export interface Filters {
  source?: Source;
  bracket?: Bracket;
  minMatches: number;
  /** selected role (empty: all roles) */
  role?: Position;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const oneOf = <T extends string | number>(
  value: string | undefined,
  options: readonly T[],
): T | undefined => options.find((option) => String(option) === value);

/** Reads the filters from the URL, ignoring invalid values */
export function parseFilters(params: SearchParams): Filters {
  const role = oneOf(first(params.role), ["1", "2", "3", "4", "5"] as const);
  return {
    source: oneOf<Source>(first(params.source), ["pro", "public"]),
    bracket: oneOf<Bracket>(first(params.bracket), ["divine", "immortal"]),
    minMatches: oneOf(first(params.min), SAMPLE_OPTIONS) ?? DEFAULT_MIN_MATCHES,
    role: role ? (Number(role) as Position) : undefined,
  };
}

/** URL of a page (e.g. /meta) with some filters changed */
export function filterHref(path: string, filters: Filters, change: Partial<Filters>): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.source) params.set("source", next.source);
  if (next.bracket) params.set("bracket", next.bracket);
  if (next.minMatches !== DEFAULT_MIN_MATCHES) params.set("min", String(next.minMatches));
  if (next.role) params.set("role", String(next.role));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
