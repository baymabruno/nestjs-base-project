const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com";

/** URL path of a hero page, from the internal name: /heroes/antimage */
export const heroSlug = (name: string) => name.replace("npc_dota_hero_", "");

/** Hero portrait on the Steam CDN, from the internal name (npc_dota_hero_x) */
export const heroImage = (name: string) =>
  `${STEAM_CDN}/apps/dota2/images/dota_react/heroes/${heroSlug(name)}.png`;

/** Item icon on the Steam CDN; every recipe uses the same image */
export const itemImage = (name: string) =>
  `${STEAM_CDN}/apps/dota2/images/dota_react/items/${name.startsWith("recipe_") ? "recipe" : name}.png`;

/** Ability icon on the Steam CDN (talents have none) */
export const abilityImage = (name: string) =>
  `${STEAM_CDN}/apps/dota2/images/dota_react/abilities/${name}.png`;

const decimals = [0, 1].map(
  (digits) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }),
);

/** 0.564 -> "56,4%" (digits: 0 or 1) */
export const percent = (value: number | null, digits: 0 | 1 = 1) =>
  value === null ? "–" : `${decimals[digits].format(value * 100)}%`;

/** Difference in percentage points, with the sign: 0.012 -> "+1,2 p.p." */
export const points = (value: number) =>
  `${value > 0 ? "+" : ""}${decimals[1].format(value * 100)} p.p.`;

export const integer = (value: number) =>
  new Intl.NumberFormat("pt-BR").format(Math.round(value));

/** Seconds -> "12:30" (negative: before the horn, "-0:45") */
export const gameTime = (seconds: number) => {
  const sign = seconds < 0 ? "-" : "";
  const total = Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/**
 * Period of the statistics: public matches of the last hours, pro matches of
 * the whole patch
 */
export const periodLabel = (
  source: "pro" | "public" | undefined,
  publicHours: number,
  patch: string | undefined,
) => {
  const pro = patch ?? "atual";
  if (source === "pro") return `Patch ${pro}`;
  if (source === "public") return `Últimas ${publicHours} h`;
  return `${publicHours} h (públicas) · patch ${pro} (pro)`;
};

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
