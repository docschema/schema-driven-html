/**
 * Fixtures Test
 *
 * Reads HTML templates placed in test/fixtures/input/ as DSL,
 * and outputs the generation artifacts (AST, JSON Schema) and
 * rendered HTML to test/fixtures/output/.
 *
 * Workflow:
 *   1. Place input/<name>.html and run the test
 *   2. If no data.json exists, a skeleton is generated at input/<name>.data.json
 *   3. Fill in sample data in the skeleton
 *   4. Re-run the test → AST, Schema, and rendered HTML are output to output/
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import { parseDslAst, extractSchema, render } from "../../src/index.js";

// ── Paths ──

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const INPUT_DIR = resolve(__dirname, "input");
const OUTPUT_DIR = resolve(__dirname, "output");

// ── Ensure directories ──

if (!existsSync(INPUT_DIR)) mkdirSync(INPUT_DIR, { recursive: true });
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Discover HTML files ──

const htmlFiles = existsSync(INPUT_DIR)
  ? readdirSync(INPUT_DIR).filter((f) => f.endsWith(".html"))
  : [];

// ── HTML Formatter ──

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr",
  "img", "input", "link", "meta", "source", "track", "wbr",
]);

/**
 * Formats compact HTML into indented, human-readable form.
 * Designed for inspecting rendered output — not for production use.
 */
function formatHtml(html: string): string {
  const lines: string[] = [];
  let indent = 0;
  let pos = 0;

  while (pos < html.length) {
    if (html[pos] === "<") {
      const end = html.indexOf(">", pos);
      if (end === -1) break;

      const tag = html.substring(pos, end + 1);
      const isClosing = tag.startsWith("</");
      const isDoctype = tag.toLowerCase().startsWith("<!doctype");
      const tagNameMatch = tag.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
      const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : "";
      const isVoid = VOID_TAGS.has(tagName);

      if (isClosing) indent = Math.max(0, indent - 1);
      lines.push("  ".repeat(indent) + tag);
      if (!isClosing && !isVoid && !isDoctype) indent++;

      pos = end + 1;
    } else {
      const nextTag = html.indexOf("<", pos);
      const text = (
        nextTag === -1 ? html.substring(pos) : html.substring(pos, nextTag)
      ).trim();

      if (text) {
        lines.push("  ".repeat(indent) + text);
      }
      pos = nextTag === -1 ? html.length : nextTag;
    }
  }

  return lines.join("\n") + "\n";
}

// ── Skeleton Data Generator ──

/**
 * Recursively generates skeleton data from a JSON Schema.
 * Each field is populated with a type-appropriate empty value.
 */
function generateSkeletonData(schema: Record<string, unknown>): unknown {
  const type = schema.type;

  // nullable: ["string", "null"] → null
  if (Array.isArray(type)) {
    const hasNull = type.includes("null");
    if (hasNull) return null;

    const nonNullType = type.find((t: string) => t !== "null");
    if (typeof nonNullType === "string") {
      return generateForType(nonNullType, schema);
    }
    return null;
  }

  if (typeof type === "string") {
    return generateForType(type, schema);
  }

  return null;
}

function generateForType(
  type: string,
  schema: Record<string, unknown>
): unknown {
  switch (type) {
    case "object": {
      const result: Record<string, unknown> = {};
      const properties = schema.properties as
        | Record<string, Record<string, unknown>>
        | undefined;

      if (properties) {
        for (const [key, propSchema] of Object.entries(properties)) {
          result[key] = generateSkeletonData(propSchema);
        }
      }
      return result;
    }

    case "array": {
      const items = schema.items as Record<string, unknown> | undefined;
      if (items) {
        return [generateSkeletonData(items)];
      }
      return [];
    }

    case "string":
      return "";

    case "integer":
      return 0;

    case "number":
      return 0;

    case "boolean":
      return false;

    default:
      return null;
  }
}

// ── Tests ──

if (htmlFiles.length === 0) {
  describe("fixtures", () => {
    it.skip("no HTML files in test/fixtures/input/", () => {});
  });
} else {
  describe("fixtures", () => {
    for (const htmlFile of htmlFiles) {
      const name = basename(htmlFile, ".html");

      describe(name, () => {
        const templatePath = resolve(INPUT_DIR, htmlFile);
        const dataPath = resolve(INPUT_DIR, `${name}.data.json`);
        const template = readFileSync(templatePath, "utf-8");

        it("outputs AST", () => {
          const ast = parseDslAst(template);

          expect(ast).toBeDefined();
          expect(ast.type).toBe("element");

          const outPath = resolve(OUTPUT_DIR, `${name}.ast.json`);
          writeFileSync(outPath, JSON.stringify(ast, null, 2), "utf-8");

          expect(existsSync(outPath)).toBe(true);
        });

        it("outputs JSON Schema", () => {
          const schema = extractSchema(template);

          expect(schema).toBeDefined();
          expect((schema as Record<string, unknown>).$schema).toBe(
            "https://json-schema.org/draft/2020-12/schema"
          );

          const outPath = resolve(OUTPUT_DIR, `${name}.schema.json`);
          writeFileSync(outPath, JSON.stringify(schema, null, 2), "utf-8");

          expect(existsSync(outPath)).toBe(true);
        });

        if (existsSync(dataPath)) {
          it("outputs rendered HTML", () => {
            const data = JSON.parse(readFileSync(dataPath, "utf-8"));
            const html = render(template, data);

            expect(html).toBeDefined();
            expect(html.startsWith("<!doctype html>")).toBe(true);

            const outPath = resolve(OUTPUT_DIR, `${name}.rendered.html`);
            writeFileSync(outPath, formatHtml(html), "utf-8");

            expect(existsSync(outPath)).toBe(true);
          });
        } else {
          it("generates skeleton data.json to input/", () => {
            const schema = extractSchema(template) as Record<string, unknown>;
            const skeleton = generateSkeletonData(schema);

            writeFileSync(
              dataPath,
              JSON.stringify(skeleton, null, 2),
              "utf-8"
            );

            expect(existsSync(dataPath)).toBe(true);
          });
        }
      });
    }
  });
}
