import * as Clipper from "clipper-lib";
import { area, type Point, type Polygon } from "./geometry";

// Clipper works on integers, so coordinates are scaled up and rounded.
const SCALE = 1000;

const toPath = (poly: Polygon): Clipper.Path =>
  poly.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) }));

const fromPath = (path: Clipper.Path): Polygon =>
  path.map((p) => ({ x: p.X / SCALE, y: p.Y / SCALE }));

/** Clipper wants every outer ring the same way round. */
const oriented = (poly: Polygon): Clipper.Path => {
  const path = toPath(poly);
  if (!Clipper.Clipper.Orientation(path)) path.reverse();
  return path;
};

const run = (type: Clipper.ClipType, subject: Polygon[], clip: Polygon[]) => {
  const c = new Clipper.Clipper();
  c.AddPaths(subject.map(oriented), Clipper.PolyType.ptSubject, true);
  c.AddPaths(clip.map(oriented), Clipper.PolyType.ptClip, true);
  const out: Clipper.Paths = [];
  c.Execute(
    type,
    out,
    Clipper.PolyFillType.pftNonZero,
    Clipper.PolyFillType.pftNonZero,
  );
  return out.map(fromPath).filter((p) => p.length >= 3);
};

/** The pieces where `a` and `b` overlap. A concave `a` can give several. */
export const intersect = (a: Polygon, b: Polygon): Polygon[] =>
  run(Clipper.ClipType.ctIntersection, [a], [b]);

export const union = (a: Polygon, b: Polygon): Polygon[] =>
  run(Clipper.ClipType.ctUnion, [a], [b]);

/** Total area where the two overlap. */
export const overlapArea = (a: Polygon, b: Polygon): number =>
  intersect(a, b).reduce((s, p) => s + Math.abs(area(p)), 0);

export const largest = (polys: Polygon[]): Polygon | undefined =>
  polys.reduce<Polygon | undefined>(
    (best, p) => (!best || Math.abs(area(p)) > Math.abs(area(best)) ? p : best),
    undefined,
  );

/**
 * Moves every edge `distance` inwards (outwards if negative), keeping the
 * outline true however concave it is. Returns the biggest surviving piece, or
 * undefined if the shape disappears.
 */
export function offset(poly: Polygon, distance: number): Polygon | undefined {
  if (distance === 0) return poly;
  const o = new Clipper.ClipperOffset(2, 0.25 * SCALE);
  o.AddPath(oriented(poly), Clipper.JoinType.jtRound, Clipper.EndType.etClosedPolygon);
  const out: Clipper.Paths = [];
  o.Execute(out, -distance * SCALE);
  return largest(out.map(fromPath).filter((p) => p.length >= 3));
}

/** Even-odd point-in-polygon, for any simple polygon. */
export function contains(poly: Polygon, p: Point): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

/**
 * How far a vertex may sit off the straight line between its neighbours and
 * still count as lying on it. The polygon library rounds to a thousandth of a
 * unit, which scatters points on a straight edge by about that much.
 */
const ON_THE_LINE = 0.002;

/**
 * True if the polygon has no inward corner. Each vertex is judged by how far it
 * sits off the line between its neighbours, not by the size of the turn, so a
 * dented outline sampled with many tiny steps is still seen as dented. A dent
 * shallower than `tolerance` px is ignored.
 */
export function isConvexPolygon(poly: Polygon, tolerance = ON_THE_LINE): boolean {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const c = poly[(i + 2) % poly.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    const off = Math.abs(cross) / (Math.hypot(c.x - a.x, c.y - a.y) || 1);
    if (off < tolerance) continue;
    const s = Math.sign(cross);
    if (sign !== 0 && s !== sign) return false;
    sign = s;
  }
  return true;
}

/** Length of boundary two polygons have in common (along shared edges). */
export function sharedLength(a: Polygon, b: Polygon, tol = 0.02): number {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i]!;
    const a1 = a[(i + 1) % a.length]!;
    const len = Math.hypot(a1.x - a0.x, a1.y - a0.y);
    if (len < 1e-9) continue;
    const ux = (a1.x - a0.x) / len;
    const uy = (a1.y - a0.y) / len;
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j]!;
      const b1 = b[(j + 1) % b.length]!;
      const d0 = Math.abs(ux * (b0.y - a0.y) - uy * (b0.x - a0.x));
      const d1 = Math.abs(ux * (b1.y - a0.y) - uy * (b1.x - a0.x));
      if (d0 > tol || d1 > tol) continue;
      const t0 = ux * (b0.x - a0.x) + uy * (b0.y - a0.y);
      const t1 = ux * (b1.x - a0.x) + uy * (b1.y - a0.y);
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(len, Math.max(t0, t1));
      if (hi > lo) total += hi - lo;
    }
  }
  return total;
}
