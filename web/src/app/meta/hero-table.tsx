"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DurationStats, Tier } from "@/lib/api";
import { heroImage, heroSlug, integer, percent } from "@/lib/format";
import { sortRows, toggleSort, type SortRule } from "./sorting";

/** A hero of the table: all roles (OpenDota) or a role (STRATZ) */
export interface HeroRow {
  id: number;
  name: string;
  localizedName: string;
  score: number;
  tier: Tier;
  matches: number;
  winRate: number;
  pickRate: number;
  /** null: the hero has no matches with the duration in the filters */
  durations: {
    short: DurationStats;
    medium: DurationStats;
    long: DurationStats;
  } | null;
}

type SortKey =
  | "score"
  | "hero"
  | "matches"
  | "winRate"
  | "pickRate"
  | "short"
  | "medium"
  | "long";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: "score", label: "Nota", title: "Nota (0 a 100) e tier" },
  { key: "hero", label: "Herói", title: "Nome do herói" },
  { key: "matches", label: "Partidas", title: "Partidas com o herói" },
  { key: "winRate", label: "Win rate", title: "Vitórias / partidas" },
  { key: "pickRate", label: "Pick rate", title: "Partidas com o herói / total de partidas" },
  { key: "short", label: "< 35 min", title: "Win rate em partidas de até 35 minutos" },
  { key: "medium", label: "35–50 min", title: "Win rate em partidas de 35 a 50 minutos" },
  { key: "long", label: "50+ min", title: "Win rate em partidas de 50 minutos ou mais" },
];

const valueOf = (hero: HeroRow, key: SortKey): number | string | null => {
  switch (key) {
    case "hero":
      return hero.localizedName;
    case "short":
    case "medium":
    case "long":
      return hero.durations?.[key].winRate ?? null;
    default:
      return hero[key];
  }
};

// win rate colored from 47% (red) to 53% (green)
const rateClass = (rate: number | null) =>
  rate === null ? "muted" : rate >= 0.53 ? "good" : rate <= 0.47 ? "bad" : "";

function DurationCell({ stats }: { stats: DurationStats | undefined }) {
  if (!stats) return <td className="muted">–</td>;
  return (
    <td className={rateClass(stats.winRate)} title={`${integer(stats.matches)} partidas`}>
      {percent(stats.winRate)}
    </td>
  );
}

/**
 * Heroes of the meta page, with multi-column sorting: the same columns for
 * all roles and for a role
 */
export function HeroTable({ heroes }: { heroes: HeroRow[] }) {
  // empty: the order of the API (score, highest first)
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
              <td>
                <span className="role-card-score">
                  <span className={`tier tier-${hero.tier}`}>{hero.tier}</span>
                  <strong>{hero.score}</strong>
                </span>
              </td>
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
              <td>{percent(hero.pickRate)}</td>
              <DurationCell stats={hero.durations?.short} />
              <DurationCell stats={hero.durations?.medium} />
              <DurationCell stats={hero.durations?.long} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
