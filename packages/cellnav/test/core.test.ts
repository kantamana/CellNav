import { describe, expect, it } from "vitest";
import {
  area,
  bounds,
  cageWarp,
  frameOf,
  longestAxisAngle,
  orientedCage,
  pointInConvex,
  voronoiLayout,
} from "../src";

const W = 1000;
const H = 400;
const seeds = Array.from({ length: 40 }, (_, i) => i + 1);

describe("voronoi layout", () => {
  it("is deterministic for a given rngSeed", () => {
    const a = voronoiLayout(7, W, H, { rngSeed: 3 });
    const b = voronoiLayout(7, W, H, { rngSeed: 3 });
    expect(a.cells).toEqual(b.cells);
  });

  it.each(seeds)("cells tile the box exactly (rngSeed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(3 + (rngSeed % 8), W, H, { rngSeed });
    const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
    expect(total).toBeCloseTo(W * H, 3);
  });

  it("each seed lies inside its own cell", () => {
    const { cells, seeds: s } = voronoiLayout(9, W, H, { rngSeed: 5 });
    s.forEach((p, i) => expect(pointInConvex(p, cells[i]!)).toBe(true));
  });

  it("stretch makes cells wider than tall", () => {
    const { cells } = voronoiLayout(8, W, H, { stretch: 2.5, rngSeed: 2 });
    const ratio =
      cells.reduce((s, c) => s + bounds(c).width / bounds(c).height, 0) /
      cells.length;
    const flat = voronoiLayout(8, W, H, { stretch: 1, rngSeed: 2 });
    const flatRatio =
      flat.cells.reduce((s, c) => s + bounds(c).width / bounds(c).height, 0) /
      flat.cells.length;
    expect(ratio).toBeGreaterThan(flatRatio * 1.5);
  });
});

describe("longest axis and orientation", () => {
  it("finds the axis of a rotated rectangle", () => {
    const t = 0.5;
    const rect = [
      [-100, -20],
      [100, -20],
      [100, 20],
      [-100, 20],
    ].map(([x, y]) => ({
      x: x! * Math.cos(t) - y! * Math.sin(t) + 300,
      y: x! * Math.sin(t) + y! * Math.cos(t) + 200,
    }));
    expect(longestAxisAngle(rect)).toBeCloseTo(t, 5);
  });

  it.each(seeds)("text is never upside down or mirrored (rngSeed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(3 + (rngSeed % 8), W, H, { rngSeed });
    for (const cell of cells) {
      const frame = frameOf(cell);
      expect(frame.across.x).toBeGreaterThanOrEqual(0);
      expect(frame.down.y).toBeGreaterThanOrEqual(0);

      const { source, target } = orientedCage(cell, frame);
      const warp = cageWarp(source, target);
      const left = warp({ x: 0.1, y: 0.5 });
      const right = warp({ x: 0.9, y: 0.5 });
      const top = warp({ x: 0.5, y: 0.1 });
      const bottom = warp({ x: 0.5, y: 0.9 });
      // Reading direction points right, and "down" points down.
      expect(right.x).toBeGreaterThan(left.x);
      expect(bottom.y).toBeGreaterThan(top.y);
    }
  });

  it.each(seeds)("warped text stays inside its cell (rngSeed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(3 + (rngSeed % 8), W, H, { rngSeed });
    for (const cell of cells) {
      const { source, target } = orientedCage(cell, frameOf(cell));
      const warp = cageWarp(source, target);
      for (let u = 0; u <= 1; u += 0.1)
        for (let v = 0; v <= 1; v += 0.1)
          expect(pointInConvex(warp({ x: u, y: v }), cell, 1e-3)).toBe(true);
    }
  });
});

import { buildCells, inscribedRect, type Font } from "../src";
import { bend, glyphCorners, NO_EXTRA_POINTS } from "./helpers";

describe("inscribed rectangle", () => {
  it.each(seeds)("fits inside its cell and reads rightwards (rngSeed %i)", (rngSeed) => {
    const { cells } = voronoiLayout(3 + (rngSeed % 8), W, H, { rngSeed });
    for (const cell of cells) {
      const [tl, tr, br, bl] = inscribedRect(cell, frameOf(cell));
      for (const p of [tl, tr, br, bl])
        expect(pointInConvex(p, cell, 1e-3)).toBe(true);
      expect(tr.x).toBeGreaterThanOrEqual(tl.x);
      expect(bl.y).toBeGreaterThanOrEqual(tl.y);
      expect(Math.abs(area([tl, tr, br, bl]))).toBeGreaterThan(0);
    }
  });
});

describe("warp strength", () => {
  // A stub font: one square glyph is enough to exercise the placement maths.
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

  const base = {
    items: ["A", "B", "C", "D", "E"].map((l) => ({ id: l, label: l, href: "#" })),
    width: 1000,
    height: 400,
    layout: { type: "voronoi" as const, rngSeed: 9 },
  };

  it("warp 0 keeps all text inside every cell and unsheared", () => {
    const cells = buildCells({ ...base, fill: { type: "text", warp: 0, detail: NO_EXTRA_POINTS } }, font);
    for (const c of cells) {
      for (const contour of c.label)
        for (const p of contour) expect(pointInConvex(p, c.shape, 1e-3)).toBe(true);
      // warp 0 is a plain rectangle: the glyph's top edge equals its bottom edge.
      expect(bend(glyphCorners(font, "ABCDE"[cells.indexOf(c)]!, c.label))).toBeLessThan(1e-3);
    }
  });

  it("warp 1 and the default are the same", () => {
    const a = buildCells({ ...base, fill: { type: "text", warp: 1 } }, font);
    const b = buildCells({ ...base, fill: { type: "text" } }, font);
    expect(a.map((c) => c.label)).toEqual(b.map((c) => c.label));
  });
});

describe("padding", () => {
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
  const base = {
    items: ["A", "B", "C", "D", "E", "F"].map((l) => ({ id: l, label: l, href: "#" })),
    width: 1000,
    height: 400,
    margin: 0,
    layout: { type: "voronoi" as const, rngSeed: 5 },
  };

  // Smallest distance from a point to any edge of a polygon.
  const edgeDistance = (p: { x: number; y: number }, poly: { x: number; y: number }[]) =>
    Math.min(
      ...poly.map((a, i) => {
        const b = poly[(i + 1) % poly.length]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
      }),
    );

  it.each([1, 0])("with warp %i, text keeps clear of the cell walls by default", (warp) => {
    const cells = buildCells({ ...base, fill: { type: "text", warp } }, font);
    for (const c of cells)
      for (const contour of c.label)
        for (const p of contour) expect(edgeDistance(p, c.shape)).toBeGreaterThan(1);
  });

  it("padding 0 lets the text reach the walls", () => {
    const cells = buildCells({ ...base, fill: { type: "text", padding: 0 } }, font);
    const nearest = Math.min(
      ...cells.flatMap((c) => c.label.flat().map((p) => edgeDistance(p, c.shape))),
    );
    expect(nearest).toBeLessThan(0.5);
  });

  it("more padding keeps the text further from the walls", () => {
    const gap = (padding: number) =>
      Math.min(
        ...buildCells({ ...base, fill: { type: "text", padding } }, font).flatMap((c) =>
          c.label.flat().map((p) => edgeDistance(p, c.shape)),
        ),
      );
    expect(gap(20)).toBeGreaterThan(gap(5));
  });
});

describe("random layout", () => {
  it('rngSeed "random" gives a different layout on each call', () => {
    const a = voronoiLayout(6, W, H, { rngSeed: "random" });
    const b = voronoiLayout(6, W, H, { rngSeed: "random" });
    expect(a.cells).not.toEqual(b.cells);
  });

  it('seed="random" is read from the tag attribute', async () => {
    const { specFromAttributes } = await import("../src/attributes");
    const s = specFromAttributes({ items: "A,B", seed: "random" }, []);
    expect(s.layout).toMatchObject({ rngSeed: "random" });
  });
});

describe("organic layout", () => {
  const cv = (areas: number[]) => {
    const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
    const variance = areas.reduce((s, a) => s + (a - mean) ** 2, 0) / areas.length;
    return Math.sqrt(variance) / mean;
  };
  const areasOf = (opts: { organic?: boolean }, rngSeed: number) =>
    voronoiLayout(8, W, H, { rngSeed, ...opts }).cells.map((c) => Math.abs(area(c)));
  const range = Array.from({ length: 30 }, (_, i) => i + 1);

  it("is deterministic and still tiles the box", () => {
    const a = voronoiLayout(8, W, H, { organic: true, rngSeed: 4 });
    const b = voronoiLayout(8, W, H, { organic: true, rngSeed: 4 });
    expect(a.cells).toEqual(b.cells);
    const total = a.cells.reduce((s, c) => s + Math.abs(area(c)), 0);
    expect(total).toBeCloseTo(W * H, 3);
  });

  it("varies cell sizes far more than the even layout", () => {
    const even = range.map((s) => cv(areasOf({}, s)));
    const organic = range.map((s) => cv(areasOf({ organic: true }, s)));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(organic)).toBeGreaterThan(avg(even) * 2);
  });

  it("never produces a sliver cell", () => {
    for (const s of range) {
      const areas = areasOf({ organic: true }, s);
      const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
      expect(Math.min(...areas)).toBeGreaterThan(mean * 0.05);
    }
  });

  it("can still be evened out with relaxation", () => {
    const loose = voronoiLayout(8, W, H, { organic: true, rngSeed: 2 });
    const tidy = voronoiLayout(8, W, H, { organic: true, relaxation: 25, rngSeed: 2 });
    expect(tidy.cells).not.toEqual(loose.cells);
  });

  it("reads organic and relaxation from the tag", async () => {
    const { specFromAttributes } = await import("../src/attributes");
    expect(specFromAttributes({ items: "A", organic: "" }, []).layout).toMatchObject({ organic: true });
    expect(specFromAttributes({ items: "A", organic: "false" }, []).layout).not.toHaveProperty("organic");
    expect(specFromAttributes({ items: "A", relaxation: "3" }, []).layout).toMatchObject({ relaxation: 3 });
  });
});

describe("a shape with no longest direction reads horizontally", () => {
  const rotated = (w: number, h: number, angle: number, cx = 300, cy = 200) =>
    [
      [-w / 2, -h / 2],
      [w / 2, -h / 2],
      [w / 2, h / 2],
      [-w / 2, h / 2],
    ].map(([x, y]) => ({
      x: x! * Math.cos(angle) - y! * Math.sin(angle) + cx,
      y: x! * Math.sin(angle) + y! * Math.cos(angle) + cy,
    }));
  const regular = (sides: number, r = 100, turn = 0) =>
    Array.from({ length: sides }, (_, i) => ({
      x: 300 + r * Math.cos(turn + (2 * Math.PI * i) / sides),
      y: 200 + r * Math.sin(turn + (2 * Math.PI * i) / sides),
    }));

  it.each([3, 4, 5, 6, 8, 72])("a regular %s-gon, however it is turned, gives angle 0", (sides) => {
    for (const turn of [0, 0.3, 0.9, 1.4]) expect(longestAxisAngle(regular(sides, 100, turn))).toBe(0);
  });

  it("a square turned any way gives angle 0", () => {
    for (const a of [0, 0.2, 0.785, 1.2, 2.5]) expect(longestAxisAngle(rotated(100, 100, a))).toBe(0);
  });

  it("a slightly oblong shape still counts as round", () => {
    expect(longestAxisAngle(rotated(120, 100, 0.7))).toBe(0); // 1.2 : 1
  });

  it("a clearly oblong shape keeps its own direction", () => {
    expect(longestAxisAngle(rotated(150, 100, 0.5))).toBeCloseTo(0.5, 6); // 1.5 : 1
    expect(longestAxisAngle(rotated(300, 60, -0.4))).toBeCloseTo(-0.4, 6);
    expect(longestAxisAngle(rotated(60, 300, 0))).toBeCloseTo(Math.PI / 2, 6); // tall: reads downwards
  });

  it("the cut-off is an axis ratio of about 1.3", () => {
    expect(longestAxisAngle(rotated(128, 100, 0.8))).toBe(0);
    expect(longestAxisAngle(rotated(132, 100, 0.8))).toBeCloseTo(0.8, 6);
  });

  it("text in a round cell is not rotated: the reading direction is horizontal", () => {
    const f = frameOf(regular(72, 100, 0.4));
    expect(f.across).toEqual({ x: 1, y: 0 });
    expect(f.down).toEqual({ x: -0, y: 1 });
  });
});
