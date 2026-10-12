const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";

/** Hero portrait on the Steam CDN, from the internal name (npc_dota_hero_x) */
export const heroImage = (name: string) =>
  `${STEAM_CDN}/apps/dota2/images/dota_react/heroes/${name.replace("npc_dota_hero_", "")}.png`;

const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** 0.564 -> "56,4%" */
export const percent = (value: number | null) =>
  value === null ? "–" : `${decimal.format(value * 100)}%`;

/** Difference in percentage points, with the sign: 0.012 -> "+1,2 p.p." */
export const points = (value: number) =>
  `${value > 0 ? "+" : ""}${decimal.format(value * 100)} p.p.`;

export const integer = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(value));

/** "2026-10-05" -> "05/10" */
export const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

/** "11/10 23:11", in Brasília time */
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })
    .format(new Date(iso))
    .replace(",", "");
