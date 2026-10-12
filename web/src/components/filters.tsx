import { Segmented } from "@/components/segmented";
import { filterHref, SAMPLE_OPTIONS, type Filters } from "@/lib/filters";

/** Filters of the meta and hero pages: matches, rank and minimum sample */
export function FilterBar({ path, filters }: { path: string; filters: Filters }) {
  const href = (change: Partial<Filters>) => filterHref(path, filters, change);
  return (
    <div className="filters">
      <Segmented
        label="Partidas"
        current={filters.source}
        options={[
          { value: undefined, label: "Todas" },
          { value: "pro" as const, label: "Profissionais" },
          { value: "public" as const, label: "Públicas" },
        ]}
        // the rank only exists in public matches
        href={(source) =>
          href({ source, bracket: source === "pro" ? undefined : filters.bracket })
        }
      />
      <Segmented
        label="Rank (públicas)"
        current={filters.bracket}
        options={[
          { value: undefined, label: "Todos" },
          { value: "divine" as const, label: "Divine" },
          { value: "immortal" as const, label: "Immortal" },
        ]}
        href={(bracket) => href({ bracket, source: bracket ? "public" : filters.source })}
      />
      <Segmented
        label="Amostra mínima"
        current={filters.minMatches}
        options={SAMPLE_OPTIONS.map((min) => ({
          value: min,
          label: min === 1 ? "Todas" : `${min}+`,
        }))}
        href={(minMatches) => href({ minMatches })}
      />
    </div>
  );
}
