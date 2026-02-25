# DSL Specifications

This document defines the public specification for the HTML-based DSL used by `schema-driven-html`.

VERSION:0.0.1

## Overview

This DSL is not just a placeholder syntax. It is designed to inject **business semantics** into HTML documents.

From static HTML to a dynamic schema:
Template declarations are used to automatically generate JSON Schema.

Type and constraint enforcement:
Display rules and input constraints are defined together, ensuring consistency from schema extraction through rendering.

Context via metadata:
By combining template declarations with metadata such as timezone, document-wide interpretation rules can be defined.

## HTML Tags and Standard Attributes

Only a restricted subset of tags and attributes is preserved.

Allowed tags:

- `html`, `head`, `body`
- `div`, `section`, `header`, `footer`, `main`
- `p`, `span`, `strong`, `em`, `small`, `br`, `hr`
- `table`, `thead`, `tbody`, `tr`, `th`, `td`, `colgroup`
- `ul`, `ol`, `li`
- `img` (data URL only)

Allowed standard attributes:

- `style`, `class`, `id`, `lang`, `dir`
- `src`, `alt`
- `colspan`, `rowspan`

For `img`:

- `src` must start with `data:`
- non-data URLs are removed

Tags and attributes outside the allowed list are ignored during parsing.

## CSS

Only a restricted style subset is preserved.

Allowed CSS properties:

- `display`
- `width`, `height`
- `margin`, `padding`
- `box-sizing`
- `border`, `border-collapse`
- `font-family`, `font-size`, `font-weight`, `line-height`
- `text-align`, `white-space`, `letter-spacing`
- `color`, `background-color`
- `page-break-before`, `page-break-after`, `page-break-inside`
- `size`

Allowed units:

- `px`, `pt`, `mm`, `cm`, `in`, `%`
- unitless numeric values (for properties that allow unitless values, for example `line-height`)

Disallowed patterns are removed (examples):

- `position`, `float`, `flex`, `grid`
- `animation`, `transition`, `transform`, `filter`
- `calc(...)`, `var(...)`
- units `em`, `rem`, `vh`, `vw`, `ch`

`font-family` is restricted to a safe allow-list.

## Rendering Control Attributes

Supported extension attributes:

- `data-page`
- `data-if`
- `data-repeat`
- `data-break-before`
- `data-break-after`
- `data-fixed-rows`
- `data-max-rows`

### data-page

Expands an element by page units.

Syntax:

- `data-page="contracts as contract"`
- `data-page="contracts"` (implicit alias: `page`)

Behavior:

- array source => one element instance per item
- non-array source => one element instance
- injects `data-break-after="page"` on non-last pages when not explicitly set
- exposes `$page` object in scope:
- `$page.index` (0-based)
- `$page.number` (1-based)
- `$page.count` (total pages)

Example:

```html
<section data-page="contracts as contract">
  <p>{{ $page.number }}/{{ $page.count }}</p>
</section>
```

### data-if

Conditionally renders the current element.

- expression: dot-path lookup against current context
- truthy => render
- falsy => skip element

Example:

```html
<section data-if="contract.enabled">...</section>
```

### data-repeat

Repeats the current element for each item in an array.

Syntax:

- `data-repeat="items as item"`
- `data-repeat="items"` (implicit item name: `item`)

Behavior:

- non-array source => renders zero instances
- for each item, local variables:
- `item` (or custom alias)
- `index` (0-based)

Example:

```html
<tr data-repeat="items as item">
  <td>{{ item.name }}</td>
</tr>
```

### data-break-before / data-break-after

The renderer maps them to print-oriented CSS:

- `data-break-before` -> `page-break-before: always`
- `data-break-after` -> `page-break-after: always`

### data-fixed-rows

Used with `data-repeat`. Pads the output with empty rows when data count is less than the specified number.

Syntax:

- `data-fixed-rows="10"`

Behavior:

- value: positive integer
- if array length < specified count, empty elements are appended to fill the gap
- if array length >= specified count, no effect
- can be combined with `data-max-rows`

Example:

```html
<tr data-repeat="items as item" data-fixed-rows="5">
  <td>{{ item.name:string }}</td>
</tr>
```

### data-max-rows

Used with `data-repeat`. Truncates the output when data count exceeds the specified number.

Syntax:

- `data-max-rows="20"`

Behavior:

- value: positive integer
- if array length > specified count, only the first N items are rendered
- if array length <= specified count, no effect
- can be combined with `data-fixed-rows`

Example:

```html
<tr data-repeat="items as item" data-max-rows="10">
  <td>{{ item.name:string }}</td>
</tr>
```

## Semantic Injection

This syntax injects **business semantics** into an HTML document.

### Semantic Injection Syntax

Define semantics in `head` using `meta` tags.

```html
<meta name="<attribute>:<data-path>" content="CONTENT" />
```

| Attribute | Purpose | Effect on JSON Schema |
| :--- | :--- | :--- |
| `semantic-description` | Defines **what** the field is. | Mapped to `description`. |
| `semantic-instruction` | Specific advice on **how** to find data and **how** to generate the value. | Mapped to `x-instruction`. |
| `semantic-examples` | Concrete examples of expected data. Multiple values can be specified with semicolon (`;`) delimiters. | Mapped to `examples` (Array). |

Example:

```html
<head>
  <meta
    name="semantic-description:billing_address"
    content="The designated billing address specified in the contract agreement." />
  <meta
    name="semantic-instruction:billing_address"
    content="Locate the billing address near the signature block at the end of the document or under the section explicitly labeled 'Billing' or 'Invoicing'."
    />
</head>
```

### Inline Semantic Injection Syntax

Inline semantic syntax injects business semantics into enclosed interpolation expressions by writing semantic attributes on the surrounding tag.

| Attribute | Purpose | Effect on JSON Schema |
| :--- | :--- | :--- |
| `data-semantic-description` | Defines **what** the field is. | Mapped to `description`. |
| `data-semantic-instruction` | Specific advice on **how** to find data and **how** to generate the value. | Mapped to `x-instruction`. |
| `data-semantic-examples` | Concrete examples of expected data. Multiple values can be specified with semicolon (`;`) delimiters. | Mapped to `examples` (Array). |

Example:

```html
<span
  data-semantic-description="The postal code for the billing address."
  data-semantic-instruction="Extract as 7 digits in '3-4' hyphenated format (e.g., 000-0000)."
  data-semantic-examples="150-0042; 102-0001"
>
〒 {{ billing_address.postal_code:string }}
</span>
```

```json
// Extracted JSON Schema (Internal)
{
  "type" : "object",
  "propaties" : {
    "postal_code": {
      "type": "string",
      "description": "The postal code for the billing address.",
      "x-instruction": "Extract as 7 digits in '3-4' hyphenated format (e.g., 000-0000).",
      "examples": ["150-0042", "102-0001"]
    }
  },
  "required" : ["postal_code"]
}
```

## Interpolation Syntax

Interpolation syntax not only displays data but also attaches type and constraint metadata to input data.

Syntax:

```text
{{ path:type [?] [(constraints)] [| format] }}
```

- `path`: property reference in the data source
- `:type`: declares the data type
- `?`: nullable marker
- `(constraints)`: declares input constraints
- `| format`: formatting pipeline at render time

Example:

```html
<span>{{ item.price:integer (min:0, exMax: 10000) | comma }}</span>
```

```json
// extract json-schema
{
  "item" : {
    "type" : "object",
    "properties": {
      "price" : {
        "type" : "integer",
        "minimum": 0,
        "exclusiveMaximum" : 10000
      },
    },
    "required" : ["price"]
  },
}
```

```html
<!-- when input value is 9000 -->
<span>9,000</span>
```

### data-path

`path` resolves by dot-path from current context.

- missing/null values become empty

### data-type

Data type declaration is required.

- `string`: string
- `integer`: integer (no comma separators or units)
- `number`: numeric value (can include decimals)
- `boolean`: boolean
- `date`: ISO 8601 date
- `time`: ISO 8601 time
- `datetime`: ISO 8601 date + time

### Nullability

Defines presence and nullability behavior.

No marker: value is required.

- `path` is added to JSON Schema `required`.
- JSON Schema `type` does not include `null`.
- missing/null values are errors.

**`?`**: input value allows null.

- `path` is removed from JSON Schema `required`.
- JSON Schema `type` includes `null`.
- example: `{ "type": ["string", "null"] }`

### Data Constraints

Defines constraints on input data.

- If arguments contain commas, spaces, or delimiter characters (`|`, `(`, `)`), wrap them in quotes (`"` or `'`).

#### for string

| Data-constraints | Output JsonSchema | Description |
| ---- | ---- | ---- |
| `(enum:A,B)` | `{ "enum" : ["A", "B"] }` | choices (enum) |
| `(min:n)` | `{ "minLength" : n }` | minimum string length<br>n >= min |
| `(max:n)` | `{ "maxLength" : n }` | maximum string length<br>n <= max |
| `(pattern:...)` | `{ "pattern" : "..." }` | regular expression |
| `(fixed:A)` | `{ "const" : "A"}` | fixed value |

#### for integer / number

| Data-constraints | Output JsonSchema | Description |
| ---- | ---- | ---- |
| `(enum:a, b)` | `{ "enum" : [a, b] }` | choices (enum) |
| `(min:n)` | `{ "minimum" : n }` | n >= min |
| `(max:n)` | `{ "maximum" : n }` | n <= max |
| `(exMin:n)` | `{ "exclusiveMinimum" : n }` | n > exMin |
| `(exMax:n)` | `{ "exclusiveMaximum" : n }` | n < exMax |
| `(step:n)` | `{ "multipleOf" : n }` | multiple of n |
| `(fixed:n)` | `{ "const" : n}` | fixed value |

#### for boolean

| Data-constraints | Output JsonSchema | Description |
| ---- | ---- | ---- |
| `(fixed:bool)` | `{ "const" : bool }` | fixed value |

### Format Filter

Interpolation supports pipeline formatting:

```text
{{ item.price:integer | comma | zenkaku }}
```

- Filters are applied from left to right. If a filter changes the data type (for example number -> comma-formatted string), subsequent filters receive the transformed type.
- If arguments contain commas or spaces, wrap them in quotes (`"` or `'`).

#### for string

| Filter name | example | Description |
| ---- | ---- | ---- |
| `upper` | `"upper" -> "UPPER"` | convert to uppercase |
| `lower` | `"LOWER" -> "lower"` | convert to lowercase |
| `replace:FROM,TO` | `"abcFROM" -> "abcTO"` | replace specific text |
| `pad-left:n,X` | `"abc" -> "&nbsp;&nbsp;&nbsp;&nbsp;abc"` | left-pad to width n with X.<br>If `,X` is omitted, default is `"0"`. |
| `slice:start,end` | `"2026-02-21" -> "2026"` | slice from start up to (but excluding) end |
| `default:VALUE` | `null -> "VALUE"` | value used when input is null |
| `zenkaku` | `"zen123" -> "ｚｅｎ１２３"` | convert half-width alphanumeric to full-width (ja-JP)* |
| `hankaku` | `"ｈａｎ１２３" -> "han123"` | convert full-width alphanumeric to half-width (ja-JP)* |

#### for integer / number

| Filter name | example | Description |
| ---- | ---- | ---- |
| `comma` | `1234 -> "1,234"` | convert to comma-separated string |
| `fixed:n` | `1234 -> "1234.00"` | fixed to n decimal places |
| `pad-left:n,X` | `123 -> "0000123"` | left-pad to width n with X.<br>If `,X` is omitted, default is `"0"`. |
| `either:TRUTHY,FALSY` | `0 -> "FALSY"` | evaluate truthy/falsy and output one of the two values* |
| `default:n` | `null -> 1` | value used when input is null |

#### for boolean

| Filter name | example | Description |
| ---- | ---- | ---- |
| `either:TRUTHY,FALSY` | `true -> "TRUTHY"` | evaluate truthy/falsy and output one of the two values |
| `default:VALUE` | `null -> "VALUE"` | value used when input is null |

#### for date / time / datetime

| Filter name | example | Description |
| ---- | ---- | ---- |
| `date-format:FORMAT` | `"YYYY-MM-DD" -> "2026-02-21"` | format for display |
| `default:VALUE` | `null -> "VALUE"` | value used when input is null |

Timezone handling:

- `date` / `time`: no timezone calculation is performed. Input is displayed as-is.
- If a UTC suffix `Z` is included in input, it is ignored for `date` / `time`.
- `datetime`: ISO 8601 input is converted to the runtime-configured timezone for display.
- If input has no timezone offset, or ends with `Z`, it is interpreted as UTC.
- If input has a timezone offset, it is parsed as an absolute instant and then converted to the runtime timezone.

Notes:

- *The `zenkaku` and `hankaku` filters are provided specifically for Japanese locale (ja-JP) to handle Full-width/Half-width character conversions.
- *The `either` filter and condition evaluation follow JavaScript standard truthy/falsy semantics. Values below are treated as falsy; all others are truthy.
- Falsy: `false`, `0`, `-0`, `NaN`, `""`, `null`, `undefined`

## Global Config

Define global configuration in `head` with `meta` tags.

```html
<meta name="NAME" content="CONTENT" />
```

| NAME | CONTENT | Description |
| ---- | ---- | ---- |
| timezone | Asia/Tokyo | Timezone used during rendering |
| semantic:examples-delimiter | `;` | Changes delimiter used by `semantic-examples` (default: `;`) |
