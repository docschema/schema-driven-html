import { describe, it, expect } from "vitest";
import { parseTextSegments } from "../../src/expression-parser.js";
import type { InterpolationSegment, LiteralSegment } from "../../src/types.js";

// ── Helper ──

function firstInterpolation(text: string): InterpolationSegment {
  const segments = parseTextSegments(text);
  const interp = segments.find((s) => s.kind === "interpolation");
  if (!interp || interp.kind !== "interpolation") {
    throw new Error(`No interpolation found in: ${text}`);
  }
  return interp;
}

// ════════════════════════════════════════════════════════════════
// §Interpolation Syntax — path:type [?] [(constraints)] [| format]
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — basic path + type", () => {
  it("parses plain literal text with no interpolation", () => {
    const segments = parseTextSegments("Hello world");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toStrictEqual({ kind: "literal", value: "Hello world" });
  });

  it("returns empty array for empty string", () => {
    expect(parseTextSegments("")).toStrictEqual([]);
  });

  it("parses path with type — {{ name:string }}", () => {
    const seg = firstInterpolation("{{ name:string }}");
    expect(seg.path).toBe("name");
    expect(seg.dataType).toBe("string");
    expect(seg.nullable).toBe(false);
    expect(seg.constraints).toStrictEqual([]);
    expect(seg.filters).toStrictEqual([]);
  });

  it("parses dot-path — {{ contract.customer:string }}", () => {
    const seg = firstInterpolation("{{ contract.customer:string }}");
    expect(seg.path).toBe("contract.customer");
    expect(seg.dataType).toBe("string");
  });

  it("parses deep dot-path — {{ a.b.c.d:integer }}", () => {
    const seg = firstInterpolation("{{ a.b.c.d:integer }}");
    expect(seg.path).toBe("a.b.c.d");
    expect(seg.dataType).toBe("integer");
  });

  it("trims whitespace — {{  name:string  }}", () => {
    const seg = firstInterpolation("{{  name:string  }}");
    expect(seg.path).toBe("name");
    expect(seg.dataType).toBe("string");
  });

  it.each([
    ["string", "string"],
    ["integer", "integer"],
    ["number", "number"],
    ["boolean", "boolean"],
    ["date", "date"],
    ["time", "time"],
    ["datetime", "datetime"],
  ] as const)("parses type %s", (typeStr, expected) => {
    const seg = firstInterpolation(`{{ field:${typeStr} }}`);
    expect(seg.dataType).toBe(expected);
  });
});

describe("parseTextSegments — nullable", () => {
  it("parses nullable — {{ name:string? }}", () => {
    const seg = firstInterpolation("{{ name:string? }}");
    expect(seg.path).toBe("name");
    expect(seg.dataType).toBe("string");
    expect(seg.nullable).toBe(true);
  });

  it("non-nullable by default — {{ name:string }}", () => {
    const seg = firstInterpolation("{{ name:string }}");
    expect(seg.nullable).toBe(false);
  });

  it("nullable with constraints — {{ price:integer? (min:0) }}", () => {
    const seg = firstInterpolation("{{ price:integer? (min:0) }}");
    expect(seg.nullable).toBe(true);
    expect(seg.dataType).toBe("integer");
    expect(seg.constraints).toStrictEqual([{ kind: "min", value: 0 }]);
  });
});

// ════════════════════════════════════════════════════════════════
// §Data-constraints
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — constraints for string", () => {
  it("parses enum — (enum:A,B)", () => {
    const seg = firstInterpolation('{{ status:string (enum:A,B) }}');
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["A", "B"] },
    ]);
  });

  it("parses quoted enum — (enum:\"テスト\",\"サンプル\")", () => {
    const seg = firstInterpolation('{{ name:string (enum:"テスト","サンプル") }}');
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["テスト", "サンプル"] },
    ]);
  });

  it("parses min (minLength) — (min:1)", () => {
    const seg = firstInterpolation("{{ code:string (min:1) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "minLength", value: 1 }]);
  });

  it("parses max (maxLength) — (max:100)", () => {
    const seg = firstInterpolation("{{ name:string (max:100) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "maxLength", value: 100 }]);
  });

  it("parses pattern — (pattern:[A-Z]+)", () => {
    const seg = firstInterpolation("{{ code:string (pattern:[A-Z]+) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "pattern", value: "[A-Z]+" }]);
  });

  it("parses fixed — (fixed:CONSTANT)", () => {
    const seg = firstInterpolation("{{ label:string (fixed:CONSTANT) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "fixed", value: "CONSTANT" }]);
  });

  it("parses multiple constraints — (min:1, max:10)", () => {
    const seg = firstInterpolation("{{ code:string (min:1, max:10) }}");
    expect(seg.constraints).toHaveLength(2);
    expect(seg.constraints).toContainEqual({ kind: "minLength", value: 1 });
    expect(seg.constraints).toContainEqual({ kind: "maxLength", value: 10 });
  });
});

describe("parseTextSegments — constraints for integer/number", () => {
  it("parses enum for integer — (enum:1,2,3)", () => {
    const seg = firstInterpolation("{{ count:integer (enum:1,2,3) }}");
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: [1, 2, 3] },
    ]);
  });

  it("parses min (minimum) — (min:0)", () => {
    const seg = firstInterpolation("{{ price:integer (min:0) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "min", value: 0 }]);
  });

  it("parses max (maximum) — (max:99999)", () => {
    const seg = firstInterpolation("{{ price:integer (max:99999) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "max", value: 99999 }]);
  });

  it("parses exMin (exclusiveMinimum) — (exMin:0)", () => {
    const seg = firstInterpolation("{{ rate:number (exMin:0) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "exMin", value: 0 }]);
  });

  it("parses exMax (exclusiveMaximum) — (exMax:10000)", () => {
    const seg = firstInterpolation("{{ price:integer (exMax:10000) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "exMax", value: 10000 }]);
  });

  it("parses step (multipleOf) — (step:100)", () => {
    const seg = firstInterpolation("{{ amount:integer (step:100) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "step", value: 100 }]);
  });

  it("parses fixed for integer — (fixed:42)", () => {
    const seg = firstInterpolation("{{ answer:integer (fixed:42) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "fixed", value: 42 }]);
  });

  it("parses combined — (min:0, exMax:10000)", () => {
    const seg = firstInterpolation("{{ price:integer (min:0, exMax:10000) }}");
    expect(seg.constraints).toHaveLength(2);
    expect(seg.constraints).toContainEqual({ kind: "min", value: 0 });
    expect(seg.constraints).toContainEqual({ kind: "exMax", value: 10000 });
  });

  it("parses number with decimal — (min:0.5, max:99.9)", () => {
    const seg = firstInterpolation("{{ rate:number (min:0.5, max:99.9) }}");
    expect(seg.constraints).toContainEqual({ kind: "min", value: 0.5 });
    expect(seg.constraints).toContainEqual({ kind: "max", value: 99.9 });
  });
});

describe("parseTextSegments — constraints for boolean", () => {
  it("parses fixed for boolean — (fixed:true)", () => {
    const seg = firstInterpolation("{{ flag:boolean (fixed:true) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "fixed", value: true }]);
  });

  it("parses fixed false — (fixed:false)", () => {
    const seg = firstInterpolation("{{ flag:boolean (fixed:false) }}");
    expect(seg.constraints).toStrictEqual([{ kind: "fixed", value: false }]);
  });
});

// ════════════════════════════════════════════════════════════════
// §Format filter
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — filters", () => {
  it("parses single filter — | comma", () => {
    const seg = firstInterpolation("{{ price:integer | comma }}");
    expect(seg.filters).toStrictEqual([{ name: "comma", args: [] }]);
  });

  it("parses filter with arg — | fixed:2", () => {
    const seg = firstInterpolation("{{ price:number | fixed:2 }}");
    expect(seg.filters).toStrictEqual([{ name: "fixed", args: ["2"] }]);
  });

  it("parses filter chain — | comma | default:0", () => {
    const seg = firstInterpolation("{{ price:integer | comma | default:0 }}");
    expect(seg.filters).toHaveLength(2);
    expect(seg.filters[0]).toStrictEqual({ name: "comma", args: [] });
    expect(seg.filters[1]).toStrictEqual({ name: "default", args: ["0"] });
  });

  it("parses filter with multiple args — | replace:FROM,TO", () => {
    const seg = firstInterpolation("{{ text:string | replace:FROM,TO }}");
    expect(seg.filters).toStrictEqual([
      { name: "replace", args: ["FROM", "TO"] },
    ]);
  });

  it("parses pad-left filter — | pad-left:7,0", () => {
    const seg = firstInterpolation("{{ code:string | pad-left:7,0 }}");
    expect(seg.filters).toStrictEqual([
      { name: "pad-left", args: ["7", "0"] },
    ]);
  });

  it("parses either filter — | either:Yes,No", () => {
    const seg = firstInterpolation("{{ flag:boolean | either:Yes,No }}");
    expect(seg.filters).toStrictEqual([
      { name: "either", args: ["Yes", "No"] },
    ]);
  });

  it("parses date-format filter — | date-format:YYYY/MM/DD", () => {
    const seg = firstInterpolation("{{ d:date | date-format:YYYY/MM/DD }}");
    expect(seg.filters).toStrictEqual([
      { name: "date-format", args: ["YYYY/MM/DD"] },
    ]);
  });

  it("parses slice filter — | slice:0,4", () => {
    const seg = firstInterpolation("{{ text:string | slice:0,4 }}");
    expect(seg.filters).toStrictEqual([
      { name: "slice", args: ["0", "4"] },
    ]);
  });

  it("parses default filter — | default:N/A", () => {
    const seg = firstInterpolation("{{ name:string | default:N/A }}");
    expect(seg.filters).toStrictEqual([
      { name: "default", args: ["N/A"] },
    ]);
  });
});

// ════════════════════════════════════════════════════════════════
// Full combination: path:type? (constraints) | filters
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — full combination", () => {
  it("parses {{ price:integer? (min:0, exMax:10000) | comma | default:0 }}", () => {
    const seg = firstInterpolation(
      "{{ price:integer? (min:0, exMax:10000) | comma | default:0 }}"
    );
    expect(seg.path).toBe("price");
    expect(seg.dataType).toBe("integer");
    expect(seg.nullable).toBe(true);
    expect(seg.constraints).toHaveLength(2);
    expect(seg.constraints).toContainEqual({ kind: "min", value: 0 });
    expect(seg.constraints).toContainEqual({ kind: "exMax", value: 10000 });
    expect(seg.filters).toHaveLength(2);
    expect(seg.filters[0].name).toBe("comma");
    expect(seg.filters[1]).toStrictEqual({ name: "default", args: ["0"] });
  });

  it("parses spec example — {{ item.price:integer (min:0, exMax: 10000) | comma }}", () => {
    const seg = firstInterpolation(
      "{{ item.price:integer (min:0, exMax: 10000) | comma }}"
    );
    expect(seg.path).toBe("item.price");
    expect(seg.dataType).toBe("integer");
    expect(seg.nullable).toBe(false);
    expect(seg.constraints).toContainEqual({ kind: "min", value: 0 });
    expect(seg.constraints).toContainEqual({ kind: "exMax", value: 10000 });
    expect(seg.filters).toStrictEqual([{ name: "comma", args: [] }]);
  });
});

// ════════════════════════════════════════════════════════════════
// Literal + interpolation mixed segments
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — mixed segments", () => {
  it("parses literal before interpolation — 〒 {{ postal_code:string }}", () => {
    const segments = parseTextSegments("〒 {{ postal_code:string }}");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toStrictEqual({ kind: "literal", value: "〒 " });
    expect(segments[1]).toMatchObject({ kind: "interpolation", path: "postal_code" });
  });

  it("parses literal after interpolation", () => {
    const segments = parseTextSegments("{{ count:integer }} items");
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ kind: "interpolation", path: "count" });
    expect(segments[1]).toStrictEqual({ kind: "literal", value: " items" });
  });

  it("parses multiple interpolations — {{ a:string }}/{{ b:string }}", () => {
    const segments = parseTextSegments("{{ a:string }}/{{ b:string }}");
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ kind: "interpolation", path: "a" });
    expect(segments[1]).toStrictEqual({ kind: "literal", value: "/" });
    expect(segments[2]).toMatchObject({ kind: "interpolation", path: "b" });
  });
});

// ════════════════════════════════════════════════════════════════
// Quoted special characters in constraints and filters
// ════════════════════════════════════════════════════════════════

describe("parseTextSegments — quoted special characters", () => {
  it("enum values containing pipe — (enum:\"A|B\",\"C\")", () => {
    const seg = firstInterpolation('{{ status:string (enum:"A|B","C") }}');
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["A|B", "C"] },
    ]);
  });

  it("enum values containing parens — (enum:\"値(A)\",\"値(B)\")", () => {
    const seg = firstInterpolation('{{ label:string (enum:"値(A)","値(B)") }}');
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["値(A)", "値(B)"] },
    ]);
  });

  it("pattern containing parens and pipe", () => {
    const seg = firstInterpolation('{{ code:string (pattern:"[a-z]+(\\\\d|\\\\w)") }}');
    expect(seg.constraints[0].kind).toBe("pattern");
    if (seg.constraints[0].kind === "pattern") {
      expect(seg.constraints[0].value).toBe("[a-z]+(\\\\d|\\\\w)");
    }
  });

  it("filter arg containing pipe — | replace:\"A|B\",\"C\"", () => {
    const seg = firstInterpolation('{{ name:string | replace:"A|B","C" }}');
    expect(seg.filters).toStrictEqual([
      { name: "replace", args: ["A|B", "C"] },
    ]);
  });

  it("filter arg containing parens — | default:\"(未設定)\"", () => {
    const seg = firstInterpolation('{{ name:string | default:"(未設定)" }}');
    expect(seg.filters).toStrictEqual([
      { name: "default", args: ["(未設定)"] },
    ]);
  });

  it("single-quoted values — (enum:'A|B','C(D)')", () => {
    const seg = firstInterpolation("{{ tag:string (enum:'A|B','C(D)') }}");
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["A|B", "C(D)"] },
    ]);
  });

  it("mixed quote types — (enum:\"He said 'hello'\",\"She said 'bye'\")", () => {
    const seg = firstInterpolation(
      '{{ msg:string (enum:"He said \'hello\'","She said \'bye\'") }}'
    );
    expect(seg.constraints).toStrictEqual([
      { kind: "enum", values: ["He said 'hello'", "She said 'bye'"] },
    ]);
  });
});


describe("parseTextSegments — failure cases", () => {
  it("throws when type is missing", () => {
    expect(() => parseTextSegments("{{ name }}")).toThrowError(/Type is required/);
  });

  it("throws when constraint is invalid for the type", () => {
    expect(() => parseTextSegments("{{ flag:boolean (min:1) }}")).toThrowError(
      /Constraint "min" is not allowed for type "boolean"/
    );
  });

  it("throws when filter is invalid for the type", () => {
    expect(() => parseTextSegments("{{ amount:integer | upper }}")).toThrowError(
      /Filter "upper" is not allowed for type "integer"/
    );
  });

  it("throws on unclosed constraint parentheses", () => {
    expect(() => parseTextSegments("{{ amount:integer (min:0 }}")).toThrowError(
      /Unclosed constraint parentheses/
    );
  });

  it("throws when path format is invalid", () => {
    expect(() => parseTextSegments("{{ 1invalid:string }}")).toThrowError(
      /Invalid path/
    );
  });
});
