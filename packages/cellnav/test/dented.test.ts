import opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import {
  area,
  bounds,
  buildCells,
  convexHull,
  nearestOnOutline,
  resolveBoundary,
  solidity,
  textInShape,
  type Font,
  type Point,
} from "../src";
import { contains } from "../src/clip";
import antonUrl from "../src/assets/Anton-Regular.ttf?inline";
import { edgeDistance, insideRegion } from "./helpers";

const bytes = Uint8Array.from(atob(antonUrl.slice(antonUrl.indexOf("base64,") + 7)), (c) => c.charCodeAt(0));
const anton = opentype.parse(bytes.buffer) as Font;

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe("how dented a shape is", () => {
  it("is 1 for anything convex", () => {
    expect(solidity(rect(0, 0, 10, 4))).toBeCloseTo(1, 9);
    for (const n of ["circle", "hexagon", "triangle", "pentagon", "diamond"])
      expect(solidity(resolveBoundary(n, 600, 600)), n).toBeCloseTo(1, 2);
  });

  it("is lower the deeper the dents", () => {
    const heart = solidity(resolveBoundary("heart", 600, 600));
    const arrow = solidity(resolveBoundary("arrow", 600, 600));
    const cross = solidity(resolveBoundary("cross", 600, 600));
    const star = solidity(resolveBoundary("star", 600, 600));
    expect(heart).toBeGreaterThan(0.9);
    expect(heart).toBeLessThan(0.97);
    expect(arrow).toBeGreaterThan(0.65);
    expect(cross).toBeGreaterThan(0.6);
    expect(star).toBeLessThan(0.55);
    expect(heart).toBeGreaterThan(arrow);
  });

  it("is the shape's area over its hull's area, worked out by hand for an L", () => {
    const L = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 60 }, { x: 100, y: 60 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    // area 40*60 + 100*40 = 6400; hull is the L plus the triangle across its corner: 8200
    expect(solidity(L)).toBeCloseTo(6400 / 8200, 9);
  });
});

describe("convex hull", () => {
  const r = (() => { let a = 5; return () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); })();
  it("holds every point and is convex", () => {
    const pts = Array.from({ length: 200 }, () => ({ x: r() * 100, y: r() * 100 }));
    const hull = convexHull(pts);
    const a = Math.abs(area(hull));
    expect(a).toBeGreaterThan(0);
    for (const p of pts) expect(contains(hull, p) || edgeDistance(hull, p) < 1e-6).toBe(true);
  });
  it("of a square with a point inside is the square", () => {
    const hull = convexHull([...rect(0, 0, 10, 10), { x: 5, y: 5 }]);
    expect(hull).toHaveLength(4);
    expect(Math.abs(area(hull))).toBeCloseTo(100, 9);
  });
});

describe("nearest point on an outline", () => {
  const square = rect(0, 0, 10, 10);
  it("is the same point for one on the outline", () => {
    expect(nearestOnOutline(square, { x: 5, y: 0 })).toEqual({ x: 5, y: 0 });
  });
  it("moves a point from outside straight to the edge, or to the corner", () => {
    expect(nearestOnOutline(square, { x: 5, y: -4 })).toEqual({ x: 5, y: 0 });
    expect(nearestOnOutline(square, { x: 14, y: 13 })).toEqual({ x: 10, y: 10 });
  });
  it("also works from inside", () => {
    expect(nearestOnOutline(square, { x: 9, y: 5 })).toEqual({ x: 10, y: 5 });
  });
});

describe("words in dented shapes, with the real font", () => {
  const shapes: [string, string][] = [
    ["heart", "LOVE"],
    ["drop", "RAIN"],
    ["arrow", "NEXT"],
    ["cross", "PLUS"],
    ["star", "STAR"],
  ];

  it.each(shapes)("every letter point of %s stays inside the shape", (shape, word) => {
    const region = resolveBoundary(shape, 600, 600);
    const cell = buildCells(textInShape(word, shape).spec(), anton)[0]!;
    for (const contour of cell.label)
      for (const p of contour) expect(insideRegion(region, p, 0.25)).toBe(true);
  });

  it("in a heart the word spans the whole heart, both lobes, not just a part", () => {
    const heart = bounds(resolveBoundary("heart", 600, 600));
    const cell = buildCells(textInShape("LOVE", "heart").spec(), anton)[0]!;
    const b = bounds(cell.label.flat());
    expect(b.width).toBeGreaterThan(heart.width * 0.85);
    expect(b.height).toBeGreaterThan(heart.height * 0.8);
  });

  it("in a deeply dented shape it stays in one convex part, so it covers much less of it", () => {
    const cross = bounds(resolveBoundary("cross", 600, 600));
    const cell = buildCells(textInShape("PLUS", "cross").spec(), anton)[0]!;
    const b = bounds(cell.label.flat());
    // the bounding box of the word is no bigger than one bar of the cross
    expect(b.width * b.height).toBeLessThan(cross.width * cross.height * 0.5);
  });

  it("the heart's letters have many points, so curves stay smooth", () => {
    const cell = buildCells(textInShape("LOVE", "heart").spec(), anton)[0]!;
    expect(cell.label.flat().length).toBeGreaterThan(1500);
  });
});
