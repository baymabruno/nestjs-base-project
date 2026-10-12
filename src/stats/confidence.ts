// z for a 95% confidence interval
const Z = 1.96;

/**
 * Lower bound of the Wilson score interval (95%) of a win rate: the win rate
 * we can trust given the sample. With few matches it is far below the
 * observed rate (e.g. 10 wins in 12 matches: 0.55, not 0.83), so ranking by it
 * keeps small samples out of the top.
 */
export function wilsonLowerBound(wins: number, matches: number): number {
  return wilsonBounds(wins, matches)[0];
}

/**
 * Upper bound of the same interval: the highest win rate the sample allows.
 * Ranks the worst results: a low upper bound means the rate is low even in
 * the best case.
 */
export function wilsonUpperBound(wins: number, matches: number): number {
  return wilsonBounds(wins, matches)[1];
}

function wilsonBounds(wins: number, matches: number): [number, number] {
  if (matches === 0) return [0, 1];
  const p = wins / matches;
  const z2 = Z * Z;
  const center = p + z2 / (2 * matches);
  const margin = Z * Math.sqrt((p * (1 - p) + z2 / (4 * matches)) / matches);
  const scale = 1 + z2 / matches;
  return [(center - margin) / scale, (center + margin) / scale];
}
