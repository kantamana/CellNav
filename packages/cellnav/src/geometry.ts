export type Point = { x: number; y: number };
export type Polygon = Point[];

export function area(poly: Polygon): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function centroid(poly: Polygon): Point {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const f = p.x * q.y - q.x * p.y;
    a += f;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1;
    return {
      x: poly.reduce((s, p) => s + p.x, 0) / n,
      y: poly.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Keeps the half-plane a*x + b*y + c >= 0 (Sutherland–Hodgman step). */
export function clipHalfPlane(
  poly: Polygon,
  a: number,
  b: number,
  c: number,
): Polygon {
  const out: Polygon = [];
  for (let i = 0; i < poly.length; i++) {
    const curr = poly[i]!;
    const next = poly[(i + 1) % poly.length]!;
    const dc = a * curr.x + b * curr.y + c;
    const dn = a * next.x + b * next.y + c;
    if (dc >= 0) out.push(curr);
    if (dc >= 0 !== dn >= 0) {
      const t = dc / (dc - dn);
      out.push({
        x: curr.x + t * (next.x - curr.x),
        y: curr.y + t * (next.y - curr.y),
      });
    }
  }
  return out;
}

export function pointInConvex(p: Point, poly: Polygon, eps = 1e-6): boolean {
  const sign = Math.sign(area(poly)) || 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross * sign < -eps) return false;
  }
  return true;
}

export function bounds(poly: Polygon) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/** The smallest convex polygon that holds all the points (monotone chain). */
export function convexHull(points: Point[]): Polygon {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * How little a shape is dented: its area over the area of its convex hull. 1 is
 * convex, a heart is about 0.94, a plus sign about 0.68, a star about 0.47.
 */
export function solidity(poly: Polygon): number {
  const hull = Math.abs(area(convexHull(poly)));
  return hull > 0 ? Math.abs(area(poly)) / hull : 1;
}

/** The point on the polygon's outline that is nearest to `p`. */
export function nearestOnOutline(poly: Polygon, p: Point): Point {
  let best = poly[0]!;
  let bestDist = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const q = { x: a.x + t * dx, y: a.y + t * dy };
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < bestDist) {
      bestDist = d;
      best = q;
    }
  }
  return best;
}
