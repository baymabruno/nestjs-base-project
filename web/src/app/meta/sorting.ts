// Multi-column sorting of the heroes table: the columns sort in the order
// they were clicked (the first one decides, the next ones break the ties).

export interface SortRule<K extends string> {
  key: K;
  desc: boolean;
}

/**
 * Next rules after a click on a column: a new column joins the end, from the
 * highest to the lowest; a second click turns it to the lowest first; a third
 * removes it. Without rules, the default order applies.
 */
export function toggleSort<K extends string>(
  rules: SortRule<K>[],
  key: K,
): SortRule<K>[] {
  const current = rules.find((rule) => rule.key === key);
  if (!current) return [...rules, { key, desc: true }];
  if (current.desc) {
    return rules.map((rule) => (rule.key === key ? { key, desc: false } : rule));
  }
  return rules.filter((rule) => rule.key !== key);
}

type Value = number | string | null;

/**
 * Sorts by the rules; rows without data go last in any direction. Ties after
 * every rule (or no rules at all) keep the original order.
 */
export function sortRows<T, K extends string>(
  rows: T[],
  rules: SortRule<K>[],
  valueOf: (row: T, key: K) => Value,
): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const { key, desc } of rules) {
        const left = valueOf(a.row, key);
        const right = valueOf(b.row, key);
        if (left === right) continue;
        if (left === null) return 1;
        if (right === null) return -1;
        const order =
          typeof left === "string"
            ? left.localeCompare(right as string, "pt-BR")
            : left - (right as number);
        if (order !== 0) return desc ? -order : order;
      }
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
