import { describe, expect, it } from "vitest";
import {
  area,
  BOUNDARY_PRESETS,
  bounds,
  buildCells,
  cellNav,
  isConvex,
  isSimple,
  parsePath,
  SHAPE_PATHS,
  resolveBoundary,
  voronoiLayout,
  type Font,
} from "../src";
import { specFromAttributes } from "../src/attributes";
import { edgeDistance, insideRegion } from "./helpers";

const W = 1000;
const H = 400;

describe("boundary presets", () => {
  it.each(BOUNDARY_PRESETS)("%s is a simple outline with an area, inside the box", (name) => {
    const poly = resolveBoundary(name, W, H);
    expect(isSimple(poly)).toBe(true);
    expect(Math.abs(area(poly))).toBeGreaterThan(W * H * 0.1);
    for (const p of poly) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(W + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeLessThanOrEqual(H + 1e-6);
    }
  });

  it.each(BOUNDARY_PRESETS)("%s fills its box from edge to edge (except the round ones)", (name) => {
    if (name === "circle") return; // as wide as the box is tall
    const b = bounds(resolveBoundary(name, W, H));
    expect(b.width).toBeCloseTo(W, 0);
    expect(b.height).toBeCloseTo(H, 0);
  });

  it("the plain, round and polygon presets are convex; the dented ones are not", () => {
    const convex = ["rectangle", "rounded", "ellipse", "circle", "hexagon", "diamond", "triangle", "pentagon"];
    const dented = ["star", "heart", "cross", "arrow"];
    for (const n of convex) expect(isConvex(resolveBoundary(n, W, H)), n).toBe(true);
    for (const n of dented) expect(isConvex(resolveBoundary(n, W, H)), n).toBe(false);
  });

  it("includes the shapes to put text in", () => {
    for (const n of ["triangle", "pentagon", "star", "heart", "cross", "arrow", "drop"])
      expect(BOUNDARY_PRESETS).toContain(n);
  });

  it("no boundary means the whole box", () => {
    expect(Math.abs(area(resolveBoundary(undefined, W, H)))).toBeCloseTo(W * H, 6);
  });

  it("a circle is round even in a wide box", () => {
    const b = bounds(resolveBoundary("circle", W, H));
    expect(b.width).toBeCloseTo(b.height, 6);
    expect(b.height).toBeCloseTo(H, 6);
  });
});

describe.each(BOUNDARY_PRESETS)("layout inside a %s", (name) => {
  const poly = resolveBoundary(name, W, H);
  const range = [1, 2, 3, 4, 5, 6, 7, 8];

  it.each(range)("cells tile the boundary (seed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(1 + (rngSeed % 6), W, H, { rngSeed }, poly);
    const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
    // A dented shape can leave a sliver unowned, so allow a little.
    expect(total).toBeGreaterThan(Math.abs(area(poly)) * 0.98);
    expect(total).toBeLessThan(Math.abs(area(poly)) * 1.005);
  });

  it.each(range)("every cell and seed lies inside it (seed %i)", (rngSeed) => {
    const { cells, seeds } = voronoiLayout(
      1 + (rngSeed % 6),
      W,
      H,
      { rngSeed, organic: rngSeed % 2 === 0 },
      poly,
    );
    for (const c of cells) for (const p of c) expect(insideRegion(poly, p)).toBe(true);
    for (const s of seeds) expect(insideRegion(poly, s)).toBe(true);
  });
});

describe("boundary as an SVG path", () => {
  it("fits a triangle to the box", () => {
    const poly = resolveBoundary("M0 0 L100 0 L50 100 Z", W, H);
    expect(poly).toHaveLength(3);
    const b = bounds(poly);
    expect([b.minX, b.minY, b.width, b.height]).toEqual([0, 0, W, H]);
  });

  it("reads relative commands, H and V", () => {
    expect(parsePath("m0 0 l100 0 l-50 100 z")).toEqual(parsePath("M0 0 L100 0 L50 100 Z"));
    expect(parsePath("M0 0 H10 V10 H0 Z")).toHaveLength(4);
  });

  it("flattens curves and accepts a convex one", () => {
    const poly = resolveBoundary("M0 50 Q50 -50 100 50 Z", W, H);
    expect(poly.length).toBeGreaterThan(8);
  });

  it("accepts a concave shape", () => {
    const star = "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z";
    const poly = resolveBoundary(star, W, H);
    expect(isConvex(poly)).toBe(false);
    expect(isSimple(poly)).toBe(true);
  });

  it("rejects an outline that crosses itself", () => {
    expect(() => resolveBoundary("M0 0 L100 100 L100 0 L0 100 Z", W, H)).toThrow(/crosses itself/);
  });

  it("rejects unsupported commands and unknown names", () => {
    expect(() => resolveBoundary("M0 0 A5 5 0 0 1 10 10 Z", W, H)).toThrow(/isn't supported/);
    expect(() => resolveBoundary("blob", W, H)).toThrow(/Unknown boundary/);
  });

  it("lays out cells inside a path boundary", () => {
    const poly = resolveBoundary("M10 0 L100 20 L80 100 L0 70 Z", W, H);
    const { cells } = voronoiLayout(5, W, H, { rngSeed: 3 }, poly);
    const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
    expect(total).toBeCloseTo(Math.abs(area(poly)), 2);
  });
});

describe("boundary and text", () => {
  const font = {
    getPath: () => ({
      commands: [
        { type: "M", x: 0, y: 0 },
        { type: "L", x: 10, y: 0 },
        { type: "L", x: 10, y: 10 },
        { type: "L", x: 0, y: 10 },
        { type: "Z" },
      ],
    }),
  } as unknown as Font;

  it.each(["ellipse", "hexagon", "diamond"])("keeps all text inside a %s", (boundary) => {
    const poly = resolveBoundary(boundary, W, H);
    const cells = buildCells(
      {
        items: ["A", "B", "C", "D", "E"].map((l) => ({ id: l, label: l, href: "#" })),
        width: W,
        height: H,
        boundary,
        layout: { type: "voronoi", rngSeed: 2 },
      },
      font,
    );
    for (const c of cells)
      for (const contour of c.label)
        for (const p of contour) expect(insideRegion(poly, p)).toBe(true);
  });
});

describe("boundary in the Spec", () => {
  it("is set by the builder", () => {
    const s = cellNav(["A"]).boundary("hexagon").boundaryStroke("#000").spec();
    expect(s).toMatchObject({ boundary: "hexagon", boundaryStroke: "#000" });
  });

  it("is read from tag attributes", () => {
    const s = specFromAttributes(
      { items: "A", boundary: " ellipse ", boundaryStroke: "#222" },
      [],
    );
    expect(s).toMatchObject({ boundary: "ellipse", boundaryStroke: "#222" });
  });
});

describe("curves in a boundary are flattened for the size they are drawn at", () => {
  // Worst distance from the flattened outline to the true bezier curves of the heart, in px.
  const bez = (p0: number[], c1: number[], c2: number[], p1: number[], n = 3000) =>
    Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      const m = 1 - t;
      return {
        x: m ** 3 * p0[0]! + 3 * m * m * t * c1[0]! + 3 * m * t * t * c2[0]! + t ** 3 * p1[0]!,
        y: m ** 3 * p0[1]! + 3 * m * m * t * c1[1]! + 3 * m * t * t * c2[1]! + t ** 3 * p1[1]!,
      };
    });
  const heartCurves = [
    ...bez([50, 30], [46, 0], [0, 0], [0, 35]),
    ...bez([0, 35], [0, 65], [50, 85], [50, 100]),
    ...bez([50, 100], [50, 85], [100, 65], [100, 35]),
    ...bez([100, 35], [100, 0], [54, 0], [50, 30]),
  ];
  // The shape is stretched to fill its box edge to edge, so map the true curves the same way.
  const extent = {
    minX: Math.min(...heartCurves.map((p) => p.x)),
    maxX: Math.max(...heartCurves.map((p) => p.x)),
    minY: Math.min(...heartCurves.map((p) => p.y)),
    maxY: Math.max(...heartCurves.map((p) => p.y)),
  };
  const worstGap = (size: number) => {
    const poly = resolveBoundary("heart", size, size);
    return Math.max(
      ...heartCurves.map((p) =>
        edgeDistance(poly, {
          x: ((p.x - extent.minX) / (extent.maxX - extent.minX)) * size,
          y: ((p.y - extent.minY) / (extent.maxY - extent.minY)) * size,
        }),
      ),
    );
  };
  const longest = (size: number) => {
    const poly = resolveBoundary("heart", size, size);
    return Math.max(...poly.map((p, i) => Math.hypot(poly[(i + 1) % poly.length]!.x - p.x, poly[(i + 1) % poly.length]!.y - p.y)));
  };

  it("stay within a small fraction of a pixel of the true curve at any size", () => {
    for (const size of [200, 600, 1200]) expect(worstGap(size)).toBeLessThan(0.25);
  });

  it("have no long straight pieces, however big the shape", () => {
    // the straight-ish stretches of the heart's body may be long, but curves are cut to ~3px
    for (const size of [600, 1200]) {
      const poly = resolveBoundary("heart", size, size);
      const curvedEdges = poly.filter((p, i) => Math.hypot(poly[(i + 1) % poly.length]!.x - p.x, poly[(i + 1) % poly.length]!.y - p.y) > 6);
      expect(curvedEdges.length).toBe(0);
    }
    expect(longest(1200)).toBeLessThanOrEqual(6);
  });

  it("use more points for a bigger shape, never fewer than before", () => {
    const n = (s: number) => resolveBoundary("heart", s, s).length;
    expect(n(1200)).toBeGreaterThan(n(300));
    expect(n(20)).toBeGreaterThanOrEqual(48); // at least the old 12 per curve
  });

  it("a path given without a scale keeps the old 12 steps per curve", () => {
    expect(parsePath(SHAPE_PATHS.heart)).toHaveLength(48);
  });

  it("works for a user's own curved path too", () => {
    const d = "M0 100 C0 0 100 0 100 100 Z";
    const poly = resolveBoundary(d, 800, 400);
    expect(poly.length).toBeGreaterThan(100);
    expect(isSimple(poly)).toBe(true);
  });
});
