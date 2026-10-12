import type { Metadata } from "next";
import {
  ApiError,
  getMeta,
  getMetaHeroes,
  type Meta,
  type MetaFilters,
  type MetaHeroes,
} from "@/lib/api";
import { dateTime, integer, shortDay } from "@/lib/format";
import {
  DAY_OPTIONS,
  filterHref,
  parseFilters,
  SAMPLE_OPTIONS,
} from "./filters";
import { MetaTable } from "./meta-table";
import { Segmented } from "@/components/segmented";

export const metadata: Metadata = { title: "Meta" };

function Filters({ filters }: { filters: MetaFilters }) {
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
        href={(source) =>
          // the rank only exists in public matches
          filterHref(filters, { source, bracket: source === "pro" ? undefined : filters.bracket })
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
        href={(bracket) =>
          filterHref(filters, {
            bracket,
            source: bracket ? "public" : filters.source,
          })
        }
      />
      <Segmented
        label="Período"
        current={filters.days}
        options={DAY_OPTIONS.map((days) => ({
          value: days,
          label: days === 1 ? "Hoje" : `${days} dias`,
        }))}
        href={(days) => filterHref(filters, { days })}
      />
      <Segmented
        label="Amostra mínima"
        current={filters.minMatches}
        options={SAMPLE_OPTIONS.map((min) => ({
          value: min,
          label: min === 1 ? "Todas" : `${min}+`,
        }))}
        href={(minMatches) => filterHref(filters, { minMatches })}
      />
    </div>
  );
}

function Summary({ meta, data }: { meta: Meta | null; data: MetaHeroes }) {
  const stats = [
    { label: "Patch", value: data.patch?.name ?? "–" },
    {
      label: "Período",
      value:
        data.from === data.to
          ? shortDay(data.to)
          : `${shortDay(data.from)} a ${shortDay(data.to)}`,
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

function Legend() {
  return (
    <dl className="legend">
      <dt>WR ajustada (ordem padrão)</dt>
      <dd>
        A win rate que a amostra garante, com 95% de confiança (limite inferior
        do intervalo de Wilson). Com poucas partidas ela fica bem abaixo da win
        rate: 6 vitórias em 8 jogos (75%) valem 41%, enquanto 550 em 1.000 (55%)
        valem 52%. Assim, heróis com amostra pequena não aparecem no topo por
        acaso.
      </dd>
      <dt>Pick rate</dt>
      <dd>Parcela das partidas do filtro em que o herói foi escolhido.</dd>
      <dt>Win rate por duração</dt>
      <dd>
        Mostra em que fase o herói rende mais: heróis que vencem cedo caem nas
        partidas longas, e os de fim de jogo crescem nelas. Passe o mouse para
        ver o número de partidas.
      </dd>
      <dt>Tendência</dt>
      <dd>
        Win rate por dia (a linha tracejada é 50%) e a diferença, em pontos
        percentuais, entre a segunda e a primeira metade do período.
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
  try {
    [meta, data] = await Promise.all([getMeta(), getMetaHeroes(filters)]);
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
      <Filters filters={filters} />
      <Summary meta={meta} data={data} />
      {data.heroes.length > 0 ? (
        <MetaTable heroes={data.heroes} />
      ) : (
        <p className="notice">
          {data.matches > 0
            ? "Nenhum herói atinge a amostra mínima neste filtro. Diminua a amostra mínima ou aumente o período."
            : "Ainda não há partidas para este filtro."}
        </p>
      )}
      <Legend />
    </>
  );
}
