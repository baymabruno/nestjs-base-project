import type { Bracket, MetaFilters, Source } from "@/lib/api";

export const DAY_OPTIONS = [1, 3, 8, 14, 30] as const;
export const SAMPLE_OPTIONS = [1, 20, 100, 500] as const;
export const DEFAULT_FILTERS: MetaFilters = { days: 8, minMatches: 20 };

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const oneOf = <T extends string | number>(
  value: string | undefined,
  options: readonly T[],
): T | undefined => options.find((option) => String(option) === value);

/** Reads the filters from the URL, ignoring invalid values */
export function parseFilters(params: SearchParams): MetaFilters {
  return {
    source: oneOf<Source>(first(params.source), ["pro", "public"]),
    bracket: oneOf<Bracket>(first(params.bracket), ["divine", "immortal"]),
    days: oneOf(first(params.days), DAY_OPTIONS) ?? DEFAULT_FILTERS.days,
    minMatches:
      oneOf(first(params.min), SAMPLE_OPTIONS) ?? DEFAULT_FILTERS.minMatches,
    role: oneOf(first(params.role), ["1", "2", "3", "4", "5"] as const)
      ? (Number(first(params.role)) as MetaFilters["role"])
      : undefined,
  };
}

/** URL of the meta page with some filters changed */
export function filterHref(
  filters: MetaFilters,
  change: Partial<MetaFilters>,
): string {
  const next = { ...filters, ...change };
  const params = new URLSearchParams();
  if (next.source) params.set("source", next.source);
  if (next.bracket) params.set("bracket", next.bracket);
  if (next.days !== DEFAULT_FILTERS.days) params.set("days", String(next.days));
  if (next.minMatches !== DEFAULT_FILTERS.minMatches) {
    params.set("min", String(next.minMatches));
  }
  if (next.role) params.set("role", String(next.role));
  const query = params.toString();
  return query ? `/meta?${query}` : "/meta";
}
