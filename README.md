# schema-driven-html

> **⚠️ Warning: Draft / Experimental**  
> This package is currently in early development. APIs are subject to change without notice.  
---- 
**JSON Schema extraction and deterministic rendering engine for a HTML-based document DSL.**

This runtime and DSL are intended for document generation, reporting, and AI-driven systems that require templates to define the data schema.

schema-driven-html is a runtime that executes a contract-driven DSL.  
Templates written in the DSL define the data contract between the template structure and input data.

The runtime provides:
* JSON Schema extraction from DSL templates
* Input data validation against the extracted JSON Schema
* Deterministic HTML rendering

DSL Specification: [DSL_SPECIFICATION.md](./DSL_SPECIFICATION.md)  
DSL PROMPT: [DSL_PROMPT](./DSL_PROMPT.md) 

## Installation

```bash
npm install @docschema/schema-driven-html
```

## Quick Example

### Template (DSL)

```html
<html>
  <body>
    <section data-page="contracts as contract">
      <p>{{ contract.customer:string }}</p>
      <table>
        <tbody>
          <tr data-if="item.enabled"
            data-repeat="contract.items as item">
            <td>{{ item.name:string }}</td>
            <td>{{ item.price:integer | comma }}</td>
            <td>{{ item.issueDate:date | date-format:YYYY/MM/DD }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </body>
</html>
```

### Usage

```ts
import {
  extractSchema,
  validate,
  render,
} from "schema-driven-html";

// extract JSON Schema.
const schema = extractSchema(htmlDSL);

// varidate input data,
validate(data, schema);

// rendering html
const html = render(htmlDSL, data);
```
```json
// extracted JSON Schema
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["contracts"],
  "properties": {
    "contracts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["customer", "items"],
        "properties": {
          "customer": { "type": "string" },
          "items": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["enabled", "issueDate", "name", "price"],
              "properties": {
                "enabled": { "type": "boolean" },
                "issueDate": { "type": "string", "format": "date" },
                "name": { "type": "string" },
                "price": { "type": "integer" }
              }
            }
          }
        }
      }
    }
  }
}
```

## API

```ts
extractSchema(htmlDSL: string): Record<string, unknown>
```
- Extracts deterministic JSON Schema (draft 2020-12 header included).
- Reflects interpolation types/constraints, `data-page`, `data-repeat`, `data-if`.
- Injects semantic metadata from `meta` and `data-semantic-*`.

```ts
validate(data: Record<string, unknown>, schema: Record<string, unknown>): void
```
- Validates input data against extracted schema structure.
- Throws on mismatch (required/type/constraint/format).

```ts
render(htmlDSL: string, data: Record<string, unknown>): string
```
- Renders deterministic HTML from DSL + data.
- Returns full HTML with `<!doctype html>` prefix.
- Applies DSL filters and control attributes (`data-repeat`, `data-page`, `data-if`).

## Development

Use `npm run test:fixtures` to verify templates.

```
test/fixtures/
├── input/
│   ├── example_doc.html        # document template
│   └── example_doc.data.json   # Input data
└── output/
    ├── example_doc.schema.json   # Generated JSON-Schema 
    └── example_doc.rendered.html # Rendered result
```

When running tests, the system automatically:
1. Reads HTML from `input/`
2. If `data.json` is missing, generates an empty JSON template in `input/` based on the schema
3. Generates Schema and Rendered HTML in `output/`
