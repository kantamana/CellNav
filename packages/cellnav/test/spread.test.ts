import opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import {
  area,
  bounds,
  buildCells,
  cellNav,
  convexPieces,
  resolveBoundary,
  text,
  textInShape,
  type Font,
} from "../src";
import { specFromAttributes } from "../src/attributes";
import { isConvexPolygon, overlapArea } from "../src/clip";
import antonUrl from "../src/assets/Anton-Regular.ttf?inline";
import { deepestDent, insideRegion } from "./helpers";

const bytes = Uint8Array.from(atob(antonUrl.slice(antonUrl.indexOf("base64,") + 7)), (c) => c.charCodeAt(0));
const anton = opentype.parse(bytes.buffer) as Font;

// A font whose one glyph is a square, that also records every piece of text it is asked to draw.
const recording = () => {
  const asked: string[] = [];
  const font = {
    getPath: (t: string) => {
      asked.push(t);
      return {
        commands: [
          { type: "M", x: 0, y: 0 },
          { type: "L", x: 20, y: 0 },
          { type: "L", x: 20, y: 10 },
          { type: "L", x: 0, y: 10 },
          { type: "Z" },
        ],
      };
    },
  } as unknown as Font;
  return { font, asked };
};

const DENTED = ["cross", "star", "arrow", "heart"];

describe("convex pieces of a dented shape", () => {
  it("a convex polygon comes back as one piece", () => {
    const sq = resolveBoundary("pentagon", 600, 600);
    expect(convexPieces(sq)).toEqual([sq]);
  });

  it("the cross, the star and the heart are covered by several pieces", () => {
    for (const name of ["cross", "star", "heart"])
      expect(convexPieces(resolveBoundary(name, 600, 600)).length, name).toBeGreaterThan(1);
  });

  it("the arrow's biggest convex part is already most of it, so it stays one piece", () => {
    const arrow = resolveBoundary("arrow", 600, 600);
    const pieces = convexPieces(arrow);
    expect(pieces).toHaveLength(1);
    expect(Math.abs(area(pieces[0]!))).toBeGreaterThan(Math.abs(area(arrow)) * 0.75);
  });

  it.each(DENTED)("pieces of the %s are convex, inside it and do not overlap", (name) => {
    const region = resolveBoundary(name, 600, 600);
    const pieces = convexPieces(region, 6);
    expect(pieces.length).toBeGreaterThan(0);
    for (const p of pieces) {
      expect(deepestDent(p)).toBeLessThan(0.5);
      for (const q of p) expect(insideRegion(region, q)).toBe(true);
    }
    for (let i = 0; i < pieces.length; i++)
      for (let j = i + 1; j < pieces.length; j++)
        expect(overlapArea(pieces[i]!, pieces[j]!)).toBeLessThan(Math.abs(area(region)) * 0.01);
  });

  it("together cover more of the shape than the biggest piece alone", () => {
    for (const name of ["cross", "star", "heart"]) {
      const region = resolveBoundary(name, 600, 600);
      const pieces = convexPieces(region, 6);
      const covered = pieces.reduce((s, p) => s + Math.abs(area(p)), 0);
      expect(covered, name).toBeGreaterThan(Math.max(...pieces.map((p) => Math.abs(area(p)))) * 1.1);
    }
    // the cross goes from about 60% of its area to over 90%
    const cross = resolveBoundary("cross", 600, 600);
    const covered = convexPieces(cross, 6).reduce((s, p) => s + Math.abs(area(p)), 0);
    expect(covered / Math.abs(area(cross))).toBeGreaterThan(0.9);
  });

  it("never uses more pieces than asked", () => {
    for (const max of [1, 2, 3]) expect(convexPieces(resolveBoundary("star", 600, 600), max).length).toBeLessThanOrEqual(max);
  });
});

describe("spreading a word over a dented shape", () => {
  const build = (word: string, shape: string, flow?: "outline" | "spread", font: Font = anton) =>
    buildCells(textInShape(word, shape, flow ? { flow } : {}).spec(), font)[0]!;

  // The amount of ink: outlines are wound one way for letters and the other for their holes.
  const ink = (c: { label: { x: number; y: number }[][] }) =>
    Math.abs(c.label.reduce((total, contour) => total + signedArea(contour), 0));
  const signedArea = (pts: { x: number; y: number }[]) => {
    let sum = 0;
    pts.forEach((a, i) => {
      const b = pts[(i + 1) % pts.length]!;
      sum += a.x * b.y - b.x * a.y;
    });
    return sum / 2;
  };

  it("fills the plus sign much better than the default does", () => {
    expect(ink(build("PLUS", "cross", "spread"))).toBeGreaterThan(ink(build("PLUS", "cross")) * 1.3);
  });

  it("fills the star a little better", () => {
    expect(ink(build("STAR", "star", "spread"))).toBeGreaterThan(ink(build("STAR", "star")) * 1.05);
  });

  it("changes nothing for the arrow, whose one big convex part is already most of it", () => {
    expect(build("NEXT", "arrow", "spread").label).toEqual(build("NEXT", "arrow").label);
  });

  it("breaks the word into one chunk per piece", () => {
    const { font, asked } = recording();
    buildCells(textInShape("PLUS", "cross", { flow: "spread" }).spec(), font);
    const chunks = asked.filter((t) => t.length < 4);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.join("")).toBe("PLUS");
  });

  it("without the option the word stays whole", () => {
    const { font, asked } = recording();
    buildCells(textInShape("PLUS", "cross").spec(), font);
    expect(asked).toEqual(["PLUS"]);
  });

  it("breaks between words when a shape has two pieces", () => {
    const { font, asked } = recording();
    buildCells(textInShape("HELLO WORLD", "heart", { flow: "spread" }).spec(), font);
    expect(asked.map((t) => t.trim())).toEqual(["HELLO", "WORLD"]);
  });

  it("keeps all the letters whatever the number of pieces", () => {
    for (const shape of ["cross", "star", "heart", "arrow"]) {
      const { font, asked } = recording();
      buildCells(textInShape("HELLO WORLD", shape, { flow: "spread" }).spec(), font);
      expect(asked.join("").replace(/\s/g, ""), shape).toBe("HELLOWORLD");
    }
  });

  it.each(DENTED)("keeps every letter of the %s inside the shape", (shape) => {
    const region = resolveBoundary(shape, 600, 600);
    for (const word of ["PLUS", "HELLO WORLD", "A"]) {
      const cell = build(word, shape, "spread");
      for (const contour of cell.label) for (const p of contour) expect(insideRegion(region, p, 0.25)).toBe(true);
    }
  });

  it("makes no difference to a shape without dents", () => {
    for (const shape of ["circle", "pentagon", "rounded", "triangle"]) {
      const a = build("HOME", shape, "spread");
      const b = build("HOME", shape);
      expect(a.label).toEqual(b.label);
    }
  });

  it("a one-letter word uses just one piece", () => {
    const { font, asked } = recording();
    buildCells(textInShape("X", "cross", { flow: "spread" }).spec(), font);
    expect(asked).toEqual(["X"]);
  });

  it("is quick enough", () => {
    const t0 = performance.now();
    build("HELLO WORLD", "star", "spread");
    build("PLUS", "cross", "spread");
    expect(performance.now() - t0).toBeLessThan(3000);
  });

  it("works in a navbar cell with dents too", () => {
    const spec = cellNav(["Home", "About", "Projects", "Blog", "Contact"])
      .size(1000, 400)
      .boundary("star")
      .layout({ type: "voronoi", rngSeed: 3 })
      .fill(text({ flow: "spread" }))
      .spec();
    const cells = buildCells(spec, anton);
    expect(cells).toHaveLength(5);
    for (const c of cells) expect(c.label.flat().length).toBeGreaterThan(0);
  });
});

describe("text-flow in the tag and builder", () => {
  const read = (v: string | null) => specFromAttributes({ items: "A", textFlow: v }, []).fill;

  it("reads spread and outline, in any case", () => {
    expect(read("spread")).toEqual({ type: "text", flow: "spread" });
    expect(read(" Spread ")).toEqual({ type: "text", flow: "spread" });
    expect(read("outline")).toEqual({ type: "text", flow: "outline" });
  });
  it("ignores anything else", () => {
    for (const v of ["lines", "", null]) expect(read(v)).toEqual({ type: "text" });
  });
  it("is set by the builder and by textInShape", () => {
    expect(cellNav(["A"]).fill(text({ flow: "spread" })).spec().fill).toEqual({ type: "text", flow: "spread" });
    expect(textInShape("A", "star", { flow: "spread" }).spec().fill).toMatchObject({ flow: "spread" });
  });
});
