import { parseHtml } from "./html-parser.js";
import { renderAst } from "./renderer.js";
import { extractSchemaFromAst } from "./schema-extractor.js";
import { validateData } from "./validator.js";

export { parseTextSegments } from "./expression-parser.js";
export { parseHtml } from "./html-parser.js";
export { extractSchemaFromAst } from "./schema-extractor.js";
export { renderAst } from "./renderer.js";
export { applyFilters } from "./filters.js";
export { validateData } from "./validator.js";

export function parseDslAst(htmlDSL: string) {
  return parseHtml(htmlDSL);
}

export function extractSchema(htmlDSL: string): Record<string, unknown> {
  const ast = parseHtml(htmlDSL);
  return extractSchemaFromAst(ast);
}

export function render(htmlDSL: string, data: Record<string, unknown>): string {
  const ast = parseHtml(htmlDSL);
  return `<!doctype html>${renderAst(ast, data)}`;
}

export function validate(data: Record<string, unknown>, schema: Record<string, unknown>): void {
  validateData(data, schema);
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
