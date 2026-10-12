import type { Metadata } from "next";
import {
  ApiError,
  getMeta,
  getMetaHeroes,
  getRoles,
  type Meta,
  type MetaHeroes,
  type Roles,
  type Source,
} from "@/lib/api";
import { FilterBar } from "@/components/filters";
import { parseFilters, type Filters } from "@/lib/filters";
import { dateTime, integer, periodLabel, shortDay } from "@/lib/format";
import { HeroTable } from "./hero-table";
import { TopRoles } from "./top-roles";

export const metadata: Metadata = { title: "Meta" };

function Summary({
  meta,
  data,
  source,
}: {
  meta: Meta | null;
  data: MetaHeroes;
  source: Source | undefined;
}) {
  const stats = [
    { label: "Patch", value: data.patch?.name ?? "–" },
    {
      label: "Período",
      value: periodLabel(source, data.publicWindowHours, data.patch?.name),
    },
    { label: "Partidas no filtro", value: integer(data.matches) },
    { label: "Heróis exibidos", value: integer(data.heroes.length) },
    {
      label: "Atualizado em",
      value: meta ? dateTime(meta.updatedAt) : "–",
    },
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

const ROLE_NAMES = ["Carry", "Mid", "Offlane", "Support", "Hard Support"];

/**
 * The table below follows the role chosen in the tabs (STRATZ data), with
 * the same columns of all roles: the durations, which STRATZ does not have by
 * role, come from all the matches of the hero (OpenDota)
 */
function RoleSection({
  filters,
  roles,
  allRoles,
}: {
  filters: Filters;
  roles: Roles;
  allRoles: MetaHeroes;
}) {
  const durations = new Map(
    allRoles.heroes.map((hero) => [hero.id, hero.durations]),
  );
  const heroes = roles.heroes
    .filter((hero) => hero.matches >= filters.minMatches)
    .map((hero) => ({ ...hero, durations: durations.get(hero.id) ?? null }));
  const stats = [
    { label: "Função", value: ROLE_NAMES[(filters.role ?? 1) - 1] },
    { label: "Dia (STRATZ)", value: roles.day ? shortDay(roles.day) : "–" },
    { label: "Partidas na função", value: integer(roles.matches) },
    { label: "Heróis exibidos", value: integer(heroes.length) },
  ];
  return (
    <>
      <h2 className="section-title">Heróis da função</h2>
      <div className="summary">
        {stats.map((stat) => (
          <div key={stat.label} className="stat">
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value">{stat.value}</div>
          </div>
        ))}
      </div>
      {heroes.length > 0 ? (
        <HeroTable heroes={heroes} />
      ) : (
        <p className="notice">
          Nenhum herói atinge a amostra mínima nesta função.
        </p>
      )}
      <p className="hint">
        Dados do STRATZ: partidas ranqueadas Divine e Immortal do último dia
        completo em que o herói jogou nesta função, só heróis com pelo menos
        100 partidas nela; a nota compara os heróis da função. O STRATZ não
        informa a duração por função, então as colunas de duração mostram o
        herói em todas as funções (OpenDota, últimas 24 h).
      </p>
    </>
  );
}

function Legend() {
  return (
    <dl className="legend">
      <dt>Nota (ordem padrão)</dt>
      <dd>
        De 0 a 100: 70% da posição do herói na win rate ajustada e 30% da
        posição na pick rate, entre os heróis da tabela; o tier vem dela (S a
        partir de 80, A de 65, B de 50, C de 35 e D abaixo). A win rate ajustada
        é a win rate que a amostra garante, com 95% de confiança (limite
        inferior do intervalo de Wilson): 6 vitórias em 8 jogos (75%) valem
        41%, enquanto 550 em 1.000 (55%) valem 52%. Assim, heróis com amostra
        pequena não chegam ao topo por acaso.
      </dd>
      <dt>Ordenação</dt>
      <dd>
        Clique no título de uma coluna para ordenar do maior para o menor; o
        segundo clique ordena do menor para o maior, e o terceiro tira a coluna
        da ordenação. Clicando em mais colunas, elas desempatam na ordem dos
        cliques (o número ao lado da seta). Sem colunas, vale a ordem padrão,
        pela nota.
      </dd>
      <dt>Pick rate</dt>
      <dd>Parcela das partidas do filtro em que o herói foi escolhido.</dd>
      <dt>Win rate por duração</dt>
      <dd>
        Mostra em que fase o herói rende mais: heróis que vencem cedo caem nas
        partidas longas, e os de fim de jogo crescem nelas. Passe o mouse para
        ver o número de partidas.
      </dd>
      <dt>Período</dt>
      <dd>
        As partidas públicas contam nas últimas 24 horas, o meta do momento; as
        profissionais, bem menos numerosas, contam no patch inteiro. Os dados
        por função vêm do STRATZ, que fecha os números por dia: eles são do
        último dia completo.
      </dd>
      <dt>Rank</dt>
      <dd>
        Rank médio da partida pública. As partidas profissionais não têm rank e
        ficam de fora quando um rank é escolhido.
      </dd>
    </dl>
  );
}

export default async function MetaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = parseFilters(await searchParams);

  let meta: Meta | null;
  let data: MetaHeroes;
  let roles: Roles | null;
  try {
    [meta, data, roles] = await Promise.all([
      getMeta(),
      getMetaHeroes({
        source: filters.source,
        bracket: filters.bracket,
        minMatches: filters.minMatches,
      }),
      // STRATZ covers ranked public matches only
      filters.source === "pro"
        ? null
        : getRoles({ position: filters.role, bracket: filters.bracket }),
    ]);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return (
      <>
        <h1>Meta</h1>
        <p className="notice">
          Não foi possível carregar as estatísticas agora. Tente de novo em
          alguns instantes.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Meta{data.patch ? ` · patch ${data.patch.name}` : ""}</h1>
      <p className="subtitle">
        Os heróis mais fortes do patch atual, em partidas profissionais e
        públicas de alto rank.
      </p>
      <FilterBar path="/meta" filters={filters} />
      {filters.source !== "pro" && <TopRoles filters={filters} roles={roles} />}
      {filters.role && roles?.available ? (
        <RoleSection filters={filters} roles={roles} allRoles={data} />
      ) : (
        <>
          <h2 className="section-title">Todos os heróis</h2>
          <Summary meta={meta} data={data} source={filters.source} />
          {data.heroes.length > 0 ? (
            <HeroTable heroes={data.heroes} />
          ) : (
            <p className="notice">
              {data.matches > 0
                ? "Nenhum herói atinge a amostra mínima neste filtro. Diminua a amostra mínima."
                : "Ainda não há partidas para este filtro."}
            </p>
          )}
        </>
      )}
      <Legend />
    </>
  );
}
