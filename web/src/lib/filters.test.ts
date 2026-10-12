import { describe, expect, it } from "vitest";
import { filterHref, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("uses the defaults without parameters", () => {
    expect(parseFilters({})).toEqual({
      source: undefined,
      bracket: undefined,
      minMatches: 1,
      role: undefined,
      allRoles: undefined,
    });
  });

  it("reads all roles chosen explicitly", () => {
    expect(parseFilters({ role: "all" })).toMatchObject({
      role: undefined,
      allRoles: true,
    });
  });

  it("reads the valid values", () => {
    expect(
      parseFilters({ source: "public", bracket: "immortal", min: "100", role: "3" }),
    ).toMatchObject({ source: "public", bracket: "immortal", minMatches: 100, role: 3 });
  });

  it("ignores invalid values", () => {
    expect(
      parseFilters({ source: "x", bracket: "ancient", min: "7", role: "6" }),
    ).toEqual(parseFilters({}));
  });

  it("uses the first value of a repeated parameter", () => {
    expect(parseFilters({ role: ["2", "4"] }).role).toBe(2);
  });
});

describe("filterHref", () => {
  const defaults = parseFilters({});

  it("leaves the defaults out of the URL", () => {
    expect(filterHref("/meta", defaults, {})).toBe("/meta");
  });

  it("keeps the other filters when one changes", () => {
    const filters = parseFilters({ source: "public", min: "500" });
    expect(filterHref("/heroes/axe", filters, { role: 1 })).toBe(
      "/heroes/axe?source=public&min=500&role=1",
    );
  });

  it("keeps all roles chosen explicitly in the URL", () => {
    expect(filterHref("/heroes/axe", defaults, { allRoles: true })).toBe(
      "/heroes/axe?role=all",
    );
  });

  it("removes a filter set to empty", () => {
    const filters = parseFilters({ role: "2" });
    expect(filterHref("/meta", filters, { role: undefined })).toBe("/meta");
  });
});
