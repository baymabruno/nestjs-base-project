import type { MetaHero } from "@/lib/api";
import { percent, shortDay } from "@/lib/format";

const WIDTH = 72;
const HEIGHT = 22;

/** Daily win rate of the period; days without matches are left out */
export function Sparkline({ daily }: { daily: MetaHero["daily"] }) {
  const points = daily
    .map((day, index) => ({ ...day, index }))
    .filter((day) => day.winRate !== null);
  if (points.length < 2) return <span className="muted">–</span>;

  const rates = points.map((point) => point.winRate as number);
  const min = Math.min(...rates, 0.45);
  const max = Math.max(...rates, 0.55);
  const x = (index: number) => (index / (daily.length - 1)) * (WIDTH - 4) + 2;
  const y = (rate: number) =>
    HEIGHT - 2 - ((rate - min) / (max - min)) * (HEIGHT - 4);
  const path = points
    .map((point, i) => `${i ? "L" : "M"}${x(point.index)},${y(point.winRate as number)}`)
    .join(" ");
  const last = rates[rates.length - 1];
  const description = points
    .map((point) => `${shortDay(point.day)}: ${percent(point.winRate)}`)
    .join(", ");

  return (
    <svg
      className="sparkline"
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`Win rate por dia: ${description}`}
    >
      <title>{description}</title>
      <line
        x1="0"
        x2={WIDTH}
        y1={y(0.5)}
        y2={y(0.5)}
        stroke="var(--border)"
        strokeDasharray="2 2"
      />
      <path
        d={path}
        fill="none"
        stroke={last >= 0.5 ? "var(--good)" : "var(--bad)"}
        strokeWidth="1.5"
      />
    </svg>
  );
}
