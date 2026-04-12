# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-04-12

### Added

- Added typed error classes to allow programmatic identification of error origin:
  - `DslError` — base class for all library errors. Exposes a `category` property (`"dsl" | "schema" | "data" | "render"`), and optional `path` and `source` properties for additional context.
  - `DslSyntaxError` (`category: "dsl"`) — thrown for syntax errors in the HTML DSL template (invalid interpolation expressions, unknown constraints, unsupported filters, etc.).
  - `SchemaExtractionError` (`category: "schema"`) — thrown for unexpected errors during schema extraction.
  - `DataValidationError` (`category: "data"`) — thrown when data fails validation. The `path` property indicates the failing data path (e.g. `$data.user.age`).
  - `RenderError` (`category: "render"`) — thrown for errors that occur at render time.
- All error classes are exported from the package entry point.

### Changed

- Changed the default delimiter for `data-semantic-examples` (and `semantic-examples` meta tag) from semicolon (`;`) to pipe (`|`). Custom delimiters can still be set via `<meta name="semantic:examples-delimiter" content="..." />`.

## [0.0.2] - 2026-02-01

- Initial public release.
