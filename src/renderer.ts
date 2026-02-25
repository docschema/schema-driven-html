import { applyFilters } from "./filters.js";
import {
  cloneAliasMap,
  collectGlobalConfig,
  escapeHtml,
  getByPath,
  isVoidTag,
  parseIterationExpression,
} from "./dsl-utils.js";
import type { DslNode, ElementNode } from "./types.js";

export interface RenderOptions {
  timezone?: string;
}

const CONTROL_ATTRIBUTES = new Set([
  "data-page",
  "data-repeat",
  "data-if",
  "data-break-before",
  "data-break-after",
  "data-fixed-rows",
  "data-max-rows",
  "data-format",
  "data-semantic-description",
  "data-semantic-instruction",
  "data-semantic-examples",
]);

interface RenderContext {
  data: Record<string, unknown>;
  aliases: Record<string, unknown>;
  timezone: string;
}

export function renderAst(
  root: ElementNode,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const globalConfig = collectGlobalConfig(root);

  const context: RenderContext = {
    data,
    aliases: {},
    timezone: options.timezone ?? globalConfig.timezone,
  };

  return renderElement(root, context);
}

function renderNode(node: DslNode, context: RenderContext): string {
  if (node.type === "text") {
    return node.segments
      .map((segment) => {
        if (segment.kind === "literal") {
          return escapeHtml(segment.value);
        }

        const resolved = getByPath(context.data, context.aliases, segment.path);
        const filtered = applyFilters(resolved, segment.filters, {
          dataType: segment.dataType,
          timezone: context.timezone,
        });

        return filtered == null ? "" : escapeHtml(String(filtered));
      })
      .join("");
  }

  return renderElement(node, context);
}

function renderElement(node: ElementNode, context: RenderContext): string {
  const pageExpr = node.attributes["data-page"];
  if (pageExpr) {
    return renderIteratedElement(node, pageExpr, context);
  }

  const repeatExpr = node.attributes["data-repeat"];
  if (repeatExpr) {
    return renderIteratedElement(node, repeatExpr, context);
  }

  return renderElementOnce(node, context);
}

function renderIteratedElement(node: ElementNode, expression: string, context: RenderContext): string {
  const { path, alias } = parseIterationExpression(expression);
  const list = getByPath(context.data, context.aliases, path);

  if (!Array.isArray(list)) {
    return "";
  }

  const maxRowsAttr = node.attributes["data-max-rows"];
  const fixedRowsAttr = node.attributes["data-fixed-rows"];
  const maxCount = maxRowsAttr ? parseInt(maxRowsAttr, 10) : Infinity;
  const fixedCount = fixedRowsAttr ? parseInt(fixedRowsAttr, 10) : 0;

  const effectiveLength = Math.min(list.length, maxCount);
  const totalRows = Math.max(effectiveLength, fixedCount);

  const rendered: string[] = [];
  for (let index = 0; index < totalRows; index++) {
    const aliases = cloneAliasMap(context.aliases);
    aliases[alias] = index < effectiveLength ? list[index] : {};
    aliases["$index"] = index;
    aliases["$page"] = {
      index,
      number: index + 1,
      count: totalRows,
    };

    rendered.push(renderElementOnce(node, { ...context, aliases }));
  }

  return rendered.join("");
}

function renderElementOnce(node: ElementNode, context: RenderContext): string {
  const conditionPath = node.attributes["data-if"];
  if (conditionPath) {
    const condition = getByPath(context.data, context.aliases, conditionPath);
    if (!condition) {
      return "";
    }
  }

  if (node.tagName === "meta") {
    return "";
  }

  const attrs = buildRenderedAttributes(node);
  const open = `<${node.tagName}${attrs}>`;

  if (isVoidTag(node.tagName)) {
    return open;
  }

  const body = node.children.map((child) => renderNode(child, context)).join("");
  return `${open}${body}</${node.tagName}>`;
}

function buildRenderedAttributes(node: ElementNode): string {
  const entries: string[] = [];
  const styleParts: string[] = [];

  const originalStyle = node.attributes.style;
  if (originalStyle) {
    styleParts.push(originalStyle);
  }

  const breakBefore = node.attributes["data-break-before"];
  if (breakBefore) {
    styleParts.push(`page-break-before:${breakBefore}`);
  }

  const breakAfter = node.attributes["data-break-after"];
  if (breakAfter) {
    styleParts.push(`page-break-after:${breakAfter}`);
  }

  for (const [key, value] of Object.entries(node.attributes)) {
    if (CONTROL_ATTRIBUTES.has(key) || key === "style") {
      continue;
    }
    entries.push(`${key}="${escapeHtml(value)}"`);
  }

  if (styleParts.length > 0) {
    entries.push(`style="${escapeHtml(styleParts.join("; "))}"`);
  }

  return entries.length > 0 ? ` ${entries.join(" ")}` : "";
}
