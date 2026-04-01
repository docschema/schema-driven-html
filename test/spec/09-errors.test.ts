import { describe, it, expect } from "vitest";
import {
  extractSchema,
  render,
  validate,
  DslError,
  DslSyntaxError,
  SchemaExtractionError,
  DataValidationError,
  RenderError,
} from "../../src/index.js";

describe("error classes", () => {
  describe("DslSyntaxError", () => {
    it("is thrown for missing type in interpolation", () => {
      expect(() => extractSchema(`<html><body><p>{{ name }}</p></body></html>`)).toThrow(DslSyntaxError);
    });

    it("is thrown for invalid path", () => {
      expect(() => extractSchema(`<html><body><p>{{ 123invalid:string }}</p></body></html>`)).toThrow(DslSyntaxError);
    });

    it("is thrown for invalid data type", () => {
      expect(() => extractSchema(`<html><body><p>{{ name:unknown }}</p></body></html>`)).toThrow(DslSyntaxError);
    });

    it("has category === 'dsl'", () => {
      let caught: unknown;
      try {
        extractSchema(`<html><body><p>{{ name }}</p></body></html>`);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DslSyntaxError);
      expect((caught as DslSyntaxError).category).toBe("dsl");
    });

    it("is an instance of DslError", () => {
      let caught: unknown;
      try {
        extractSchema(`<html><body><p>{{ name }}</p></body></html>`);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DslError);
    });

    it("is an instance of Error", () => {
      let caught: unknown;
      try {
        extractSchema(`<html><body><p>{{ name }}</p></body></html>`);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(Error);
    });

    it("preserves original error message text", () => {
      expect(() => extractSchema(`<html><body><p>{{ name }}</p></body></html>`)).toThrow(
        /Type is required/
      );
    });

    it("is thrown by render for DSL syntax errors", () => {
      expect(() => render(`<html><body><p>{{ name }}</p></body></html>`, {})).toThrow(DslSyntaxError);
    });

    it("is thrown for invalid constraint type", () => {
      expect(() =>
        extractSchema(`<html><body><p>{{ flag:boolean (enum: A, B) }}</p></body></html>`)
      ).toThrow(DslSyntaxError);
    });

    it("is thrown for invalid iteration expression", () => {
      expect(() =>
        extractSchema(`<html><body><tr data-repeat="items"><td>x</td></tr></body></html>`)
      ).toThrow(DslSyntaxError);
    });
  });

  describe("DataValidationError", () => {
    const template = `<html><body><p>{{ user.age:integer }}</p></body></html>`;
    const schema = extractSchema(template);

    it("is thrown for type mismatch", () => {
      expect(() => validate({ user: { age: "not-a-number" } } as any, schema)).toThrow(DataValidationError);
    });

    it("has category === 'data'", () => {
      let caught: unknown;
      try {
        validate({ user: { age: "not-a-number" } } as any, schema);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DataValidationError);
      expect((caught as DataValidationError).category).toBe("data");
    });

    it("has path property set", () => {
      let caught: unknown;
      try {
        validate({ user: { age: "not-a-number" } } as any, schema);
      } catch (err) {
        caught = err;
      }
      expect((caught as DataValidationError).path).toBeDefined();
      expect((caught as DataValidationError).path).toContain("user.age");
    });

    it("is an instance of DslError", () => {
      let caught: unknown;
      try {
        validate({ user: { age: "not-a-number" } } as any, schema);
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(DslError);
    });

    it("preserves original error message text", () => {
      expect(() => validate({ user: { age: "not-a-number" } } as any, schema)).toThrow(
        /Validation failed at/
      );
    });
  });

  describe("error name", () => {
    it("DslSyntaxError has correct name", () => {
      const err = new DslSyntaxError("test");
      expect(err.name).toBe("DslSyntaxError");
    });

    it("SchemaExtractionError has correct name", () => {
      const err = new SchemaExtractionError("test");
      expect(err.name).toBe("SchemaExtractionError");
    });

    it("DataValidationError has correct name", () => {
      const err = new DataValidationError("test");
      expect(err.name).toBe("DataValidationError");
    });

    it("RenderError has correct name", () => {
      const err = new RenderError("test");
      expect(err.name).toBe("RenderError");
    });
  });

  describe("instanceof hierarchy", () => {
    it("all subclasses are instanceof DslError", () => {
      expect(new DslSyntaxError("test")).toBeInstanceOf(DslError);
      expect(new SchemaExtractionError("test")).toBeInstanceOf(DslError);
      expect(new DataValidationError("test")).toBeInstanceOf(DslError);
      expect(new RenderError("test")).toBeInstanceOf(DslError);
    });

    it("all subclasses are instanceof Error", () => {
      expect(new DslSyntaxError("test")).toBeInstanceOf(Error);
      expect(new SchemaExtractionError("test")).toBeInstanceOf(Error);
      expect(new DataValidationError("test")).toBeInstanceOf(Error);
      expect(new RenderError("test")).toBeInstanceOf(Error);
    });
  });
});
