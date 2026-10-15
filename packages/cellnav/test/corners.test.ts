import { describe, expect, it } from "vitest";
import { cornerVertices, mulberry32, type Point } from "../src";

const CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];
const d2 = (p: Point, q: Point) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
const costOf = (norm: Point[], idx: number[]) => idx.reduce((s, i, k) => s + d2(norm[i]!, CORNERS[k]!), 0);

// The exhaustive search the fast one replaces: every top-left, then every increasing triple after it.
function brute(norm: Point[]): number {
  const n = norm.length;
  let best = Infinity;
  for (let a = 0; a < n; a++)
    for (let b = 1; b < n - 2; b++)
      for (let c = b + 1; c < n - 1; c++)
        for (let d = c + 1; d < n; d++)
          best = Math.min(best, costOf(norm, [a, (a + b) % n, (a + c) % n, (a + d) % n]));
  return best;
}

const outline = (n: number, rand: () => number): Point[] => {
  // a wobbly star-shaped loop inside the unit square, in order round it
  const pts: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const r = 0.3 + 0.2 * rand();
    pts.push({ x: 0.5 + r * Math.cos(t), y: 0.5 + r * Math.sin(t) });
  }
  return pts;
};

describe("which vertices get the text box's corners", () => {
  it.each([4, 5, 6, 8, 12, 20, 33])("is as good as trying every choice (%i vertices)", (n) => {
    const r = mulberry32(n);
    for (let k = 0; k < 8; k++) {
      const norm = outline(n, r);
      const got = cornerVertices(norm);
      expect(costOf(norm, got)).toBeCloseTo(brute(norm), 12);
    }
  });

  it("returns four different vertices in order round the outline", () => {
    const r = mulberry32(3);
    for (const n of [4, 9, 40, 150]) {
      const idx = cornerVertices(outline(n, r));
      expect(idx).toHaveLength(4);
      expect(new Set(idx).size).toBe(4);
      // going once round from the first, the others come in increasing order
      const offsets = idx.map((i) => (i - idx[0]! + n) % n);
      expect(offsets[1]!).toBeLessThan(offsets[2]!);
      expect(offsets[2]!).toBeLessThan(offsets[3]!);
    }
  });

  it("picks the obvious vertices for a square", () => {
    const square: Point[] = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    expect(cornerVertices(square)).toEqual([0, 1, 2, 3]);
  });

  it("stays fast for an outline of a thousand vertices", () => {
    const t0 = performance.now();
    cornerVertices(outline(1000, mulberry32(9)));
    expect(performance.now() - t0).toBeLessThan(1500);
  });
});
