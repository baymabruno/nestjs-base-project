"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import type { DurationStats, MetaHero } from "@/lib/api";
import { heroImage, integer, percent, points } from "@/lib/format";
import { Sparkline } from "./sparkline";

type SortKey =
  | "hero"
  | "matches"
  | "winRate"
  | "winRateLow"
  | "pickRate"
  | "short"
  | "medium"
  | "long"
  | "trend";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "hero", label: "Herói", title: "Nome do herói" },
  { key: "matches", label: "Partidas", title: "Partidas com o herói no período" },
  { key: "winRate", label: "Win rate", title: "Vitórias / partidas" },
  {
    key: "winRateLow",
    label: "WR ajustada",
    title: "Win rate que a amostra garante (limite inferior de Wilson, 95%)",
  },
  { key: "pickRate", label: "Pick rate", title: "Partidas com o herói / total de partidas" },
  { key: "short", label: "< 35 min", title: "Win rate em partidas de até 35 minutos" },
  { key: "medium", label: "35–50 min", title: "Win rate em partidas de 35 a 50 minutos" },
  { key: "long", label: "50+ min", title: "Win rate em partidas de 50 minutos ou mais" },
  {
    key: "trend",
    label: "Tendência",
    title: "Win rate por dia e a variação da segunda metade do período em relação à primeira",
  },
];

const valueOf = (hero: MetaHero, key: SortKey): number | string | null => {
  switch (key) {
    case "hero":
      return hero.localizedName;
    case "short":
    case "medium":
    case "long":
      return hero.durations[key].winRate;
    default:
      return hero[key];
  }
};

// win rate colored from 47% (red) to 53% (green)
const rateClass = (rate: number | null) =>
  rate === null ? "muted" : rate >= 0.53 ? "good" : rate <= 0.47 ? "bad" : "";

function DurationCell({ stats }: { stats: DurationStats }) {
  return (
    <td className={rateClass(stats.winRate)} title={`${integer(stats.matches)} partidas`}>
      {percent(stats.winRate)}
    </td>
  );
}

export function MetaTable({ heroes }: { heroes: MetaHero[] }) {
  // the API ranks by the adjusted win rate
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "winRateLow",
    desc: true,
  });

  const sorted = useMemo(() => {
    const direction = sort.desc ? -1 : 1;
    return [...heroes].sort((a, b) => {
      const left = valueOf(a, sort.key);
      const right = valueOf(b, sort.key);
      // no data always goes last
      if (left === null) return 1;
      if (right === null) return -1;
      if (typeof left === "string") {
        return left.localeCompare(right as string, "pt-BR") * direction;
      }
      return ((left as number) - (right as number)) * direction;
    });
  }, [heroes, sort]);

  const toggle = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, desc: !current.desc }
        : // names start A-Z, numbers start from the highest
          { key, desc: key !== "hero" },
    );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="rank">#</th>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                title={column.title}
                className={column.key === "hero" ? "text-left" : undefined}
                aria-sort={
                  sort.key === column.key
                    ? sort.desc
                      ? "descending"
                      : "ascending"
                    : undefined
                }
              >
                <button type="button" onClick={() => toggle(column.key)}>
                  {column.label}
                  {sort.key === column.key ? (sort.desc ? " ↓" : " ↑") : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((hero, index) => (
            <tr key={hero.id}>
              <td className="rank">{index + 1}</td>
              <td className="text-left">
                <div className="hero-cell">
                  <Image
                    src={heroImage(hero.name)}
                    alt=""
                    width={48}
                    height={27}
                  />
                  {hero.localizedName}
                </div>
              </td>
              <td>{integer(hero.matches)}</td>
              <td className={rateClass(hero.winRate)}>{percent(hero.winRate)}</td>
              {/* a lower bound: green only when the sample assures 50%+ */}
              <td className={hero.winRateLow >= 0.5 ? "good" : ""}>
                <strong>{percent(hero.winRateLow)}</strong>
              </td>
              <td>{percent(hero.pickRate)}</td>
              <DurationCell stats={hero.durations.short} />
              <DurationCell stats={hero.durations.medium} />
              <DurationCell stats={hero.durations.long} />
              <td>
                <span className="trend-cell">
                  <Sparkline daily={hero.daily} />
                  {hero.trend === null ? (
                    <span className="muted">–</span>
                  ) : (
                    <span className={hero.trend > 0 ? "good" : hero.trend < 0 ? "bad" : ""}>
                      {points(hero.trend)}
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
