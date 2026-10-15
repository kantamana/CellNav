import { describe, expect, it } from "vitest";
import {
  area,
  buildCells,
  resolveBoundary,
  solidity,
  voronoiLayout,
  type Font,
  type Polygon,
} from "../src";
import { contains, isConvexPolygon, offset, overlapArea } from "../src/clip";
import { bend, glyphCorners, NO_EXTRA_POINTS } from "./helpers";

const W = 1000;
const H = 400;

const SHAPES: Record<string, string> = {
  star: "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z",
  L: "M0 0 L40 0 L40 60 L100 60 L100 100 L0 100 Z",
  U: "M0 0 L30 0 L30 70 L70 70 L70 0 L100 0 L100 100 L0 100 Z",
  heart: "M50 30 C50 0 0 0 0 35 C0 65 50 85 50 100 C50 85 100 65 100 35 C100 0 50 0 50 30 Z",
  crescent: "M50 0 Q0 50 50 100 Q25 50 50 0 Z",
  arrow: "M0 30 L60 30 L60 0 L100 50 L60 100 L60 70 L0 70 Z",
};

const names = Object.keys(SHAPES);
const seeds = [1, 2, 3, 4, 5, 6];

// A boundary is a region the cells have to fit; every point of a cell must be in it.
// Points on an edge or at a corner count as inside; the even-odd test alone is
// strict about those, so also accept anything within 0.1 of the outline.
const edgeDistance = (poly: Polygon, p: { x: number; y: number }) =>
  Math.min(
    ...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }),
  );
const insideRegion = (region: Polygon, p: { x: number; y: number }) =>
  contains(region, p) || edgeDistance(region, p) < 0.1;

describe.each(names)("layout inside a concave %s", (name) => {
  const region = resolveBoundary(SHAPES[name], W, H);
  const regionArea = Math.abs(area(region));

  it.each(seeds)("cells tile the shape with no overlap (seed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(3 + (rngSeed % 5), W, H, { rngSeed }, region);
    const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
    expect(total).toBeGreaterThan(regionArea * 0.97);
    expect(total).toBeLessThan(regionArea * 1.01);
  });

  it.each(seeds)("every cell lies inside the shape and holds its seed (seed %i)", (rngSeed) => {
    const { cells, seeds: s } = voronoiLayout(
      3 + (rngSeed % 5),
      W,
      H,
      { rngSeed, organic: rngSeed % 2 === 0 },
      region,
    );
    cells.forEach((c, i) => {
      expect(c.length).toBeGreaterThanOrEqual(3);
      for (const p of c) expect(insideRegion(region, p)).toBe(true);
      expect(contains(region, s[i]!)).toBe(true);
    });
  });

  it("is deterministic", () => {
    const a = voronoiLayout(6, W, H, { rngSeed: 3 }, region);
    const b = voronoiLayout(6, W, H, { rngSeed: 3 }, region);
    expect(a.cells).toEqual(b.cells);
  });

  it("cells never overlap each other", () => {
    const { cells } = voronoiLayout(6, W, H, { rngSeed: 2 }, region);
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++)
        expect(overlapArea(cells[i]!, cells[j]!)).toBeLessThan(regionArea * 0.002);
  });
});

describe("text in concave shapes", () => {
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

  const labels = ["A", "B", "C", "D", "E", "F", "G"];

  describe.each(names)("%s", (name) => {
    const region = resolveBoundary(SHAPES[name], W, H);
    it.each(seeds)("all text stays inside its own cell (seed %i)", (rngSeed) => {
      const n = 3 + (rngSeed % 5);
      const cells = buildCells(
        {
          items: labels.slice(0, n).map((l) => ({ id: l, label: l, href: "#" })),
          width: W,
          height: H,
          boundary: SHAPES[name],
          layout: { type: "voronoi", rngSeed },
        },
        font,
      );
      for (const c of cells) {
        for (const contour of c.label)
          for (const p of contour) {
            expect(insideRegion(region, p)).toBe(true);
            expect(insideRegion(c.shape, p)).toBe(true);
          }
      }
    });
  });

  // Which cells follow their own outline (mildly dented) and which use the biggest convex part.
  const built = (name: string, rngSeed: number, warp: number) => {
    const spec = {
      items: labels.slice(0, 6).map((l) => ({ id: l, label: l, href: "#" })),
      width: W,
      height: H,
      boundary: SHAPES[name],
      layout: { type: "voronoi" as const, rngSeed },
      fill: { type: "text" as const, warp, detail: NO_EXTRA_POINTS },
    };
    return buildCells(spec, font);
  };

  it("a mildly dented cell warps onto its own outline: warp makes no difference", () => {
    let checked = 0;
    for (const name of names) {
      for (const rngSeed of seeds) {
        const full = built(name, rngSeed, 1);
        const upright = built(name, rngSeed, 0);
        full.forEach((c, i) => {
          if (isConvexPolygon(c.shape) || solidity(c.shape) < 0.85) return;
          // The text sits in the cell pulled in by its padding (10); if that smooths the
          // dents away the shape is convex again and warp applies as usual.
          const inner = offset(c.shape, 10);
          if (!inner || isConvexPolygon(inner, 0.5)) return;
          checked++;
          expect(upright[i]!.label).toEqual(c.label);
        });
      }
    }
    expect(checked).toBeGreaterThan(5);
  }, 60000);

  it("a deeply dented cell puts the word in its biggest convex part, where warp still works", () => {
    let checked = 0;
    for (const name of names) {
      for (const rngSeed of seeds) {
        const full = built(name, rngSeed, 1);
        const upright = built(name, rngSeed, 0);
        full.forEach((c, i) => {
          if (solidity(c.shape) >= 0.85) return;
          checked++;
          // warp 0 is a plain rectangle: no bend at all.
          expect(bend(glyphCorners(font, labels[i]!.toUpperCase(), upright[i]!.label))).toBeLessThan(1e-3);
        });
      }
    }
    expect(checked).toBeGreaterThan(5);
  }, 60000);
});
