import { describe, expect, it } from "vitest";
import { buildCells, cellNav, DEFAULT_PALETTE, text, type Font, type Item, type Spec } from "../src";
import { specFromAttributes } from "../src/attributes";

const font = {
  getPath: () => ({
    commands: [
      { type: "M", x: 0, y: 0 },
      { type: "L", x: 20, y: 0 },
      { type: "L", x: 20, y: 10 },
      { type: "L", x: 0, y: 10 },
      { type: "Z" },
    ],
  }),
} as unknown as Font;

const items = (withImages = false): Item[] =>
  ["A", "B", "C", "D"].map((l, i) => ({
    id: l,
    label: l,
    href: "#",
    ...(withImages && i < 2 && { image: `/${l}.jpg`, aspect: 1.5 }),
  }));
const spec = (fill: Spec["fill"], withImages = false, extra: Partial<Spec> = {}): Spec => ({
  items: items(withImages),
  width: 1000,
  height: 400,
  layout: { type: "voronoi", rngSeed: 3 },
  fill,
  ...extra,
});

describe("cells with no background", () => {
  it("are coloured cells by default", () => {
    expect(buildCells(spec({ type: "text" }), font).every((c) => !c.flat)).toBe(true);
    expect(buildCells(spec(undefined), font).every((c) => !c.flat)).toBe(true);
  });

  it("are flat when asked, and keep their colour for the text", () => {
    const cells = buildCells(spec({ type: "text", background: "none" }), font);
    expect(cells.every((c) => c.flat)).toBe(true);
    expect(cells.map((c) => c.color)).toEqual(DEFAULT_PALETTE.slice(0, 4));
  });

  it("take their colours from a palette", () => {
    const cells = buildCells(spec({ type: "text", background: "none" }, false, { palette: ["#111", "#eee"] }), font);
    expect(cells.map((c) => c.color)).toEqual(["#111", "#eee", "#111", "#eee"]);
  });

  it("have the same shapes and text as the coloured version", () => {
    const flat = buildCells(spec({ type: "text", background: "none" }), font);
    const full = buildCells(spec({ type: "text", background: "cell" }), font);
    expect(flat.map((c) => c.shape)).toEqual(full.map((c) => c.shape));
    expect(flat.map((c) => c.label)).toEqual(full.map((c) => c.label));
  });

  it("leave picture cells alone, since the picture is their fill", () => {
    const cells = buildCells(spec({ type: "image", background: "none" }, true), font);
    expect(cells.map((c) => c.flat)).toEqual([false, false, true, true]); // the two without a picture have no background
    expect(cells[0]!.image).toBe("/A.jpg");
  });
});

describe("background in the tag and builder", () => {
  const read = (a: Record<string, string | null>) => specFromAttributes({ items: "A,B", ...a }, []).fill;

  it("reads none and cell, in any case", () => {
    expect(read({ background: "none" })).toEqual({ type: "text", background: "none" });
    expect(read({ background: " None " })).toEqual({ type: "text", background: "none" });
    expect(read({ background: "cell" })).toEqual({ type: "text", background: "cell" });
  });

  it("ignores anything else", () => {
    expect(read({ background: "red" })).toEqual({ type: "text" });
    expect(read({ background: "" })).toEqual({ type: "text" });
    expect(read({})).toEqual({ type: "text" });
  });

  it("is set by the builder", () => {
    expect(cellNav(["A"]).fill(text({ background: "none" })).spec().fill).toEqual({ type: "text", background: "none" });
  });
});
