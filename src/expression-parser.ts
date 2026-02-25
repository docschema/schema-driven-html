import type {
  TextSegment,
  LiteralSegment,
  InterpolationSegment,
  DataType,
  Constraint,
  Filter,
} from "./types.js";

const INTERPOLATION_RE = /\{\{(.*?)\}\}/g;

const VALID_TYPES = new Set<string>([
  "string", "integer", "number", "boolean", "date", "time", "datetime",
]);

const PATH_RE = /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)*$/;

const FILTER_SPECS = {
  string: new Map<string, { min: number; max: number }>([
    ["upper", { min: 0, max: 0 }],
    ["lower", { min: 0, max: 0 }],
    ["replace", { min: 2, max: 2 }],
    ["pad-left", { min: 1, max: 2 }],
    ["slice", { min: 2, max: 2 }],
    ["default", { min: 1, max: 1 }],
    ["zenkaku", { min: 0, max: 0 }],
    ["hankaku", { min: 0, max: 0 }],
  ]),
  integer: new Map<string, { min: number; max: number }>([
    ["comma", { min: 0, max: 0 }],
    ["fixed", { min: 1, max: 1 }],
    ["pad-left", { min: 1, max: 2 }],
    ["either", { min: 2, max: 2 }],
    ["default", { min: 1, max: 1 }],
  ]),
  number: new Map<string, { min: number; max: number }>([
    ["comma", { min: 0, max: 0 }],
    ["fixed", { min: 1, max: 1 }],
    ["pad-left", { min: 1, max: 2 }],
    ["either", { min: 2, max: 2 }],
    ["default", { min: 1, max: 1 }],
  ]),
  boolean: new Map<string, { min: number; max: number }>([
    ["either", { min: 2, max: 2 }],
    ["default", { min: 1, max: 1 }],
  ]),
  date: new Map<string, { min: number; max: number }>([
    ["date-format", { min: 1, max: 1 }],
    ["default", { min: 1, max: 1 }],
  ]),
  time: new Map<string, { min: number; max: number }>([
    ["date-format", { min: 1, max: 1 }],
    ["default", { min: 1, max: 1 }],
  ]),
  datetime: new Map<string, { min: number; max: number }>([
    ["date-format", { min: 1, max: 1 }],
    ["default", { min: 1, max: 1 }],
  ]),
} as const;

/**
 * Parse a raw text string containing {{ ... }} interpolations into segments.
 */
export function parseTextSegments(text: string): TextSegment[] {
  if (text === "") return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  INTERPOLATION_RE.lastIndex = 0;

  for (
    let match = INTERPOLATION_RE.exec(text);
    match !== null;
    match = INTERPOLATION_RE.exec(text)
  ) {
    // Add literal segment before this interpolation
    if (match.index > lastIndex) {
      segments.push(literal(text.slice(lastIndex, match.index)));
    }

    const inner = match[1].trim();
    segments.push(parseInterpolation(inner));

    lastIndex = match.index + match[0].length;
  }

  // Trailing literal
  if (lastIndex < text.length) {
    segments.push(literal(text.slice(lastIndex)));
  }

  return segments;
}

function literal(value: string): LiteralSegment {
  return { kind: "literal", value };
}

/**
 * Parse the inner content of {{ ... }} into an InterpolationSegment.
 *
 * Format: path:type [?] [(constraints)] [| filter1 | filter2 ...]
 */
function parseInterpolation(inner: string): InterpolationSegment {
  // Step 1: Split off filters (quote-aware split on |)
  const parts = quoteAwareSplit(inner, "|");
  const mainPart = parts[0].trim();
  const filterParts = parts.slice(1);

  // Step 2: Extract constraints from main part — find (...)
  let pathTypePart: string;
  let constraintsStr: string | null = null;

  const parenOpen = findUnquotedChar(mainPart, "(");
  const parenClose = findUnquotedChar(mainPart, ")");

  if (parenOpen >= 0) {
    const matchedParenClose = findMatchingParen(mainPart, parenOpen);
    if (matchedParenClose < 0) {
      throw new Error("Unclosed constraint parentheses");
    }

    const trailing = mainPart.slice(matchedParenClose + 1).trim();
    if (trailing.length > 0) {
      throw new Error("Unmatched constraint parentheses");
    }

    pathTypePart = mainPart.slice(0, parenOpen).trim();
    constraintsStr = mainPart.slice(parenOpen + 1, matchedParenClose).trim();
  } else {
    if (parenClose >= 0) {
      throw new Error("Unmatched constraint parentheses");
    }
    pathTypePart = mainPart;
  }

  // Step 3: Parse path:type[?]
  const { path, dataType, nullable } = parsePathType(pathTypePart);

  // Step 4: Parse constraints
  const constraints = constraintsStr
    ? parseConstraints(constraintsStr, dataType)
    : [];

  // Step 5: Parse filters
  const filters = filterParts.map((f) => parseFilter(f.trim(), dataType));

  return {
    kind: "interpolation",
    path,
    dataType,
    nullable,
    constraints,
    filters,
  };
}

/**
 * Parse "path:type[?]" into components.
 */
function parsePathType(s: string): {
  path: string;
  dataType: DataType;
  nullable: boolean;
} {
  const colonIdx = s.indexOf(":");
  if (colonIdx < 0) {
    throw new Error("Type is required. Use {{ path:type ... }}");
  }

  const path = s.slice(0, colonIdx).trim();
  if (!PATH_RE.test(path)) {
    throw new Error(`Invalid path: ${path}`);
  }
  let typeStr = s.slice(colonIdx + 1).trim();

  let nullable = false;
  if (typeStr.endsWith("?")) {
    nullable = true;
    typeStr = typeStr.slice(0, -1).trim();
  }

  if (!VALID_TYPES.has(typeStr)) {
    throw new Error(`Invalid data type: ${typeStr}`);
  }

  return { path, dataType: typeStr as DataType, nullable };
}

/**
 * Parse constraint string like "min:0, exMax:10000" or "enum:A,B".
 */
function parseConstraints(str: string, dataType: DataType): Constraint[] {
  const constraints: Constraint[] = [];

  // Split by comma at the top level, but respect quotes and nested parens
  const entries = quoteAwareSplitConstraints(str);

  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx < 0) continue;

    const name = trimmed.slice(0, colonIdx).trim();
    const rawValue = trimmed.slice(colonIdx + 1).trim();

    constraints.push(buildConstraint(name, rawValue, dataType));
  }

  return constraints;
}

/**
 * Build a typed constraint from name and raw value.
 */
function buildConstraint(
  name: string,
  rawValue: string,
  dataType: DataType
): Constraint {
  switch (name) {
    case "enum":
      if (dataType === "boolean" || dataType === "date" || dataType === "time" || dataType === "datetime") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return {
        kind: "enum",
        values: parseEnumValues(rawValue, dataType),
      };

    case "min":
      if (dataType === "string") return { kind: "minLength", value: Number(rawValue) };
      if (dataType === "integer" || dataType === "number") return { kind: "min", value: Number(rawValue) };
      throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);

    case "max":
      if (dataType === "string") return { kind: "maxLength", value: Number(rawValue) };
      if (dataType === "integer" || dataType === "number") return { kind: "max", value: Number(rawValue) };
      throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);

    case "exMin":
      if (dataType !== "integer" && dataType !== "number") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return { kind: "exMin", value: Number(rawValue) };

    case "exMax":
      if (dataType !== "integer" && dataType !== "number") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return { kind: "exMax", value: Number(rawValue) };

    case "step":
      if (dataType !== "integer" && dataType !== "number") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return { kind: "step", value: Number(rawValue) };

    case "pattern":
      if (dataType !== "string") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return { kind: "pattern", value: unquote(rawValue) };

    case "fixed":
      if (dataType === "date" || dataType === "time" || dataType === "datetime") {
        throw new Error(`Constraint "${name}" is not allowed for type "${dataType}"`);
      }
      return { kind: "fixed", value: parseFixedValue(rawValue, dataType) };

    default:
      throw new Error(`Unknown constraint: ${name}`);
  }
}

/**
 * Parse enum values, handling quoted strings and numeric types.
 */
function parseEnumValues(
  rawValue: string,
  dataType: DataType
): (string | number | boolean)[] {
  const parts = quoteAwareSplit(rawValue, ",");

  return parts.map((part) => {
    const trimmed = part.trim();
    const unquoted = unquote(trimmed);

    if (dataType === "integer") return parseInt(unquoted, 10);
    if (dataType === "number") return parseFloat(unquoted);
    if (dataType === "boolean") return unquoted === "true";
    return unquoted;
  });
}

/**
 * Parse fixed value based on data type.
 */
function parseFixedValue(
  rawValue: string,
  dataType: DataType
): string | number | boolean {
  const unquoted = unquote(rawValue);

  if (dataType === "integer") return parseInt(unquoted, 10);
  if (dataType === "number") return parseFloat(unquoted);
  if (dataType === "boolean") {
    if (unquoted !== "true" && unquoted !== "false") {
      throw new Error(`Invalid boolean literal: ${unquoted}`);
    }
    return unquoted === "true";
  }
  return unquoted;
}

/**
 * Parse a filter string like "comma" or "fixed:2" or "replace:FROM,TO".
 */
function parseFilter(s: string, dataType: DataType): Filter {
  const colonIdx = s.indexOf(":");
  const name = colonIdx < 0 ? s.trim() : s.slice(0, colonIdx).trim();
  const argsStr = colonIdx < 0 ? "" : s.slice(colonIdx + 1).trim();
  const args = argsStr === "" ? [] : quoteAwareSplit(argsStr, ",").map((a) => unquote(a.trim()));

  const spec = FILTER_SPECS[dataType].get(name);
  if (!spec) {
    throw new Error(`Filter "${name}" is not allowed for type "${dataType}"`);
  }
  if (args.length < spec.min || args.length > spec.max) {
    throw new Error(
      `Filter "${name}" for type "${dataType}" expects ${spec.min === spec.max ? spec.min : `${spec.min}-${spec.max}`} args, got ${args.length}`
    );
  }

  if (colonIdx < 0) {
    return { name, args: [] };
  }

  return { name, args };
}

// ── Quote-Aware Utilities ──

/**
 * Split a string by a delimiter, respecting quoted strings.
 * Quotes are " or '.
 */
function quoteAwareSplit(s: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
      current += ch;
      i++;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      i++;
    } else if (s.startsWith(delimiter, i)) {
      parts.push(current);
      current = "";
      i += delimiter.length;
    } else {
      current += ch;
      i++;
    }
  }

  if (current !== "" || parts.length > 0) {
    parts.push(current);
  }

  return parts;
}

/**
 * Split constraint entries. Constraints are separated by commas,
 * but "enum:A,B" keeps A,B together because the first part after ":"
 * continues until the next constraint name.
 *
 * Strategy: split on ", " followed by a known constraint name.
 */
function quoteAwareSplitConstraints(s: string): string[] {
  const constraintNames = [
    "enum", "min", "max", "exMin", "exMax", "step", "pattern", "fixed",
    "minLength", "maxLength",
  ];

  const entries: string[] = [];
  let current = "";
  let inQuote: string | null = null;
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    if (inQuote) {
      if (ch === inQuote) {
        inQuote = null;
      }
      current += ch;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      i++;
      continue;
    }

    // Check if we hit "," followed by a constraint name
    if (ch === ",") {
      const afterComma = s.slice(i + 1).trimStart();
      const matchesConstraint = constraintNames.some((name) =>
        afterComma.startsWith(name + ":")
      );

      if (matchesConstraint) {
        entries.push(current);
        current = "";
        i++;
        // Skip whitespace after comma
        while (i < s.length && s[i] === " ") i++;
        continue;
      }
    }

    current += ch;
    i++;
  }

  if (current.trim()) {
    entries.push(current);
  }

  return entries;
}

/**
 * Find the index of a character outside of quotes.
 */
function findUnquotedChar(s: string, ch: string): number {
  let inQuote: string | null = null;

  for (let i = 0; i < s.length; i++) {
    if (inQuote) {
      if (s[i] === inQuote) inQuote = null;
    } else if (s[i] === '"' || s[i] === "'") {
      inQuote = s[i];
    } else if (s[i] === ch) {
      return i;
    }
  }

  return -1;
}

/**
 * Find the matching closing paren for an opening paren, respecting quotes.
 */
function findMatchingParen(s: string, openIdx: number): number {
  let depth = 0;
  let inQuote: string | null = null;

  for (let i = openIdx; i < s.length; i++) {
    const ch = s[i];

    if (inQuote) {
      if (ch === inQuote) inQuote = null;
    } else if (ch === '"' || ch === "'") {
      inQuote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

/**
 * Remove surrounding quotes from a string.
 */
function unquote(s: string): string {
  if (s.length >= 2) {
    if (
      (s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'")
    ) {
      return s.slice(1, -1);
    }
  }
  return s;
}
