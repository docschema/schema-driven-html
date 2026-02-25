import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/html-parser.js";
import { renderAst } from "../../src/renderer.js";

describe("renderAst", () => {
  it("renders simple interpolation", () => {
    const ast = parseHtml("<html><body><p>{{ user.name:string }}</p></body></html>");
    const html = renderAst(ast, { user: { name: "Alice" } });
    expect(html).toContain("<p>Alice</p>");
  });

  it("renders data-repeat and data-if", () => {
    const ast = parseHtml(`
      <html><body>
        <ul>
          <li data-repeat="items as item" data-if="item.enabled">{{ item.name:string }}</li>
        </ul>
      </body></html>
    `);

    const html = renderAst(ast, {
      items: [
        { name: "A", enabled: true },
        { name: "B", enabled: false },
      ],
    });

    expect(html).toContain("<li>A</li>");
    expect(html).not.toContain("<li>B</li>");
  });

  it("renders data-page", () => {
    const ast = parseHtml(`
      <html><body>
        <section data-page="contracts as contract"><p>{{ contract.customer:string }}</p></section>
      </body></html>
    `);
    const html = renderAst(ast, {
      contracts: [{ customer: "One" }, { customer: "Two" }],
    });
    expect(html).toContain("<p>One</p>");
    expect(html).toContain("<p>Two</p>");
  });

  it("applies filters and escapes html", () => {
    const ast = parseHtml(`
      <html><body><p>{{ price:integer | comma }}</p><p>{{ name:string | upper }}</p></body></html>
    `);
    const html = renderAst(ast, { price: 1200, name: "<alice>" });
    expect(html).toContain("<p>1,200</p>");
    expect(html).toContain("<p>&lt;ALICE&gt;</p>");
  });

  it("converts break attributes to print style", () => {
    const ast = parseHtml(
      '<html><body><section data-break-before="always" data-break-after="always">x</section></body></html>'
    );
    const html = renderAst(ast, {});
    expect(html).toContain("page-break-before:always");
    expect(html).toContain("page-break-after:always");
  });

  it("data-fixed-rows pads empty rows", () => {
    const ast = parseHtml(`
      <html><body><table>
        <tr data-repeat="items as item" data-fixed-rows="5">
          <td>{{ item.name:string }}</td>
        </tr>
      </table></body></html>
    `);
    const html = renderAst(ast, {
      items: [{ name: "A" }, { name: "B" }],
    });

    expect(html).toContain("<td>A</td>");
    expect(html).toContain("<td>B</td>");
    const trCount = (html.match(/<tr>/g) || []).length;
    expect(trCount).toBe(5);
  });

  it("data-max-rows truncates excess rows", () => {
    const ast = parseHtml(`
      <html><body><table>
        <tr data-repeat="items as item" data-max-rows="3">
          <td>{{ item.name:string }}</td>
        </tr>
      </table></body></html>
    `);
    const html = renderAst(ast, {
      items: [
        { name: "A" }, { name: "B" }, { name: "C" },
        { name: "D" }, { name: "E" },
      ],
    });

    expect(html).toContain("<td>A</td>");
    expect(html).toContain("<td>C</td>");
    expect(html).not.toContain("<td>D</td>");
    const trCount = (html.match(/<tr>/g) || []).length;
    expect(trCount).toBe(3);
  });

  it("data-fixed-rows and data-max-rows combined (data < fixed)", () => {
    const ast = parseHtml(`
      <html><body><table>
        <tr data-repeat="items as item" data-fixed-rows="5" data-max-rows="10">
          <td>{{ item.name:string }}</td>
        </tr>
      </table></body></html>
    `);
    const html = renderAst(ast, {
      items: [{ name: "A" }, { name: "B" }],
    });

    expect(html).toContain("<td>A</td>");
    expect(html).toContain("<td>B</td>");
    const trCount = (html.match(/<tr>/g) || []).length;
    expect(trCount).toBe(5);
  });

  it("data-fixed-rows and data-max-rows combined (data > max)", () => {
    const ast = parseHtml(`
      <html><body><table>
        <tr data-repeat="items as item" data-fixed-rows="5" data-max-rows="3">
          <td>{{ item.name:string }}</td>
        </tr>
      </table></body></html>
    `);
    const html = renderAst(ast, {
      items: [
        { name: "A" }, { name: "B" }, { name: "C" },
        { name: "D" }, { name: "E" }, { name: "F" },
        { name: "G" }, { name: "H" },
      ],
    });

    expect(html).toContain("<td>A</td>");
    expect(html).toContain("<td>C</td>");
    expect(html).not.toContain("<td>D</td>");
    const trCount = (html.match(/<tr>/g) || []).length;
    expect(trCount).toBe(5);
  });
});
