import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/html-parser.js";
import { extractSchemaFromAst } from "../../src/schema-extractor.js";

describe("extractSchemaFromAst", () => {
  it("maps interpolation type and constraints", () => {
    const ast = parseHtml("<html><body><p>{{ price:integer (min:0, exMax:1000) }}</p></body></html>");
    const schema = extractSchemaFromAst(ast) as any;

    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    expect(schema.properties.price.type).toBe("integer");
    expect(schema.properties.price.minimum).toBe(0);
    expect(schema.properties.price.exclusiveMaximum).toBe(1000);
    expect(schema.required).toContain("price");
  });

  it("handles nullable fields", () => {
    const ast = parseHtml("<html><body><p>{{ note:string? }}</p></body></html>");
    const schema = extractSchemaFromAst(ast) as any;

    expect(schema.properties.note.type).toStrictEqual(["string", "null"]);
    expect(schema.required ?? []).not.toContain("note");
  });

  it("builds nested schema for data-page and data-repeat", () => {
    const ast = parseHtml(`
      <html><body>
        <section data-page="contracts as contract">
          <tr data-repeat="contract.items as item">
            <td>{{ item.name:string }}</td>
            <td>{{ item.price:number }}</td>
          </tr>
        </section>
      </body></html>
    `);
    const schema = extractSchemaFromAst(ast) as any;

    expect(schema.properties.contracts.type).toBe("array");
    expect(schema.properties.contracts.items.properties.items.type).toBe("array");
    expect(schema.properties.contracts.items.properties.items.items.properties.name.type).toBe("string");
    expect(schema.properties.contracts.items.properties.items.items.properties.price.type).toBe("number");
  });

  it("injects semantic metadata from meta and inline attributes", () => {
    const ast = parseHtml(`
      <html>
        <head>
          <meta name="semantic:examples-delimiter" content=";">
          <meta name="semantic-description:user.name" content="User full name">
          <meta name="semantic-instruction:user.name" content="Use legal name">
          <meta name="semantic-examples:user.name" content="Alice; Bob">
        </head>
        <body>
          <p data-semantic-description="Display label">{{ user.name:string }}</p>
        </body>
      </html>
    `);
    const schema = extractSchemaFromAst(ast) as any;
    const nameSchema = schema.properties.user.properties.name;

    expect(nameSchema.description).toBe("Display label");
    expect(nameSchema["x-instruction"]).toBe("Use legal name");
    expect(nameSchema.examples).toStrictEqual(["Alice", "Bob"]);
  });

  it("is deterministic", () => {
    const ast = parseHtml("<html><body><p>{{ a:string }}</p><p>{{ b:number }}</p></body></html>");
    const s1 = extractSchemaFromAst(ast);
    const s2 = extractSchemaFromAst(ast);
    expect(s1).toStrictEqual(s2);
  });
});
