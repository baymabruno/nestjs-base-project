// z for a 95% confidence interval
const Z = 1.96;

/**
 * Lower bound of the Wilson score interval (95%) of a win rate: the win rate
 * we can trust given the sample. With few matches it is far below the
 * observed rate (e.g. 10 wins in 12 matches: 0.55, not 0.83), so ranking by it
 * keeps small samples out of the top.
 */
export function wilsonLowerBound(wins: number, matches: number): number {
  if (matches === 0) return 0;
  const p = wins / matches;
  const z2 = Z * Z;
  const center = p + z2 / (2 * matches);
  const margin = Z * Math.sqrt((p * (1 - p) + z2 / (4 * matches)) / matches);
  return (center - margin) / (1 + z2 / matches);
}
