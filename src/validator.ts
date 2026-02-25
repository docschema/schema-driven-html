import { isPlainObject } from "./dsl-utils.js";

export function validateData(
  data: Record<string, unknown>,
  schema: Record<string, unknown>
): void {
  validateValue(data, schema, "$data");
}

function validateValue(value: unknown, schema: Record<string, unknown>, path: string): void {
  const type = schema.type;

  if (Array.isArray(type)) {
    const nullable = type.includes("null");
    const nonNullType = type.find((entry) => entry !== "null");

    if (value === null && nullable) {
      return;
    }

    if (typeof nonNullType === "string") {
      validateType(value, nonNullType, path);
    }
  } else if (typeof type === "string") {
    validateType(value, type, path);
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    if (!schema.enum.some((entry) => Object.is(entry, value))) {
      throw new Error(`Validation failed at ${path}: value is not in enum`);
    }
  }

  if (Object.prototype.hasOwnProperty.call(schema, "const")) {
    if (!Object.is(schema.const, value)) {
      throw new Error(`Validation failed at ${path}: value is not const`);
    }
  }

  if (schema.type === "string" || (Array.isArray(schema.type) && schema.type.includes("string"))) {
    validateStringConstraints(value, schema, path);
  }

  if (
    schema.type === "number" ||
    schema.type === "integer" ||
    (Array.isArray(schema.type) && (schema.type.includes("number") || schema.type.includes("integer")))
  ) {
    validateNumberConstraints(value, schema, path);
  }

  if (schema.format && typeof value === "string") {
    validateStringFormat(value, String(schema.format), path);
  }

  if (schema.type === "object" || (Array.isArray(schema.type) && schema.type.includes("object"))) {
    validateObject(value, schema, path);
  }

  if (schema.type === "array" || (Array.isArray(schema.type) && schema.type.includes("array"))) {
    validateArray(value, schema, path);
  }
}

function validateType(value: unknown, type: string, path: string): void {
  if (type === "object") {
    if (!isPlainObject(value)) {
      throw new Error(`Validation failed at ${path}: expected object`);
    }
    return;
  }

  if (type === "array") {
    if (!Array.isArray(value)) {
      throw new Error(`Validation failed at ${path}: expected array`);
    }
    return;
  }

  if (type === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new Error(`Validation failed at ${path}: expected integer`);
    }
    return;
  }

  if (type === "number") {
    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`Validation failed at ${path}: expected number`);
    }
    return;
  }

  if (type === "null") {
    if (value !== null) {
      throw new Error(`Validation failed at ${path}: expected null`);
    }
    return;
  }

  if (typeof value !== type) {
    throw new Error(`Validation failed at ${path}: expected ${type}`);
  }
}

function validateObject(value: unknown, schema: Record<string, unknown>, path: string): void {
  if (!isPlainObject(value)) {
    return;
  }

  const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const properties = isPlainObject(schema.properties)
    ? (schema.properties as Record<string, Record<string, unknown>>)
    : {};

  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key) || value[key] === undefined) {
      throw new Error(`Validation failed at ${path}.${key}: required property missing`);
    }
  }

  for (const [key, propSchema] of Object.entries(properties)) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    validateValue(value[key], propSchema, `${path}.${key}`);
  }
}

function validateArray(value: unknown, schema: Record<string, unknown>, path: string): void {
  if (!Array.isArray(value)) {
    return;
  }

  if (!isPlainObject(schema.items)) {
    return;
  }

  value.forEach((item, index) => {
    validateValue(item, schema.items as Record<string, unknown>, `${path}[${index}]`);
  });
}

function validateStringConstraints(value: unknown, schema: Record<string, unknown>, path: string): void {
  if (typeof value !== "string") return;

  if (typeof schema.minLength === "number" && value.length < schema.minLength) {
    throw new Error(`Validation failed at ${path}: shorter than minLength`);
  }

  if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
    throw new Error(`Validation failed at ${path}: longer than maxLength`);
  }

  if (typeof schema.pattern === "string") {
    const regex = new RegExp(schema.pattern);
    if (!regex.test(value)) {
      throw new Error(`Validation failed at ${path}: pattern mismatch`);
    }
  }
}

function validateNumberConstraints(value: unknown, schema: Record<string, unknown>, path: string): void {
  if (typeof value !== "number") return;

  if (typeof schema.minimum === "number" && value < schema.minimum) {
    throw new Error(`Validation failed at ${path}: smaller than minimum`);
  }
  if (typeof schema.maximum === "number" && value > schema.maximum) {
    throw new Error(`Validation failed at ${path}: larger than maximum`);
  }
  if (typeof schema.exclusiveMinimum === "number" && value <= schema.exclusiveMinimum) {
    throw new Error(`Validation failed at ${path}: not greater than exclusiveMinimum`);
  }
  if (typeof schema.exclusiveMaximum === "number" && value >= schema.exclusiveMaximum) {
    throw new Error(`Validation failed at ${path}: not less than exclusiveMaximum`);
  }
  if (typeof schema.multipleOf === "number" && value % schema.multipleOf !== 0) {
    throw new Error(`Validation failed at ${path}: not multipleOf`);
  }
}

function validateStringFormat(value: string, format: string, path: string): void {
  const formatRegex: Record<string, RegExp> = {
    date: /^\d{4}-\d{2}-\d{2}$/,
    time: /^\d{2}:\d{2}(:\d{2})?$/,
    "date-time": /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
  };

  const regex = formatRegex[format];
  if (regex && !regex.test(value)) {
    throw new Error(`Validation failed at ${path}: invalid format ${format}`);
  }
}
