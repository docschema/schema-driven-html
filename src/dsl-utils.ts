import type { DslNode, ElementNode } from "./types.js";

export interface GlobalConfig {
  timezone: string;
  examplesDelimiter: string;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseIterationExpression(expr: string): { path: string; alias: string } {
  const match = expr.trim().match(/^([A-Za-z_$][A-Za-z0-9_$.]*)\s+as\s+([A-Za-z_$][A-Za-z0-9_$]*)$/);
  if (!match) {
    throw new Error(`Invalid iteration expression: ${expr}`);
  }
  return { path: match[1], alias: match[2] };
}

export function getByPath(
  data: Record<string, unknown>,
  aliases: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return undefined;

  let cursor: unknown;
  let index = 0;

  if (Object.prototype.hasOwnProperty.call(aliases, parts[0])) {
    cursor = aliases[parts[0]];
    index = 1;
  } else {
    cursor = data;
  }

  for (; index < parts.length; index++) {
    const key = parts[index];
    if (!isPlainObject(cursor) && !Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }

  return cursor;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function collectGlobalConfig(root: ElementNode): GlobalConfig {
  const config: GlobalConfig = {
    timezone: "UTC",
    examplesDelimiter: ";",
  };

  walkElements(root, (el) => {
    if (el.tagName !== "meta") return;

    const name = el.attributes.name?.trim();
    const content = el.attributes.content?.trim() ?? "";

    if (name === "timezone" && content) {
      config.timezone = content;
    }

    if (name === "semantic:examples-delimiter" && content) {
      config.examplesDelimiter = content;
    }
  });

  return config;
}

export function walkElements(root: ElementNode, visitor: (node: ElementNode) => void): void {
  visitor(root);
  for (const child of root.children) {
    if (child.type === "element") {
      walkElements(child, visitor);
    }
  }
}

export function cloneAliasMap(map: Record<string, unknown>): Record<string, unknown> {
  return { ...map };
}

export function clonePathAliasMap(map: Record<string, string>): Record<string, string> {
  return { ...map };
}

export function resolvePathWithAliases(path: string, aliases: Record<string, string>): string {
  const parts = path.split(".").filter(Boolean);
  if (parts.length === 0) return path;

  const aliasPath = aliases[parts[0]];
  if (!aliasPath) return path;

  if (parts.length === 1) {
    return aliasPath;
  }
  return `${aliasPath}.${parts.slice(1).join(".")}`;
}

export function normalizePath(path: string): string[] {
  return path.split(".").filter(Boolean);
}

export function isVoidTag(tagName: string): boolean {
  return tagName === "br" || tagName === "hr" || tagName === "img" || tagName === "meta";
}

export function stableSortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableSortObject(item));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const entries = Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => {
      if (key === "required" && Array.isArray(nested)) {
        return [key, [...nested].sort()];
      }
      return [key, stableSortObject(nested)];
    });

  return Object.fromEntries(entries);
}

export function readTextContent(node: DslNode): string {
  if (node.type === "text") {
    return node.segments
      .map((segment) => (segment.kind === "literal" ? segment.value : ""))
      .join("");
  }

  return node.children.map((child) => readTextContent(child)).join("");
}
