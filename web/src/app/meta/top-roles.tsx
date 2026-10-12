import Image from "next/image";
import Link from "next/link";
import type { MetaFilters, Position, Roles } from "@/lib/api";
import { heroImage, heroSlug, integer, percent, shortDay } from "@/lib/format";
import { filterHref } from "./filters";

const ROLES: { value?: Position; label: string }[] = [
  { label: "Todas" },
  { value: 1, label: "Carry" },
  { value: 2, label: "Mid" },
  { value: 3, label: "Offlane" },
  { value: 4, label: "Support" },
  { value: 5, label: "Hard Support" },
];
const SHOWN = 6;

/** Top heroes by role (STRATZ data), like the Dota2ProTracker meta page */
export function TopRoles({
  filters,
  roles,
}: {
  filters: MetaFilters;
  roles: Roles | null;
}) {
  return (
    <section className="top-roles">
      <div className="role-tabs" role="tablist" aria-label="Função">
        {ROLES.map((role) => (
          <Link
            key={role.label}
            href={filterHref(filters, { role: role.value })}
            role="tab"
            aria-selected={role.value === filters.role}
            scroll={false}
          >
            {role.label}
          </Link>
        ))}
      </div>
      <h2 className="section-title">Top heróis</h2>
      {!roles?.available ? (
        <p className="notice">
          Os dados por função ainda não estão disponíveis.
        </p>
      ) : roles.heroes.length === 0 ? (
        <p className="notice">Ainda não há partidas para esta função.</p>
      ) : (
        <>
          <div className="role-cards">
            {roles.heroes.slice(0, SHOWN).map((hero) => (
              <Link
                key={hero.id}
                href={`/heroes/${heroSlug(hero.name)}`}
                className="role-card"
              >
                <Image src={heroImage(hero.name)} alt="" width={64} height={36} />
                <div className="role-card-body">
                  <div className="role-card-name">{hero.localizedName}</div>
                  <div className="role-card-stats">
                    <span>{integer(hero.matches)}</span>
                    <span className={hero.winRate >= 0.5 ? "good" : "bad"}>
                      {percent(hero.winRate)}
                    </span>
                  </div>
                  <div className="role-card-score">
                    <span className={`tier tier-${hero.tier}`}>{hero.tier}</span>
                    <strong>{hero.score}</strong>
                    <small>/100</small>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          <p className="hint">
            {integer(roles.matches)} partidas ranqueadas (All Pick, Divine e
            Immortal) de {roles.from && shortDay(roles.from)} a{" "}
            {roles.to && shortDay(roles.to)}, com dados do{" "}
            <a href="https://stratz.com" target="_blank" rel="noreferrer">
              STRATZ
            </a>
            . A nota (0 a 100) soma 70% da posição do herói na win rate
            ajustada e 30% da posição na pick rate, entre os heróis da função;
            o tier vem dela: S a partir de 80, A de 65, B de 50, C de 35 e D
            abaixo.
          </p>
        </>
      )}
    </section>
  );
}
