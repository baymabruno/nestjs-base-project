import Image from "next/image";
import Link from "next/link";
import type { HeroRoles, Position, RoleTotals } from "@/lib/api";
import { filterHref, type Filters } from "@/lib/filters";
import { heroImage, integer, percent, shortDay } from "@/lib/format";

export const ROLE_NAMES = ["Carry", "Mid", "Offlane", "Support", "Hard Support"];

function Totals({ totals }: { totals: RoleTotals }) {
  return (
    <div className="role-numbers">
      <span
        className={
          totals.winRate !== null && totals.winRate >= 0.5 ? "good" : "bad"
        }
      >
        {percent(totals.winRate)}
      </span>
      <span className="role-matches">{integer(totals.matches)}</span>
    </div>
  );
}

/**
 * Header of the hero page: the hero in every role, like the Dota2ProTracker
 * hero page (STRATZ data, ranked Divine and Immortal matches). Each role is a
 * link that shows the page for that role; the most played one is the default.
 */
export function RolesBar({
  name,
  localizedName,
  roles,
  path,
  filters,
  selected,
}: {
  name: string;
  localizedName: string;
  roles: HeroRoles;
  path: string;
  filters: Filters;
  /** the role shown (empty: all roles) */
  selected: Position | undefined;
}) {
  const bracket =
    filters.bracket === "divine"
      ? "Divine"
      : filters.bracket === "immortal"
        ? "Immortal"
        : "Divine e Immortal";
  const column = (role: Position | undefined, popular: boolean) => {
    const current = role === selected;
    return {
      // all roles go in the URL, as the default of the page is a role
      href: filterHref(path, filters, { role, allRoles: !role || undefined }),
      scroll: false,
      className: `role-column${popular ? " role-popular" : ""}${current ? " role-selected" : ""}`,
      "aria-current": current ? ("page" as const) : undefined,
    };
  };
  return (
    <div className="roles-bar">
      <div className="roles-bar-hero">
        <Image src={heroImage(name)} alt="" width={128} height={72} priority />
        <div>
          <h1>{localizedName}</h1>
          <p className="muted">
            {roles.day ? `Dia ${shortDay(roles.day)}` : "Último dia"} ·{" "}
            {bracket}
          </p>
        </div>
      </div>
      <nav className="roles-bar-roles" aria-label="Função">
        <Link {...column(undefined, false)}>
          <div className="role-name">Todas</div>
          <Totals totals={roles.all} />
        </Link>
        {roles.positions.map((role) => {
          const popular = role.position === roles.mostPlayed;
          return (
            <Link
              key={role.position}
              {...column(role.position, popular)}
              title={`${percent(role.share)} das partidas do herói`}
            >
              {popular && <div className="role-badge">Mais jogada</div>}
              <div className="role-name">{ROLE_NAMES[role.position - 1]}</div>
              <Totals totals={role} />
              {role.score !== null && (
                <div className="role-score">
                  <span className={`tier tier-${role.tier}`}>{role.tier}</span>
                  <strong>{role.score}</strong>
                  <small>/100</small>
                </div>
              )}
              <div className="role-share" aria-hidden="true">
                <span style={{ width: `${Math.round(role.share * 100)}%` }} />
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
