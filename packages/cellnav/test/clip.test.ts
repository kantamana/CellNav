import { describe, expect, it } from "vitest";
import { area, resolveBoundary } from "../src";
import {
  contains,
  intersect,
  isConvexPolygon,
  largest,
  offset,
  overlapArea,
  sharedLength,
  union,
} from "../src/clip";

const square = (x: number, y: number, s: number) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
];

// A "U" shape: two arms joined along the bottom.
const U = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 70 },
  { x: 70, y: 70 },
  { x: 70, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

describe("polygon clipping wrapper", () => {
  it("intersects two squares", () => {
    const [p] = intersect(square(0, 0, 10), square(5, 5, 10));
    expect(Math.abs(area(p!))).toBeCloseTo(25, 2);
  });

  it("splits a concave shape into pieces when a band crosses both arms", () => {
    const band = [
      { x: -10, y: 10 },
      { x: 110, y: 10 },
      { x: 110, y: 20 },
      { x: -10, y: 20 },
    ];
    const pieces = intersect(band, U);
    expect(pieces).toHaveLength(2);
    expect(pieces.reduce((s, p) => s + Math.abs(area(p)), 0)).toBeCloseTo(600, 2);
  });

  it("unions touching squares into one polygon", () => {
    const u = union(square(0, 0, 10), square(10, 0, 10));
    expect(u).toHaveLength(1);
    expect(Math.abs(area(u[0]!))).toBeCloseTo(200, 2);
  });

  it("insets a square by a true constant distance", () => {
    const p = offset(square(0, 0, 100), 10)!;
    expect(Math.abs(area(p))).toBeCloseTo(80 * 80, 1);
  });

  it("insets a concave shape without crossing its dent", () => {
    const p = offset(U, 5)!;
    expect(Math.abs(area(p))).toBeLessThan(Math.abs(area(U)));
    // The dent (the gap between the arms) stays outside the inset shape.
    expect(contains(p, { x: 50, y: 30 })).toBe(false);
    expect(contains(p, { x: 15, y: 30 })).toBe(true);
  });

  it("returns nothing when the inset swallows the shape", () => {
    expect(offset(square(0, 0, 10), 20)).toBeUndefined();
  });

  it("tests points in a concave polygon", () => {
    expect(contains(U, { x: 15, y: 30 })).toBe(true);
    expect(contains(U, { x: 50, y: 30 })).toBe(false);
    expect(contains(U, { x: 50, y: 85 })).toBe(true);
  });

  it("recognises convex and concave outlines", () => {
    expect(isConvexPolygon(square(0, 0, 5))).toBe(true);
    expect(isConvexPolygon(U)).toBe(false);
  });

  it("measures shared boundary between neighbours", () => {
    expect(sharedLength(square(0, 0, 10), square(10, 0, 10))).toBeCloseTo(10, 3);
    expect(sharedLength(square(0, 0, 10), square(10, 5, 10))).toBeCloseTo(5, 3);
    expect(sharedLength(square(0, 0, 10), square(30, 0, 10))).toBe(0);
  });

  it("overlapArea and largest", () => {
    expect(overlapArea(square(0, 0, 10), square(5, 0, 10))).toBeCloseTo(50, 2);
    expect(largest([square(0, 0, 2), square(0, 0, 5)])).toEqual(square(0, 0, 5));
  });
});

describe("convexity, judged by how far a vertex is off the line", () => {
  const circle = (n: number, r = 300) =>
    Array.from({ length: n }, (_, i) => ({
      x: 500 + r * Math.cos((2 * Math.PI * i) / n),
      y: 500 + r * Math.sin((2 * Math.PI * i) / n),
    }));
  // A square 200 across with extra points on each side
  const squareWith = (pointsPerSide: number, wobble: (k: number) => number) => {
    const pts: { x: number; y: number }[] = [];
    const corners = [[0, 0], [200, 0], [200, 200], [0, 200]] as const;
    let k = 0;
    for (let s = 0; s < 4; s++) {
      const [x0, y0] = corners[s]!;
      const [x1, y1] = corners[(s + 1) % 4]!;
      for (let i = 0; i < pointsPerSide; i++) {
        const t = i / pointsPerSide;
        const nx = (y1 - y0) / 200; // outward normal of the edge
        const ny = -(x1 - x0) / 200;
        const w = i === 0 ? 0 : wobble(k++);
        pts.push({ x: x0 + (x1 - x0) * t + nx * w, y: y0 + (y1 - y0) * t + ny * w });
      }
    }
    return pts;
  };

  it("a finely sampled circle is convex, at any fineness", () => {
    for (const n of [8, 72, 400, 2000]) expect(isConvexPolygon(circle(n)), String(n)).toBe(true);
  });

  it("a dented outline stays dented when sampled very finely", () => {
    // A heart-like dip: a circle with a bite taken out of the top, sampled every ~1px.
    const pts = Array.from({ length: 2000 }, (_, i) => {
      const t = (2 * Math.PI * i) / 2000;
      const bite = 60 * Math.exp(-((t - Math.PI * 1.5) ** 2) / 0.02);
      const r = 300 - bite;
      return { x: 500 + r * Math.cos(t), y: 500 + r * Math.sin(t) };
    });
    expect(isConvexPolygon(pts)).toBe(false);
  });

  it("the shapes with dents are dented at every size the boundary can be drawn", () => {
    for (const name of ["heart", "star", "cross", "arrow"])
      for (const size of [100, 600, 2000])
        expect(isConvexPolygon(resolveBoundary(name, size, size)), `${name} ${size}`).toBe(false);
  });

  it("the shapes without dents are convex at every size", () => {
    for (const name of ["circle", "ellipse", "hexagon", "triangle", "pentagon", "diamond", "rounded"])
      for (const size of [100, 600, 2000])
        expect(isConvexPolygon(resolveBoundary(name, size, size)), `${name} ${size}`).toBe(true);
  });

  it("the drop has a tiny dip near its tip: dented, but only just", () => {
    expect(isConvexPolygon(resolveBoundary("drop", 600, 600))).toBe(false);
  });

  it("rounding noise on a straight edge does not make a convex shape look dented", () => {
    // each extra point on a side is knocked off the line by up to 0.0009: below the library's own rounding
    const noisy = squareWith(40, (k) => (k % 2 === 0 ? 0.0009 : -0.0009));
    expect(isConvexPolygon(noisy)).toBe(true);
  });

  it("a gentle real dent, half a unit deep over 200 units, is found", () => {
    const dented = squareWith(40, (k) => (k >= 60 && k < 100 ? -0.5 * Math.sin(((k - 60) / 40) * Math.PI) : 0));
    expect(isConvexPolygon(dented)).toBe(false);
  });

  it("a clockwise and a counter-clockwise outline give the same answer", () => {
    const c = circle(200);
    expect(isConvexPolygon(c)).toBe(isConvexPolygon([...c].reverse()));
  });
});
