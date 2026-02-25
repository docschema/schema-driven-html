import type { DataType, Filter } from "./types.js";

export interface FilterContext {
  dataType?: DataType;
  timezone?: string;
}

const TOKEN_RE = /YYYY|MM|DD|HH|mm|ss/g;

export function applyFilters(
  value: unknown,
  filters: Filter[],
  context: FilterContext = {}
): unknown {
  return filters.reduce((current, filter) => applySingleFilter(current, filter, context), value);
}

function applySingleFilter(value: unknown, filter: Filter, context: FilterContext): unknown {
  switch (filter.name) {
    case "default":
      return value == null ? (filter.args[0] ?? "") : value;

    case "upper":
      return String(value ?? "").toUpperCase();

    case "lower":
      return String(value ?? "").toLowerCase();

    case "replace": {
      const [from = "", to = ""] = filter.args;
      return String(value ?? "").replaceAll(from, to);
    }

    case "pad-left": {
      const width = Number(filter.args[0] ?? "0");
      const fill = filter.args[1] ?? "0";
      return String(value ?? "").padStart(width, fill);
    }

    case "slice": {
      const start = Number(filter.args[0] ?? "0");
      const end = Number(filter.args[1] ?? "0");
      return String(value ?? "").slice(start, end);
    }

    case "zenkaku":
      return toZenkaku(String(value ?? ""));

    case "hankaku":
      return toHankaku(String(value ?? ""));

    case "comma": {
      const numeric = Number(value ?? 0);
      return Number.isFinite(numeric)
        ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 20 }).format(numeric)
        : String(value ?? "");
    }

    case "fixed": {
      const digits = Number(filter.args[0] ?? "0");
      const numeric = Number(value ?? 0);
      return Number.isFinite(numeric) ? numeric.toFixed(digits) : String(value ?? "");
    }

    case "either":
      return value ? (filter.args[0] ?? "") : (filter.args[1] ?? "");

    case "date-format": {
      const format = filter.args[0] ?? "YYYY-MM-DD";
      return formatDateValue(value, context.dataType, format, context.timezone ?? "UTC");
    }

    default:
      throw new Error(`Unknown filter: ${filter.name}`);
  }
}

function formatDateValue(
  value: unknown,
  dataType: DataType | undefined,
  format: string,
  timezone: string
): string {
  if (value == null) return "";

  const source = String(value);

  if (dataType === "date") {
    const match = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return source;
    return applyDateTokens(format, {
      YYYY: match[1],
      MM: match[2],
      DD: match[3],
      HH: "00",
      mm: "00",
      ss: "00",
    });
  }

  if (dataType === "time") {
    const match = source.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return source;
    return applyDateTokens(format, {
      YYYY: "0000",
      MM: "00",
      DD: "00",
      HH: match[1],
      mm: match[2],
      ss: match[3] ?? "00",
    });
  }

  const normalized = hasOffset(source) ? source : `${source}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return source;

  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {
    YYYY: getPart(parts, "year"),
    MM: getPart(parts, "month"),
    DD: getPart(parts, "day"),
    HH: getPart(parts, "hour"),
    mm: getPart(parts, "minute"),
    ss: getPart(parts, "second"),
  };

  return applyDateTokens(format, map);
}

function hasOffset(value: string): boolean {
  return /([+-]\d{2}:?\d{2}|Z)$/i.test(value);
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

function applyDateTokens(format: string, tokens: Record<string, string>): string {
  return format.replace(TOKEN_RE, (token) => tokens[token] ?? token);
}

function toZenkaku(value: string): string {
  return value.replace(/[!-~]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0));
}

function toHankaku(value: string): string {
  return value.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0));
}
