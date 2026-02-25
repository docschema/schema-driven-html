// ── DOM Node Types ──

export type DslNode = ElementNode | TextNode;

export interface ElementNode {
  type: "element";
  tagName: string;
  attributes: Record<string, string>;
  children: DslNode[];
}

export interface TextNode {
  type: "text";
  segments: TextSegment[];
}

// ── Text Segment Types ──

export type TextSegment = LiteralSegment | InterpolationSegment;

export interface LiteralSegment {
  kind: "literal";
  value: string;
}

export interface InterpolationSegment {
  kind: "interpolation";
  path: string;
  dataType: DataType;
  nullable: boolean;
  constraints: Constraint[];
  filters: Filter[];
}

// ── Data Types (DSL_SPECIFICATION.md §data-type) ──

export type DataType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "date"
  | "time"
  | "datetime";

// ── Constraints (DSL_SPECIFICATION.md §Data-constraints) ──

export type Constraint =
  | { kind: "enum"; values: (string | number | boolean)[] }
  | { kind: "min"; value: number }
  | { kind: "max"; value: number }
  | { kind: "exMin"; value: number }
  | { kind: "exMax"; value: number }
  | { kind: "step"; value: number }
  | { kind: "pattern"; value: string }
  | { kind: "fixed"; value: string | number | boolean }
  | { kind: "minLength"; value: number }
  | { kind: "maxLength"; value: number };

// ── Format Filters (DSL_SPECIFICATION.md §Format filter) ──

export interface Filter {
  name: string;
  args: string[];
}
