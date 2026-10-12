"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DurationStats, MetaHero } from "@/lib/api";
import { heroImage, heroSlug, integer, percent, points } from "@/lib/format";
import { Sparkline } from "@/components/sparkline";
import { sortRows, toggleSort, type SortRule } from "./sorting";

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
  // empty: the order of the API (adjusted win rate, highest first)
  const [rules, setRules] = useState<SortRule<SortKey>[]>([]);

  const sorted = useMemo(
    () => sortRows(heroes, rules, valueOf),
    [heroes, rules],
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th className="rank">#</th>
            {COLUMNS.map((column) => {
              const position = rules.findIndex((rule) => rule.key === column.key);
              const rule = rules[position];
              return (
                <th
                  key={column.key}
                  title={column.title}
                  className={column.key === "hero" ? "text-left" : undefined}
                  aria-sort={
                    // only the column that decides the order
                    position === 0
                      ? rule.desc
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => setRules((current) => toggleSort(current, column.key))}
                  >
                    {column.label}
                    {rule && (
                      <span className="sort-indicator">
                        {rule.desc ? " ↓" : " ↑"}
                        {rules.length > 1 && <sup>{position + 1}</sup>}
                      </span>
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((hero, index) => (
            <tr key={hero.id}>
              <td className="rank">{index + 1}</td>
              <td className="text-left">
                <Link href={`/heroes/${heroSlug(hero.name)}`} className="hero-cell">
                  <Image
                    src={heroImage(hero.name)}
                    alt=""
                    width={48}
                    height={27}
                  />
                  {hero.localizedName}
                </Link>
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
