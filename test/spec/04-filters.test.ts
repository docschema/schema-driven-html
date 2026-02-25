import { describe, it, expect } from "vitest";
import { applyFilters } from "../../src/filters.js";
import type { Filter } from "../../src/types.js";

function run(value: unknown, filters: Filter[], dataType?: any, timezone?: string): unknown {
  return applyFilters(value, filters, { dataType, timezone });
}

describe("applyFilters", () => {
  it("applies string filters", () => {
    const value = run("abc-123", [
      { name: "upper", args: [] },
      { name: "replace", args: ["-", "_"] },
    ], "string");
    expect(value).toBe("ABC_123");
  });

  it("applies numeric filters", () => {
    const value = run(1234, [{ name: "comma", args: [] }], "integer");
    expect(value).toBe("1,234");
  });

  it("applies boolean either", () => {
    const value = run(false, [{ name: "either", args: ["YES", "NO"] }], "boolean");
    expect(value).toBe("NO");
  });

  it("applies date-format", () => {
    const value = run("2026-02-23", [{ name: "date-format", args: ["YYYY/MM/DD"] }], "date");
    expect(value).toBe("2026/02/23");
  });

  it("applies datetime format with timezone", () => {
    const value = run(
      "2026-02-23T00:00:00Z",
      [{ name: "date-format", args: ["YYYY-MM-DD HH:mm"] }],
      "datetime",
      "Asia/Tokyo"
    );
    expect(value).toBe("2026-02-23 09:00");
  });

  it("supports default filter", () => {
    const value = run(null, [{ name: "default", args: ["N/A"] }], "string");
    expect(value).toBe("N/A");
  });

  it("supports zenkaku and hankaku", () => {
    const z = run("abc123", [{ name: "zenkaku", args: [] }], "string");
    const h = run(z, [{ name: "hankaku", args: [] }], "string");
    expect(z).toBe("ａｂｃ１２３");
    expect(h).toBe("abc123");
  });
});
