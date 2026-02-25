import { describe, it, expect } from "vitest";
import { extractSchema, parseDslAst, render, validate } from "../../src/index.js";

describe("public API", () => {
  const template = `
    <html><body>
      <section data-page="contracts as contract">
        <p>{{ contract.customer:string }}</p>
        <ul>
          <li data-repeat="contract.items as item">
            {{ item.name:string }} - {{ item.price:integer | comma }}
          </li>
        </ul>
      </section>
    </body></html>
  `;

  const data = {
    contracts: [
      {
        customer: "株式会社サンプル",
        items: [
          { name: "A", price: 1000 },
          { name: "B", price: 2000 },
        ],
      },
    ],
  };

  describe("parseDslAst", () => {
    it("returns a valid AST with element root", () => {
      const ast = parseDslAst(template);

      expect(ast).toBeDefined();
      expect(ast.type).toBe("element");
      expect(ast.tagName).toBe("html");
    });
  });

  describe("extractSchema", () => {
    it("returns a JSON Schema with $schema field", () => {
      const schema = extractSchema(template);

      expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
    });

    it("includes top-level array from data-page", () => {
      const schema = extractSchema(template) as any;

      expect(schema.properties.contracts).toBeDefined();
      expect(schema.properties.contracts.type).toBe("array");
    });

    it("extracts nested properties from expressions", () => {
      const schema = extractSchema(template) as any;
      const itemProps = schema.properties.contracts.items.properties.items.items.properties;

      expect(itemProps.name.type).toBe("string");
      expect(itemProps.price.type).toBe("integer");
    });
  });

  describe("validate", () => {
    it("passes for data conforming to schema", () => {
      const schema = extractSchema(template);

      expect(() => validate(data, schema)).not.toThrow();
    });

    it("throws when a required property is missing", () => {
      const schema = extractSchema(template);

      expect(() => validate({ contracts: [{ items: [] }] }, schema)).toThrowError();
    });

    it("throws when type does not match", () => {
      const simpleTemplate = `<html><body><p>{{ user.age:integer }}</p></body></html>`;
      const simpleSchema = extractSchema(simpleTemplate);

      expect(() => validate({ user: { age: "20" } } as any, simpleSchema)).toThrowError();
    });
  });

  describe("render", () => {
    it("returns HTML starting with doctype", () => {
      const html = render(template, data);

      expect(html.startsWith("<!doctype html>")).toBe(true);
    });

    it("interpolates string values into output", () => {
      const html = render(template, data);

      expect(html).toContain("株式会社サンプル");
    });

    it("applies comma filter", () => {
      const html = render(template, data);

      expect(html).toContain("1,000");
      expect(html).toContain("2,000");
    });

    it("repeats elements for each array item", () => {
      const html = render(template, data);
      const liCount = (html.match(/<li>/g) || []).length;

      expect(liCount).toBe(2);
    });
  });

  describe("pipeline", () => {
    it("extractSchema → validate → render works end-to-end", () => {
      const schema = extractSchema(template);
      validate(data, schema);
      const html = render(template, data);

      expect(html).toContain("株式会社サンプル");
      expect(html).toContain("1,000");
    });
  });
});
