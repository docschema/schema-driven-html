import { parseHtml } from "./html-parser.js";
import { renderAst } from "./renderer.js";
import { extractSchemaFromAst } from "./schema-extractor.js";
import { validateData } from "./validator.js";
import { DslError, DslSyntaxError, SchemaExtractionError, DataValidationError, RenderError } from "./errors.js";

export { parseTextSegments } from "./expression-parser.js";
export { parseHtml } from "./html-parser.js";
export { extractSchemaFromAst } from "./schema-extractor.js";
export { renderAst } from "./renderer.js";
export { applyFilters } from "./filters.js";
export { validateData } from "./validator.js";
export { DslError, DslSyntaxError, SchemaExtractionError, DataValidationError, RenderError } from "./errors.js";

export function parseDslAst(htmlDSL: string) {
  try {
    return parseHtml(htmlDSL);
  } catch (err) {
    if (err instanceof DslError) throw err;
    throw new DslSyntaxError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}

export function extractSchema(htmlDSL: string): Record<string, unknown> {
  try {
    const ast = parseHtml(htmlDSL);
    return extractSchemaFromAst(ast);
  } catch (err) {
    if (err instanceof DslError) throw err;
    throw new SchemaExtractionError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}

export function render(htmlDSL: string, data: Record<string, unknown>): string {
  try {
    const ast = parseHtml(htmlDSL);
    return `<!doctype html>${renderAst(ast, data)}`;
  } catch (err) {
    if (err instanceof DslError) throw err;
    throw new RenderError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}

export function validate(data: Record<string, unknown>, schema: Record<string, unknown>): void {
  try {
    validateData(data, schema);
  } catch (err) {
    if (err instanceof DslError) throw err;
    throw new DataValidationError(err instanceof Error ? err.message : String(err), { cause: err });
  }
}

export type {
  DslNode,
  ElementNode,
  TextNode,
  TextSegment,
  LiteralSegment,
  InterpolationSegment,
  DataType,
  Constraint,
  Filter,
} from "./types.js";

export type { ErrorCategory } from "./errors.js";
