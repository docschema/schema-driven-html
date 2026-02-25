import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/html-parser.js";
import { renderAst } from "../../src/renderer.js";
import { extractSchemaFromAst } from "../../src/schema-extractor.js";

describe("global config", () => {
  it("timezone meta affects datetime rendering", () => {
    const ast = parseHtml(`
      <html>
        <head><meta name="timezone" content="Asia/Tokyo" /></head>
        <body><p>{{ ts:datetime | date-format:YYYY-MM-DD HH:mm }}</p></body>
      </html>
    `);

    const html = renderAst(ast, { ts: "2026-02-23T00:00:00Z" });
    expect(html).toContain("2026-02-23 09:00");
  });

  it("semantic examples delimiter meta affects schema extraction", () => {
    const ast = parseHtml(`
      <html>
        <head>
          <meta name="semantic:examples-delimiter" content="|" />
          <meta name="semantic-examples:user.role" content="admin|operator|viewer" />
        </head>
        <body><p>{{ user.role:string }}</p></body>
      </html>
    `);

    const schema = extractSchemaFromAst(ast) as any;
    expect(schema.properties.user.properties.role.examples).toStrictEqual([
      "admin",
      "operator",
      "viewer",
    ]);
  });
});
