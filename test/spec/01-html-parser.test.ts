import { describe, it, expect } from "vitest";
import { parseHtml } from "../../src/html-parser.js";

describe("parseHtml", () => {
  it("parses basic html/body tree", () => {
    const root = parseHtml("<html><body><p>Hello</p></body></html>");
    expect(root.tagName).toBe("html");
    expect(root.children[0]).toMatchObject({ type: "element", tagName: "body" });
  });

  it("strips disallowed tags", () => {
    const root = parseHtml("<html><body><script>alert(1)</script><p>ok</p></body></html>");
    const body = root.children[0];
    expect(body).toMatchObject({ type: "element", tagName: "body" });
    if (body?.type === "element") {
      expect(body.children).toHaveLength(1);
      expect(body.children[0]).toMatchObject({ type: "element", tagName: "p" });
    }
  });

  it("keeps only allowed attributes and data-* controls", () => {
    const root = parseHtml(
      '<html><body><section id="x" onclick="bad()" data-page="items as item" data-custom="x"></section></body></html>'
    );
    const body = root.children[0];
    if (body?.type !== "element") throw new Error("body not found");
    const section = body.children[0];
    if (section?.type !== "element") throw new Error("section not found");

    expect(section.attributes.id).toBe("x");
    expect(section.attributes["data-page"]).toBe("items as item");
    expect(section.attributes.onclick).toBeUndefined();
    expect(section.attributes["data-custom"]).toBeUndefined();
  });

  it("filters CSS properties and disallowed units", () => {
    const root = parseHtml(
      '<html><body><p style="font-size:12px; display:block; transform:rotate(1deg); width:100%; margin:8pt">x</p></body></html>'
    );
    const body = root.children[0];
    if (body?.type !== "element") throw new Error("body not found");
    const p = body.children[0];
    if (p?.type !== "element") throw new Error("p not found");

    expect(p.attributes.style).toContain("font-size:12px");
    expect(p.attributes.style).toContain("display:block");
    expect(p.attributes.style).toContain("margin:8pt");
    expect(p.attributes.style).not.toContain("transform");
    expect(p.attributes.style).not.toContain("100%");
  });

  it("removes img when src is not data URL", () => {
    const root = parseHtml(
      '<html><body><img src="https://example.com/x.png" alt="x"><img src="data:image/png;base64,AA==" alt="ok"></body></html>'
    );
    const body = root.children[0];
    if (body?.type !== "element") throw new Error("body not found");
    expect(body.children).toHaveLength(1);
    expect(body.children[0]).toMatchObject({ type: "element", tagName: "img" });
  });

  it("preserves meta tags in head", () => {
    const root = parseHtml(
      '<html><head><meta name="timezone" content="Asia/Tokyo"></head><body></body></html>'
    );
    const head = root.children[0];
    if (head?.type !== "element") throw new Error("head not found");
    const meta = head.children[0];
    expect(meta).toMatchObject({ type: "element", tagName: "meta" });
  });

  it("parses text interpolation segments", () => {
    const root = parseHtml("<html><body><p>Hello {{ user.name:string }}</p></body></html>");
    const body = root.children[0];
    if (body?.type !== "element") throw new Error("body not found");
    const p = body.children[0];
    if (p?.type !== "element") throw new Error("p not found");
    const text = p.children[0];
    if (!text || text.type !== "text") throw new Error("text node not found");

    expect(text.segments).toHaveLength(2);
    expect(text.segments[0]).toStrictEqual({ kind: "literal", value: "Hello " });
    expect(text.segments[1]).toMatchObject({ kind: "interpolation", path: "user.name", dataType: "string" });
  });
});
