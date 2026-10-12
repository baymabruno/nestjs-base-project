import { describe, expect, it } from "vitest";
import { periodLabel } from "./format";

describe("periodLabel", () => {
  it("shows the window of each source", () => {
    expect(periodLabel("public", 24, "7.41")).toBe("Últimas 24 h");
    expect(periodLabel("pro", 24, "7.41")).toBe("Patch 7.41");
    expect(periodLabel(undefined, 24, "7.41")).toBe(
      "24 h (públicas) · patch 7.41 (pro)",
    );
  });

  it("works before the first calculation, without a patch", () => {
    expect(periodLabel("pro", 24, undefined)).toBe("Patch atual");
  });
});
