export type ErrorCategory = "dsl" | "schema" | "data" | "render";

export class DslError extends Error {
  readonly category: ErrorCategory;
  path?: string;
  source?: string;

  constructor(
    message: string,
    category: ErrorCategory,
    options?: { path?: string; source?: string; cause?: unknown }
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "DslError";
    this.category = category;
    if (options?.path !== undefined) this.path = options.path;
    if (options?.source !== undefined) this.source = options.source;
  }
}

export class DslSyntaxError extends DslError {
  readonly category = "dsl" as const;

  constructor(
    message: string,
    options?: { path?: string; source?: string; cause?: unknown }
  ) {
    super(message, "dsl", options);
    this.name = "DslSyntaxError";
  }
}

export class SchemaExtractionError extends DslError {
  readonly category = "schema" as const;

  constructor(
    message: string,
    options?: { path?: string; source?: string; cause?: unknown }
  ) {
    super(message, "schema", options);
    this.name = "SchemaExtractionError";
  }
}

export class DataValidationError extends DslError {
  readonly category = "data" as const;

  constructor(
    message: string,
    options?: { path?: string; source?: string; cause?: unknown }
  ) {
    super(message, "data", options);
    this.name = "DataValidationError";
  }
}

export class RenderError extends DslError {
  readonly category = "render" as const;

  constructor(
    message: string,
    options?: { path?: string; source?: string; cause?: unknown }
  ) {
    super(message, "render", options);
    this.name = "RenderError";
  }
}
