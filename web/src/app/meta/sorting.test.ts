import { describe, expect, it } from "vitest";
import { sortRows, toggleSort, type SortRule } from "./sorting";

type Key = "matches" | "winRate" | "name";
interface Row {
  name: string;
  matches: number;
  winRate: number | null;
}

const rows: Row[] = [
  { name: "Axe", matches: 100, winRate: 0.5 },
  { name: "Lion", matches: 300, winRate: 0.48 },
  { name: "Pudge", matches: 300, winRate: 0.52 },
  { name: "Io", matches: 100, winRate: null },
];
const valueOf = (row: Row, key: Key) => row[key];
const names = (rules: SortRule<Key>[]) =>
  sortRows(rows, rules, valueOf).map((row) => row.name);

describe("toggleSort", () => {
  it("adds a column from the highest to the lowest", () => {
    expect(toggleSort<Key>([], "matches")).toEqual([
      { key: "matches", desc: true },
    ]);
  });

  it("keeps the click order of the columns", () => {
    const rules = toggleSort(toggleSort<Key>([], "matches"), "winRate");

    expect(rules.map((rule) => rule.key)).toEqual(["matches", "winRate"]);
  });

  it("turns a column to the lowest first on the second click, in place", () => {
    const rules = toggleSort<Key>(
      [
        { key: "matches", desc: true },
        { key: "winRate", desc: true },
      ],
      "matches",
    );

    expect(rules).toEqual([
      { key: "matches", desc: false },
      { key: "winRate", desc: true },
    ]);
  });

  it("removes the column on the third click", () => {
    const rules = toggleSort<Key>(
      [
        { key: "matches", desc: false },
        { key: "winRate", desc: true },
      ],
      "matches",
    );

    expect(rules).toEqual([{ key: "winRate", desc: true }]);
  });
});

describe("sortRows", () => {
  it("keeps the original order without rules", () => {
    expect(names([])).toEqual(["Axe", "Lion", "Pudge", "Io"]);
  });

  it("breaks the ties of the first column with the second", () => {
    expect(
      names([
        { key: "matches", desc: true },
        { key: "winRate", desc: true },
      ]),
    ).toEqual(["Pudge", "Lion", "Axe", "Io"]);
  });

  it("sorts from the lowest when ascending", () => {
    expect(
      names([
        { key: "matches", desc: false },
        { key: "winRate", desc: false },
      ]),
    ).toEqual(["Axe", "Io", "Lion", "Pudge"]);
  });

  it("puts the rows without data last in both directions", () => {
    expect(names([{ key: "winRate", desc: true }]).at(-1)).toBe("Io");
    expect(names([{ key: "winRate", desc: false }]).at(-1)).toBe("Io");
  });

  it("sorts text by the Portuguese order", () => {
    expect(names([{ key: "name", desc: false }])).toEqual([
      "Axe",
      "Io",
      "Lion",
      "Pudge",
    ]);
  });
});
