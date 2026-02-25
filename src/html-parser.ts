import { parseTextSegments } from "./expression-parser.js";
import type { DslNode, ElementNode, TextNode } from "./types.js";

const ALLOWED_TAGS = new Set([
  "html",
  "head",
  "body",
  "meta",
  "div",
  "section",
  "header",
  "footer",
  "main",
  "p",
  "span",
  "strong",
  "em",
  "small",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "colgroup",
  "ul",
  "ol",
  "li",
  "img",
]);

const VOID_TAGS = new Set(["br", "hr", "img", "meta"]);

const ALLOWED_ATTRIBUTES = new Set([
  "style",
  "class",
  "id",
  "lang",
  "dir",
  "src",
  "alt",
  "colspan",
  "rowspan",
  "name",
  "content",
]);

const ALLOWED_DATA_ATTRIBUTES = new Set([
  "data-page",
  "data-repeat",
  "data-if",
  "data-format",
  "data-break-before",
  "data-break-after",
  "data-fixed-rows",
  "data-max-rows",
  "data-semantic-description",
  "data-semantic-instruction",
  "data-semantic-examples",
]);

const ALLOWED_CSS_PROPERTIES = new Set([
  "display",
  "width",
  "height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "box-sizing",
  "border",
  "border-collapse",
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "text-align",
  "white-space",
  "letter-spacing",
  "color",
  "background-color",
  "page-break-before",
  "page-break-after",
  "page-break-inside",
]);

const BANNED_CSS_PATTERNS = [
  /\babsolute\b/i,
  /\bfixed\b/i,
  /\bfloat\b/i,
  /\bflex\b/i,
  /\bgrid\b/i,
  /\banimation\b/i,
  /\btransition\b/i,
  /\btransform\b/i,
  /\bfilter\b/i,
  /calc\s*\(/i,
  /var\s*\(/i,
  /\d(?:\.\d+)?\s*(em|rem|vh|vw|%|ch)(?![A-Za-z])/i,
];

const TOKEN_RE = /<!--[\s\S]*?-->|<[^>]+>|[^<]+/g;

interface OpenTagToken {
  tagName: string;
  attrs: Record<string, string>;
  selfClosing: boolean;
}

/**
 * Parse an HTML DSL string into a sanitized AST tree.
 */
export function parseHtml(html: string): ElementNode {
  const syntheticRoot: ElementNode = {
    type: "element",
    tagName: "__root__",
    attributes: {},
    children: [],
  };

  const stack: ElementNode[] = [syntheticRoot];
  let ignoredDepth = 0;

  TOKEN_RE.lastIndex = 0;

  for (let tokenMatch = TOKEN_RE.exec(html); tokenMatch; tokenMatch = TOKEN_RE.exec(html)) {
    const token = tokenMatch[0];

    if (token.startsWith("<!--")) {
      continue;
    }

    if (token.startsWith("</")) {
      const closeTag = parseClosingTag(token);
      if (!closeTag) continue;

      if (ignoredDepth > 0) {
        ignoredDepth--;
        continue;
      }

      closeStackUntil(stack, closeTag);
      continue;
    }

    if (token.startsWith("<")) {
      const openTag = parseOpenTag(token);
      if (!openTag) continue;

      const { tagName, attrs, selfClosing } = openTag;
      const isVoid = VOID_TAGS.has(tagName) || selfClosing;

      if (ignoredDepth > 0) {
        if (!isVoid) ignoredDepth++;
        continue;
      }

      if (!ALLOWED_TAGS.has(tagName)) {
        if (!isVoid) {
          ignoredDepth = 1;
        }
        continue;
      }

      const filteredAttrs = filterAttributes(attrs);
      if (tagName === "img" && !filteredAttrs.src?.startsWith("data:")) {
        continue;
      }

      const node: ElementNode = {
        type: "element",
        tagName,
        attributes: filteredAttrs,
        children: [],
      };

      stack[stack.length - 1].children.push(node);
      if (!isVoid) {
        stack.push(node);
      }

      continue;
    }

    if (ignoredDepth > 0) {
      continue;
    }

    if (token.trim().length === 0) {
      continue;
    }

    const textNode = buildTextNode(token);
    if (textNode) {
      stack[stack.length - 1].children.push(textNode);
    }
  }

  const rootHtml = syntheticRoot.children.find(
    (node): node is ElementNode => node.type === "element" && node.tagName === "html"
  );

  if (rootHtml) {
    return rootHtml;
  }

  return {
    type: "element",
    tagName: "html",
    attributes: {},
    children: syntheticRoot.children,
  };
}

function buildTextNode(raw: string): TextNode | null {
  const segments = parseTextSegments(raw);
  if (segments.length === 0) {
    return null;
  }
  return {
    type: "text",
    segments,
  };
}

function parseClosingTag(token: string): string | null {
  const match = token.match(/^<\s*\/\s*([A-Za-z0-9-]+)\s*>$/);
  return match ? match[1].toLowerCase() : null;
}

function parseOpenTag(token: string): OpenTagToken | null {
  const openTagMatch = token.match(/^<\s*([A-Za-z0-9-]+)([\s\S]*?)>$/);
  if (!openTagMatch) return null;

  const tagName = openTagMatch[1].toLowerCase();
  const rawAttrs = openTagMatch[2] ?? "";
  const selfClosing = /\/\s*$/.test(rawAttrs);

  const attrs: Record<string, string> = {};
  const attrRe = /([:@A-Za-z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;

  for (let attrMatch = attrRe.exec(rawAttrs); attrMatch; attrMatch = attrRe.exec(rawAttrs)) {
    const key = attrMatch[1].toLowerCase();
    const value = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";
    attrs[key] = value;
  }

  return { tagName, attrs, selfClosing };
}

function filterAttributes(attrs: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(attrs)) {
    if (ALLOWED_ATTRIBUTES.has(key) || ALLOWED_DATA_ATTRIBUTES.has(key)) {
      if (key === "style") {
        const style = sanitizeStyle(value);
        if (style) {
          filtered.style = style;
        }
        continue;
      }
      filtered[key] = value;
    }
  }

  return filtered;
}

function sanitizeStyle(style: string): string {
  const declarations = style
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const kept: string[] = [];

  for (const declaration of declarations) {
    const colonIdx = declaration.indexOf(":");
    if (colonIdx < 0) continue;

    const property = declaration.slice(0, colonIdx).trim().toLowerCase();
    const value = declaration.slice(colonIdx + 1).trim();

    if (!ALLOWED_CSS_PROPERTIES.has(property)) {
      continue;
    }

    if (BANNED_CSS_PATTERNS.some((pattern) => pattern.test(value))) {
      continue;
    }

    kept.push(`${property}:${value}`);
  }

  return kept.join("; ");
}

function closeStackUntil(stack: ElementNode[], tagName: string): void {
  for (let i = stack.length - 1; i >= 1; i--) {
    if (stack[i].tagName === tagName) {
      stack.length = i;
      return;
    }
  }
}
