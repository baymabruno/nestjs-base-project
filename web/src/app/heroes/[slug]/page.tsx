import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Segmented } from "@/components/segmented";
import { Sparkline } from "@/components/sparkline";
import {
  ApiError,
  getHeroItems,
  getHeroItemTimings,
  getHeroList,
  getHeroMatchups,
  getMetaHeroes,
  type DurationStats,
  type HeroItem,
  type Matchup,
  type MetaHero,
  type Source,
  type TimedItem,
} from "@/lib/api";
import {
  gameTime,
  heroImage,
  heroSlug,
  integer,
  itemImage,
  percent,
  points,
} from "@/lib/format";

// the patch statistics cover the retention period
const PERIOD_DAYS = 30;
// matchups and timings with fewer matches are left out
const MIN_MATCHUP_MATCHES = 30;
const MATCHUPS_SHOWN = 8;
const ATTRIBUTES: Record<string, string> = {
  str: "Força",
  agi: "Agilidade",
  int: "Inteligência",
  all: "Universal",
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const parseSource = (value: string | string[] | undefined): Source | undefined =>
  value === "pro" || value === "public" ? value : undefined;

async function findHero(slug: string) {
  const heroes = await getHeroList();
  return heroes.find((hero) => heroSlug(hero.name) === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  try {
    const hero = await findHero(slug);
    return { title: hero?.localizedName ?? "Herói" };
  } catch {
    return { title: "Herói" };
  }
}

// ---- sections ----

function Summary({ hero, rank, total }: { hero: MetaHero; rank: number; total: number }) {
  const stats = [
    { label: "Partidas", value: integer(hero.matches) },
    { label: "Win rate", value: percent(hero.winRate) },
    { label: "WR ajustada", value: percent(hero.winRateLow) },
    { label: "Pick rate", value: percent(hero.pickRate) },
    { label: "Posição no meta", value: `${rank}º de ${total}` },
  ];
  return (
    <div className="summary">
      {stats.map((stat) => (
        <div key={stat.label} className="stat">
          <div className="stat-label">{stat.label}</div>
          <div className="stat-value">{stat.value}</div>
        </div>
      ))}
    </div>
  );
}

const rateClass = (rate: number | null) =>
  rate === null ? "muted" : rate >= 0.53 ? "good" : rate <= 0.47 ? "bad" : "";

function Durations({ hero }: { hero: MetaHero }) {
  const rows: [string, DurationStats][] = [
    ["Até 35 min", hero.durations.short],
    ["35 a 50 min", hero.durations.medium],
    ["50 min ou mais", hero.durations.long],
  ];
  return (
    <div className="card">
      <h2>Por duração da partida</h2>
      <table className="compact">
        <tbody>
          {rows.map(([label, stats]) => (
            <tr key={label}>
              <td className="text-left">{label}</td>
              <td className={rateClass(stats.winRate)}>{percent(stats.winRate)}</td>
              <td className="muted">{integer(stats.matches)} partidas</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Win rate por dia</h2>
      <Sparkline daily={hero.daily} width={320} height={64} />
    </div>
  );
}

function ItemName({ name, displayName }: { name: string; displayName: string | null }) {
  return (
    <span className="item-cell">
      <Image src={itemImage(name)} alt="" width={33} height={24} />
      {displayName ?? name}
    </span>
  );
}

// matches may be missing in a cached answer of an older API version
function FinalItems({ items, matches }: { items: HeroItem[]; matches?: number }) {
  return (
    <div className="card">
      <h2>Itens finais</h2>
      <p className="hint">
        Itens a partir de 1.000 de ouro no inventário ao fim da partida. O
        uso é a parcela das {matches ? integer(matches) : "–"} partidas em que os itens são
        conhecidos (os detalhes de cada partida dependem da cota do
        OpenDota); passe o mouse para ver a amostra.
      </p>
      {items.length === 0 ? (
        <p className="muted">Ainda não há partidas com os itens deste herói.</p>
      ) : (
        <div className="table-wrap">
          <table className="compact">
            <thead>
              <tr>
                <th className="text-left">Item</th>
                <th>Uso</th>
                <th>Win rate</th>
                <th title="Média da primeira compra (partidas com a ordem de compra)">Compra</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 12).map((item) => (
                <tr key={item.id}>
                  <td className="text-left">
                    <ItemName name={item.name} displayName={item.displayName} />
                  </td>
                  <td title={`${integer(item.matches)} partidas`}>
                    {percent(matches ? item.matches / matches : null)}
                  </td>
                  <td className={rateClass(item.winRate)}>{percent(item.winRate)}</td>
                  <td className="muted">
                    {item.avgPurchaseTime === null ? "–" : gameTime(item.avgPurchaseTime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// items bought before the horn in most matches
const isStartingItem = (item: TimedItem) =>
  (item.timings.find((timing) => timing.bucket === 0)?.matches ?? 0) / item.matches >= 0.5;

function StartingItems({ items }: { items: TimedItem[] }) {
  const starting = items.filter(isStartingItem).slice(0, 8);
  return (
    <div className="card">
      <h2>Itens iniciais</h2>
      {starting.length === 0 ? (
        <p className="muted">Ainda não há partidas com a ordem de compra.</p>
      ) : (
        <ul className="item-list">
          {starting.map((item) => (
            <li key={item.id}>
              <ItemName name={item.name} displayName={item.displayName} />
              <span className="muted">{percent(item.purchaseRate)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const timingLabel = (from: number | null, to: number | null) =>
  from === null ? "Início" : to === null ? `${from}+` : `${from}–${to}`;

function Timings({ items, matches }: { items: TimedItem[]; matches: number }) {
  const core = items
    .filter((item) => (item.cost ?? 0) >= 1000 && !isStartingItem(item))
    .slice(0, 10);
  return (
    <div className="card">
      <h2>Tempo de compra × win rate</h2>
      <p className="hint">
        Win rate pelo minuto da primeira compra de cada item, em faixas de 5
        minutos. Só as partidas com a ordem de compra contam (
        {integer(matches)} deste herói): passe o mouse para ver a amostra de
        cada faixa e leve em conta que amostras pequenas variam muito.
      </p>
      {core.length === 0 ? (
        <p className="muted">Ainda não há partidas com a ordem de compra.</p>
      ) : (
        <div className="table-wrap">
          <table className="compact">
            <thead>
              <tr>
                <th className="text-left">Item</th>
                <th>Compras</th>
                <th>Média</th>
                <th className="text-left">Win rate por minuto da compra</th>
              </tr>
            </thead>
            <tbody>
              {core.map((item) => (
                <tr key={item.id}>
                  <td className="text-left">
                    <ItemName name={item.name} displayName={item.displayName} />
                  </td>
                  <td>{integer(item.matches)}</td>
                  <td className="muted">{gameTime(item.avgTime)}</td>
                  <td className="text-left">
                    <div className="timings">
                      {item.timings.map((timing) => (
                        <span
                          key={timing.bucket}
                          className={`timing ${rateClass(timing.winRate)}`}
                          title={`${timingLabel(timing.fromMinute, timing.toMinute)} min: ${percent(timing.winRate)} em ${integer(timing.matches)} partidas`}
                        >
                          <small>{timingLabel(timing.fromMinute, timing.toMinute)}</small>
                          {percent(timing.winRate, 0)}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MatchupList({
  title,
  hint,
  matchups,
}: {
  title: string;
  hint: string;
  matchups: Matchup[];
}) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p className="hint">{hint}</p>
      {matchups.length === 0 ? (
        <p className="muted">Amostra insuficiente.</p>
      ) : (
        <ul className="matchup-list">
          {matchups.map((matchup) => (
            <li key={matchup.id}>
              <Link href={`/heroes/${heroSlug(matchup.name)}`} className="hero-cell">
                <Image src={heroImage(matchup.name)} alt="" width={40} height={22} />
                {matchup.localizedName}
              </Link>
              <span className={rateClass(matchup.winRate)}>{percent(matchup.winRate)}</span>
              <span
                className={matchup.delta > 0 ? "good" : matchup.delta < 0 ? "bad" : "muted"}
                title="Diferença para a win rate geral do herói"
              >
                {points(matchup.delta)}
              </span>
              <span className="muted">{integer(matchup.matches)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- page ----

export default async function HeroPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const source = parseSource((await searchParams).source);

  let data;
  try {
    const listed = await findHero(slug);
    if (!listed) notFound();
    const [meta, items, timings, matchups] = await Promise.all([
      getMetaHeroes({ source, days: PERIOD_DAYS, minMatches: 1 }),
      getHeroItems(listed.id, source),
      getHeroItemTimings(listed.id, source),
      getHeroMatchups(listed.id, source, MIN_MATCHUP_MATCHES),
    ]);
    data = { listed, meta, items, timings, matchups };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <p className="notice">
        Não foi possível carregar este herói agora. Tente de novo em alguns
        instantes.
      </p>
    );
  }
  const { listed, meta, items, timings, matchups } = data;
  const rank = meta.heroes.findIndex((hero) => hero.id === listed.id) + 1;
  const hero = meta.heroes[rank - 1];

  // best and worst results the sample supports (Wilson bounds)
  const strongAgainst = [...matchups.enemies]
    .sort((a, b) => b.winRateLow - a.winRateLow)
    .slice(0, MATCHUPS_SHOWN);
  const weakAgainst = [...matchups.enemies]
    .sort((a, b) => a.winRateHigh - b.winRateHigh)
    .slice(0, MATCHUPS_SHOWN);
  const bestAllies = [...matchups.allies]
    .sort((a, b) => b.winRateLow - a.winRateLow)
    .slice(0, MATCHUPS_SHOWN);

  return (
    <>
      <p className="breadcrumb">
        <Link href="/meta">Meta</Link> / {listed.localizedName}
      </p>
      <div className="hero-header">
        <Image src={heroImage(listed.name)} alt="" width={128} height={72} priority />
        <div>
          <h1>{listed.localizedName}</h1>
          {hero && (
            <p className="subtitle">
              {ATTRIBUTES[hero.primaryAttr] ?? hero.primaryAttr} · {hero.roles.join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="filters">
        <Segmented
          label="Partidas"
          current={source}
          options={[
            { value: undefined, label: "Todas" },
            { value: "pro" as const, label: "Profissionais" },
            { value: "public" as const, label: "Públicas" },
          ]}
          href={(value) => (value ? `/heroes/${slug}?source=${value}` : `/heroes/${slug}`)}
        />
      </div>

      {hero ? (
        <>
          <p className="hint">
            Patch {meta.patch?.name}, últimos {PERIOD_DAYS} dias.
          </p>
          <Summary hero={hero} rank={rank} total={meta.heroes.length} />
          <div className="grid-2">
            <Durations hero={hero} />
            <StartingItems items={timings.items} />
          </div>
          <div className="grid-2">
            <FinalItems items={items.items} matches={items.itemMatches} />
            <MatchupList
              title="Melhores aliados"
              hint={`Win rate com cada aliado (mínimo de ${MIN_MATCHUP_MATCHES} partidas).`}
              matchups={bestAllies}
            />
          </div>
          <Timings items={timings.items} matches={timings.matches} />
          <div className="grid-2">
            <MatchupList
              title="Bom contra"
              hint={`Win rate contra cada inimigo (mínimo de ${MIN_MATCHUP_MATCHES} partidas), pela win rate que a amostra garante.`}
              matchups={strongAgainst}
            />
            <MatchupList
              title="Fraco contra"
              hint="Os inimigos em que, mesmo no melhor caso da amostra, a win rate é baixa."
              matchups={weakAgainst}
            />
          </div>
          <p className="hint">
            A coluna em p.p. é a diferença para a win rate geral do herói (
            {percent(matchups.hero.winRate)}); o último número é a amostra.
          </p>
        </>
      ) : (
        <p className="notice">Ainda não há partidas deste herói neste filtro.</p>
      )}
    </>
  );
}
