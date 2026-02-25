import {
  clonePathAliasMap,
  collectGlobalConfig,
  normalizePath,
  parseIterationExpression,
  readTextContent,
  resolvePathWithAliases,
  stableSortObject,
} from "./dsl-utils.js";
import type { Constraint, DataType, DslNode, ElementNode, InterpolationSegment } from "./types.js";

interface SchemaObject {
  [key: string]: unknown;
}

interface TraverseContext {
  aliases: Record<string, string>;
  inlineSemantic?: InlineSemantic;
}

interface InlineSemantic {
  description?: string;
  instruction?: string;
  examples?: string[];
}

interface MetaSemanticMap {
  [path: string]: InlineSemantic;
}

export interface ExtractSchemaOptions {
  examplesDelimiter?: string;
}

export function extractSchemaFromAst(
  root: ElementNode,
  options: ExtractSchemaOptions = {}
): Record<string, unknown> {
  const globalConfig = collectGlobalConfig(root);
  const examplesDelimiter = options.examplesDelimiter ?? globalConfig.examplesDelimiter;

  const metaSemantics = collectMetaSemantics(root, examplesDelimiter);

  const schema: SchemaObject = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    properties: {},
    required: [],
  };

  const context: TraverseContext = { aliases: {} };
  walkNode(root, schema, context, metaSemantics, examplesDelimiter);

  return stableSortObject(schema) as Record<string, unknown>;
}

function walkNode(
  node: DslNode,
  schema: SchemaObject,
  context: TraverseContext,
  metaSemantics: MetaSemanticMap,
  examplesDelimiter: string
): void {
  if (node.type === "text") {
    for (const segment of node.segments) {
      if (segment.kind !== "interpolation") continue;

      const resolvedPath = resolvePathWithAliases(segment.path, context.aliases);
      applyInterpolationSchema(schema, resolvedPath, segment);

      const fieldSchema = getFieldSchema(schema, resolvedPath);
      if (!fieldSchema) continue;

      applySemantic(fieldSchema, metaSemantics[resolvedPath]);
      applySemantic(fieldSchema, context.inlineSemantic);
    }
    return;
  }

  if (node.tagName === "meta") {
    return;
  }

  const nextContext: TraverseContext = {
    aliases: clonePathAliasMap(context.aliases),
    inlineSemantic: buildInlineSemantic(node, context.inlineSemantic, examplesDelimiter),
  };

  const pageExpr = node.attributes["data-page"];
  if (pageExpr) {
    const parsed = parseIterationExpression(pageExpr);
    const path = resolvePathWithAliases(parsed.path, nextContext.aliases);
    ensureArrayPath(schema, path, true);
    nextContext.aliases[parsed.alias] = `${path}[]`;
  }

  const repeatExpr = node.attributes["data-repeat"];
  if (repeatExpr) {
    const parsed = parseIterationExpression(repeatExpr);
    const path = resolvePathWithAliases(parsed.path, nextContext.aliases);
    ensureArrayPath(schema, path, true);
    nextContext.aliases[parsed.alias] = `${path}[]`;
  }

  const condition = node.attributes["data-if"];
  if (condition) {
    const conditionPath = resolvePathWithAliases(condition, nextContext.aliases);
    applyInterpolationSchema(schema, conditionPath, {
      kind: "interpolation",
      path: conditionPath,
      dataType: "boolean",
      nullable: false,
      constraints: [],
      filters: [],
    });
  }

  for (const child of node.children) {
    walkNode(child, schema, nextContext, metaSemantics, examplesDelimiter);
  }
}

function collectMetaSemantics(root: ElementNode, delimiter: string): MetaSemanticMap {
  const map: MetaSemanticMap = {};

  const queue: ElementNode[] = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.tagName === "meta") {
      const name = current.attributes.name ?? "";
      const content = current.attributes.content ?? "";

      if (name.startsWith("semantic-description:")) {
        const path = name.slice("semantic-description:".length);
        map[path] = { ...(map[path] ?? {}), description: content };
      } else if (name.startsWith("semantic-instruction:")) {
        const path = name.slice("semantic-instruction:".length);
        map[path] = { ...(map[path] ?? {}), instruction: content };
      } else if (name.startsWith("semantic-examples:")) {
        const path = name.slice("semantic-examples:".length);
        const examples = splitExamples(content, delimiter);
        map[path] = { ...(map[path] ?? {}), examples };
      }
    }

    for (const child of current.children) {
      if (child.type === "element") {
        queue.push(child);
      }
    }
  }

  return map;
}

function splitExamples(raw: string, delimiter: string): string[] {
  return raw
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildInlineSemantic(
  node: ElementNode,
  inherited: InlineSemantic | undefined,
  delimiter: string
): InlineSemantic | undefined {
  const description = node.attributes["data-semantic-description"];
  const instruction = node.attributes["data-semantic-instruction"];
  const examplesRaw = node.attributes["data-semantic-examples"];

  if (!description && !instruction && !examplesRaw) {
    return inherited;
  }

  return {
    description: description ?? inherited?.description,
    instruction: instruction ?? inherited?.instruction,
    examples: examplesRaw ? splitExamples(examplesRaw, delimiter) : inherited?.examples,
  };
}

function ensureArrayPath(schema: SchemaObject, path: string, required: boolean): void {
  ensurePathNode(schema, normalizePath(path), {
    type: "array",
    items: {
      type: "object",
      properties: {},
      required: [],
    },
  }, required);
}

function applyInterpolationSchema(
  schema: SchemaObject,
  path: string,
  interpolation: InterpolationSegment
): void {
  const fieldSchema = buildFieldSchema(interpolation.dataType, interpolation.nullable, interpolation.constraints);
  ensurePathNode(schema, normalizePath(path), fieldSchema, !interpolation.nullable);
}

function buildFieldSchema(
  dataType: DataType,
  nullable: boolean,
  constraints: Constraint[]
): SchemaObject {
  const node: SchemaObject = mapTypeToSchema(dataType, nullable);

  for (const constraint of constraints) {
    switch (constraint.kind) {
      case "enum":
        node.enum = constraint.values;
        break;
      case "min":
        node.minimum = constraint.value;
        break;
      case "max":
        node.maximum = constraint.value;
        break;
      case "exMin":
        node.exclusiveMinimum = constraint.value;
        break;
      case "exMax":
        node.exclusiveMaximum = constraint.value;
        break;
      case "step":
        node.multipleOf = constraint.value;
        break;
      case "pattern":
        node.pattern = constraint.value;
        break;
      case "fixed":
        node.const = constraint.value;
        break;
      case "minLength":
        node.minLength = constraint.value;
        break;
      case "maxLength":
        node.maxLength = constraint.value;
        break;
      default:
        break;
    }
  }

  return node;
}

function mapTypeToSchema(dataType: DataType, nullable: boolean): SchemaObject {
  const baseType =
    dataType === "date" || dataType === "time" || dataType === "datetime"
      ? "string"
      : dataType;

  const node: SchemaObject = {
    type: nullable ? [baseType, "null"] : baseType,
  };

  if (dataType === "date") node.format = "date";
  if (dataType === "time") node.format = "time";
  if (dataType === "datetime") node.format = "date-time";

  return node;
}

function ensurePathNode(
  rootSchema: SchemaObject,
  path: string[],
  leafSchema: SchemaObject,
  required: boolean
): void {
  let current = rootSchema;

  for (let i = 0; i < path.length; i++) {
    const part = path[i];
    const isArray = part.endsWith("[]");
    const key = isArray ? part.slice(0, -2) : part;
    const isLast = i === path.length - 1;

    const properties = ensureObjectProperties(current);

    if (isLast) {
      const existing = (properties[key] as SchemaObject | undefined) ?? {};
      properties[key] = { ...existing, ...leafSchema };
      if (required) {
        pushRequired(current, key);
      }
      continue;
    }

    if (isArray) {
      const arrNode = (properties[key] as SchemaObject | undefined) ?? {
        type: "array",
        items: {
          type: "object",
          properties: {},
          required: [],
        },
      };

      if (!arrNode.items) {
        arrNode.items = {
          type: "object",
          properties: {},
          required: [],
        };
      }

      properties[key] = arrNode;
      pushRequired(current, key);
      current = arrNode.items as SchemaObject;
    } else {
      const objNode = (properties[key] as SchemaObject | undefined) ?? {
        type: "object",
        properties: {},
        required: [],
      };

      properties[key] = objNode;
      pushRequired(current, key);
      current = objNode;
    }
  }
}

function ensureObjectProperties(node: SchemaObject): Record<string, unknown> {
  if (!node.properties || typeof node.properties !== "object" || node.properties === null) {
    node.properties = {};
  }
  return node.properties as Record<string, unknown>;
}

function pushRequired(node: SchemaObject, key: string): void {
  if (!Array.isArray(node.required)) {
    node.required = [];
  }
  const required = node.required as string[];
  if (!required.includes(key)) {
    required.push(key);
  }
}

function getFieldSchema(rootSchema: SchemaObject, path: string): SchemaObject | null {
  const parts = normalizePath(path);
  let current: SchemaObject = rootSchema;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isArray = part.endsWith("[]");
    const key = isArray ? part.slice(0, -2) : part;

    const properties = current.properties as Record<string, unknown> | undefined;
    if (!properties || !properties[key]) {
      return null;
    }

    const next = properties[key] as SchemaObject;
    if (i === parts.length - 1) {
      return next;
    }

    if (isArray) {
      current = (next.items as SchemaObject) ?? {};
    } else {
      current = next;
    }
  }

  return null;
}

function applySemantic(target: SchemaObject, semantic: InlineSemantic | undefined): void {
  if (!semantic) return;

  if (semantic.description) {
    target.description = semantic.description;
  }
  if (semantic.instruction) {
    target["x-instruction"] = semantic.instruction;
  }
  if (semantic.examples && semantic.examples.length > 0) {
    target.examples = semantic.examples;
  }
}

export function extractGlobalConfigFromAst(root: ElementNode): { timezone: string; examplesDelimiter: string } {
  return collectGlobalConfig(root);
}

export function readElementText(node: ElementNode): string {
  return node.children.map((child) => readTextContent(child)).join("");
}
