import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/html-parser.js";
import { extractSchemaFromAst } from "../../src/schema-extractor.js";

describe("semantic injection", () => {
  it("reads semantic meta tags", () => {
    const ast = parseHtml(`
      <html>
        <head>
          <meta name="semantic-description:user.name" content="User name" />
          <meta name="semantic-instruction:user.name" content="Use official name" />
          <meta name="semantic-examples:user.name" content="Alice; Bob" />
        </head>
        <body><p>{{ user.name:string }}</p></body>
      </html>
    `);

    const schema = extractSchemaFromAst(ast) as any;
    const nameSchema = schema.properties.user.properties.name;

    expect(nameSchema.description).toBe("User name");
    expect(nameSchema["x-instruction"]).toBe("Use official name");
    expect(nameSchema.examples).toStrictEqual(["Alice", "Bob"]);
  });

  it("supports custom examples delimiter", () => {
    const ast = parseHtml(`
      <html>
        <head>
          <meta name="semantic:examples-delimiter" content="," />
          <meta name="semantic-examples:user.code" content="A,B,C" />
        </head>
        <body><p>{{ user.code:string }}</p></body>
      </html>
    `);

    const schema = extractSchemaFromAst(ast) as any;
    expect(schema.properties.user.properties.code.examples).toStrictEqual(["A", "B", "C"]);
  });

  it("applies inline semantics for nested repeat paths", () => {
    const ast = parseHtml(`
      <html><body>
        <section data-page="contracts as contract">
          <tr data-repeat="contract.items as item">
            <td data-semantic-description="Item label">{{ item.name:string }}</td>
          </tr>
        </section>
      </body></html>
    `);

    const schema = extractSchemaFromAst(ast) as any;
    const node = schema.properties.contracts.items.properties.items.items.properties.name;
    expect(node.description).toBe("Item label");
  });
});
