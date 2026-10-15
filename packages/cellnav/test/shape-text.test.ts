import { describe, expect, it } from "vitest";
import {
  area,
  BOUNDARY_PRESETS,
  buildCells,
  resolveBoundary,
  textInShape,
  type Font,
} from "../src";
import { glyphCorners, insideRegion, NO_EXTRA_POINTS } from "./helpers";

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

describe("text in a shape: the Spec", () => {
  it("is one item with the word as its label", () => {
    const s = textInShape("Love", "heart").spec();
    expect(s.items).toEqual([{ id: "love", label: "Love", href: "#" }]);
    expect(s.boundary).toBe("heart");
  });

  it("has defaults that suit a single shape", () => {
    const s = textInShape("SUN", "circle").spec();
    expect(s).toMatchObject({ width: 600, height: 600, margin: 0 });
    expect(s.fill).toEqual({ type: "text", padding: 6 });
  });

  it("takes its size, link and fill options", () => {
    const s = textInShape("GO", "arrow", { width: 800, height: 300, href: "/go", padding: 2, warp: 0.5 }).spec();
    expect(s).toMatchObject({ width: 800, height: 300 });
    expect(s.items[0]!.href).toBe("/go");
    expect(s.fill).toEqual({ type: "text", padding: 2, warp: 0.5 });
  });

  it("can have a colour, no background, and an outline", () => {
    const s = textInShape("X", "star", { color: "#ff006e", background: "none", stroke: "#fff" }).spec();
    expect(s.palette).toEqual(["#ff006e"]);
    expect(s.fill).toMatchObject({ background: "none" });
    expect(s.boundaryStroke).toBe("#fff");
  });

  it("works with an SVG path as the shape", () => {
    expect(textInShape("A", "M0 0 L10 0 L5 10 Z").spec().boundary).toBe("M0 0 L10 0 L5 10 Z");
  });

  it("gives a usable id even for a label with no letters", () => {
    expect(textInShape("!!!", "star").spec().items[0]!.id).toBe("item");
    expect(textInShape("  Hello, World! ", "star").spec().items[0]!.id).toBe("hello-world");
  });

  it("is only data: it round-trips as JSON", () => {
    const spec = textInShape("Love", "heart", { color: "#f00" }).spec();
    expect(JSON.parse(JSON.stringify(spec))).toEqual(spec);
  });
});

describe.each(BOUNDARY_PRESETS)("text in a %s", (shape) => {
  const spec = textInShape("LOVE", shape).spec();
  const region = resolveBoundary(shape, 600, 600);

  it("makes one cell that fills the whole shape", () => {
    const cells = buildCells(spec, font);
    expect(cells).toHaveLength(1);
    expect(Math.abs(area(cells[0]!.shape))).toBeGreaterThan(Math.abs(area(region)) * 0.97);
    expect(Math.abs(area(cells[0]!.shape))).toBeLessThan(Math.abs(area(region)) * 1.01);
  });

  it("keeps every letter inside the shape", () => {
    for (const word of ["A", "LOVE", "HELLO", "ALPHABET"]) {
      const cell = buildCells(textInShape(word, shape).spec(), font)[0]!;
      for (const contour of cell.label)
        for (const p of contour) expect(insideRegion(region, p)).toBe(true);
    }
  });
});

describe("text in a round shape reads horizontally", () => {
  it.each(["circle", "ellipse", "pentagon", "star", "hexagon", "triangle"])("%s", (shape) => {
    const cell = buildCells(textInShape("A", shape, { detail: NO_EXTRA_POINTS }).spec(), font)[0]!;
    // The baseline (bottom edge) of the word runs left to right and not steeply up or down.
    const [, , br, bl] = glyphCorners(font, "A", cell.label);
    expect(br.x - bl.x).toBeGreaterThan(0);
    expect(Math.abs(br.y - bl.y)).toBeLessThan(br.x - bl.x);
  });
});
