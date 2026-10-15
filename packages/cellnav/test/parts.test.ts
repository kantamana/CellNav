import { describe, expect, it } from "vitest";
import { area, bounds, mulberry32, resolveBoundary, type Point } from "../src";
import { convexParts, convexPieces, largestConvexPart, trimSpikes } from "../src/parts";
import { overlapArea } from "../src/clip";
import { deepestDent, edgeDistance, insideRegion } from "./helpers";

const total = (parts: Point[][]) => parts.reduce((s, p) => s + Math.abs(area(p)), 0);
const NAMES = ["heart", "cross", "star", "arrow", "drop"];

describe("cutting a shape into convex parts", () => {
  it("a convex polygon comes back whole", () => {
    for (const name of ["circle", "hexagon", "triangle", "pentagon", "rounded"]) {
      const poly = resolveBoundary(name, 600, 600);
      expect(convexParts(poly), name).toEqual([poly]);
    }
  });

  it.each(NAMES)("the %s splits into convex parts that tile it exactly", (name) => {
    const poly = resolveBoundary(name, 600, 600);
    const parts = convexParts(poly);
    for (const p of parts) expect(deepestDent(p)).toBeLessThan(0.5);
    expect(total(parts)).toBeCloseTo(Math.abs(area(poly)), -1);
    expect(total(parts) / Math.abs(area(poly))).toBeGreaterThan(0.995);
    expect(total(parts) / Math.abs(area(poly))).toBeLessThan(1.005);
    for (let i = 0; i < parts.length; i++)
      for (let j = i + 1; j < parts.length; j++)
        expect(overlapArea(parts[i]!, parts[j]!)).toBeLessThan(Math.abs(area(poly)) * 0.005);
    for (const p of parts) for (const q of p) expect(insideRegion(poly, q, 0.25)).toBe(true);
  });

  it("the heart is two curved halves, not polygons: they keep the true outline", () => {
    const heart = resolveBoundary("heart", 600, 600);
    const [a, b] = convexParts(heart).sort((x, y) => Math.abs(area(y)) - Math.abs(area(x)));
    expect(Math.abs(area(a!)) / Math.abs(area(heart))).toBeGreaterThan(0.4);
    expect(Math.abs(area(b!)) / Math.abs(area(heart))).toBeGreaterThan(0.4);
    // each half carries hundreds of the outline's own points
    expect(a!.length).toBeGreaterThan(150);
    expect(b!.length).toBeGreaterThan(150);
    // every point of the heart's outline is on the boundary of one of the parts
    for (const p of heart.filter((_, i) => i % 7 === 0)) {
      const nearest = Math.min(...convexParts(heart).map((part) => edgeDistance(part, p)));
      expect(nearest).toBeLessThan(0.3);
    }
  });

  it("the plus sign is three rectangles", () => {
    const cross = resolveBoundary("cross", 600, 600);
    const parts = convexParts(cross).sort((x, y) => Math.abs(area(y)) - Math.abs(area(x)));
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).toHaveLength(4);
    expect(Math.abs(area(parts[0]!)) / Math.abs(area(cross))).toBeGreaterThan(0.55);
  });

  it("a star, whose edges run along other edges, still splits into convex parts", () => {
    const star = resolveBoundary("star", 600, 600);
    const parts = convexParts(star);
    expect(parts.length).toBeGreaterThanOrEqual(5);
    for (const p of parts) expect(deepestDent(p)).toBeLessThan(0.5);
  });

  it("the arrow keeps one big part, most of it", () => {
    const arrow = resolveBoundary("arrow", 600, 600);
    const biggest = Math.max(...convexParts(arrow).map((p) => Math.abs(area(p))));
    expect(biggest / Math.abs(area(arrow))).toBeGreaterThan(0.8);
  });

  it("works for the dented cells a navbar makes in a star", async () => {
    const { voronoiLayout } = await import("../src");
    const star = resolveBoundary("star", 1000, 400);
    for (const rngSeed of [1, 2, 3, 4, 5]) {
      for (const cell of voronoiLayout(7, 1000, 400, { rngSeed }, star).cells) {
        const parts = convexParts(cell);
        for (const p of parts) expect(deepestDent(p)).toBeLessThan(0.5);
        expect(total(parts) / Math.abs(area(cell))).toBeGreaterThan(0.99);
        expect(total(parts) / Math.abs(area(cell))).toBeLessThan(1.01);
      }
    }
  });

  describe("random dented shapes (seeded)", () => {
    // A wobbly star-shaped polygon: points round a centre at random distances.
    const random = (rand: () => number, minN: number, maxN: number): Point[] => {
      const n = minN + Math.floor(rand() * (maxN - minN));
      return Array.from({ length: n }, (_, i) => {
        const t = (2 * Math.PI * i) / n;
        const r = 80 + 220 * rand();
        return { x: 400 + r * Math.cos(t), y: 400 + r * Math.sin(t) };
      });
    };

    it("shapes of ordinary raggedness always end with convex parts that tile them", () => {
      const rand = mulberry32(2024);
      for (let k = 0; k < 60; k++) {
        const poly = random(rand, 6, 22);
        const t0 = performance.now();
        const parts = convexParts(poly);
        expect(performance.now() - t0).toBeLessThan(2000);
        const ratio = total(parts) / Math.abs(area(poly));
        expect(ratio, `shape ${k}`).toBeGreaterThan(0.99);
        expect(ratio, `shape ${k}`).toBeLessThan(1.01);
        for (const p of parts) expect(deepestDent(p), `shape ${k}`).toBeLessThan(0.5);
      }
    });

    it("even very spiky shapes finish, keep their area, and mostly come out convex", () => {
      const rand = mulberry32(7);
      for (let k = 0; k < 25; k++) {
        const poly = random(rand, 30, 55);
        const parts = convexParts(poly);
        expect(parts.length).toBeLessThanOrEqual(90);
        const ratio = total(parts) / Math.abs(area(poly));
        expect(ratio, `shape ${k}`).toBeGreaterThan(0.99);
        expect(ratio, `shape ${k}`).toBeLessThan(1.01);
        const dented = parts.filter((p) => deepestDent(p) >= 0.5).length;
        expect(dented, `shape ${k}`).toBeLessThanOrEqual(Math.ceil(parts.length / 5));
      }
    });
  });

  it("is quick for a finely sampled outline", () => {
    const heart = resolveBoundary("heart", 1500, 1500); // many hundreds of vertices
    const t0 = performance.now();
    convexParts(heart);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});

describe("the convex parts worth putting text in", () => {
  const cross = resolveBoundary("cross", 600, 600);

  it("comes biggest first, and no more than asked", () => {
    const pieces = convexPieces(cross, 2);
    expect(pieces).toHaveLength(2);
    expect(Math.abs(area(pieces[0]!))).toBeGreaterThanOrEqual(Math.abs(area(pieces[1]!)));
  });

  it("leaves out parts under a share of the whole", () => {
    const star = resolveBoundary("star", 600, 600);
    const all = convexPieces(star, 12, 0).length;
    const worthIt = convexPieces(star, 12, 0.08).length;
    expect(all).toBeGreaterThan(worthIt);
    for (const p of convexPieces(star, 12, 0.08)) expect(Math.abs(area(p))).toBeGreaterThanOrEqual(0.08 * Math.abs(area(star)) - 1);
  });

  it("always has the biggest part, however small it is", () => {
    expect(convexPieces(cross, 4, 0.99)).toHaveLength(1);
  });

  it("the largest part is the biggest of them", () => {
    const biggest = Math.max(...convexParts(cross).map((p) => Math.abs(area(p))));
    expect(Math.abs(area(largestConvexPart(cross)))).toBeCloseTo(biggest, 0);
  });

  it("a convex polygon's one piece is itself", () => {
    const pent = resolveBoundary("pentagon", 600, 600);
    expect(convexPieces(pent)).toEqual([pent]);
    expect(largestConvexPart(pent)).toEqual(pent);
  });

  it("reports sizes as bounds do, so bounds of the biggest are within the shape's", () => {
    const b = bounds(largestConvexPart(cross));
    const whole = bounds(cross);
    expect(b.width).toBeLessThanOrEqual(whole.width + 1e-6);
    expect(b.height).toBeLessThanOrEqual(whole.height + 1e-6);
  });
});

describe("trimming zero-width spikes", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  it("leaves a clean polygon alone", () => {
    expect(trimSpikes(square)).toEqual(square);
  });

  it("removes a spike that runs out to a tip and straight back", () => {
    // an antenna from the top-right corner out to (250, 0) and back
    const withAntenna = [square[0]!, square[1]!, { x: 250, y: 0 }, square[1]!, square[2]!, square[3]!];
    const out = trimSpikes(withAntenna);
    expect(out).toHaveLength(4);
    expect(Math.abs(area(out))).toBeCloseTo(10000, 6);
  });

  it("removes repeated points", () => {
    const doubled = [square[0]!, square[0]!, square[1]!, square[2]!, square[2]!, square[3]!];
    expect(trimSpikes(doubled)).toEqual(square);
  });

  it("removes a spike made of several points in a row", () => {
    const long = [square[0]!, square[1]!, { x: 150, y: 0 }, { x: 250, y: 0 }, { x: 150, y: 0 }, square[1]!, square[2]!, square[3]!];
    expect(Math.abs(area(trimSpikes(long)))).toBeCloseTo(10000, 6);
    expect(trimSpikes(long)).toHaveLength(4);
  });

  it("does not remove a sharp but real corner", () => {
    const dart = [{ x: 0, y: 0 }, { x: 100, y: 10 }, { x: 0, y: 20 }];
    expect(trimSpikes(dart)).toEqual(dart);
  });
});
