import {
  area,
  centroid,
  pointInConvex,
  type Point,
  type Polygon,
} from "./geometry";

/** Longest axis over shortest below which a shape counts as having no direction. */
const ROUND_SHAPE = 1.3;

/**
 * Angle (radians, in (-PI/2, PI/2]) of the polygon's longest axis, from the
 * principal axis of its area. Folding into that range means the reading
 * direction always points rightwards, so text is never upside down.
 */
export function longestAxisAngle(poly: Polygon): number {
  const c = centroid(poly);
  // Second moments of the polygon area (triangle fan from the centroid).
  let ixx = 0;
  let iyy = 0;
  let ixy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = { x: poly[i]!.x - c.x, y: poly[i]!.y - c.y };
    const b = {
      x: poly[(i + 1) % poly.length]!.x - c.x,
      y: poly[(i + 1) % poly.length]!.y - c.y,
    };
    const cross = a.x * b.y - b.x * a.y;
    ixx += cross * (a.x * a.x + a.x * b.x + b.x * b.x);
    iyy += cross * (a.y * a.y + a.y * b.y + b.y * b.y);
    // Triangle moments are cross/12 for xx and yy, but cross/24 for xy.
    ixy += (cross * (a.x * b.y + 2 * a.x * a.y + 2 * b.x * b.y + b.x * a.y)) / 2;
  }
  // Clockwise and counter-clockwise polygons flip every moment's sign.
  const s = Math.sign(area(poly)) || 1;

  // A shape that is nearly as wide as it is long (a circle, a square, a star)
  // has no longest direction, so any angle found would be arbitrary. Text in
  // it reads horizontally instead.
  const mean = ((ixx + iyy) * s) / 2;
  const root = Math.hypot(((ixx - iyy) * s) / 2, ixy * s);
  if (mean - root > 0 && Math.sqrt((mean + root) / (mean - root)) < ROUND_SHAPE) return 0;

  let theta = 0.5 * Math.atan2(2 * ixy * s, (ixx - iyy) * s);
  if (theta <= -Math.PI / 2) theta += Math.PI;
  if (theta > Math.PI / 2) theta -= Math.PI;
  return theta;
}

export interface Frame {
  centre: Point;
  /** Unit vector the text reads along (x component is never negative). */
  across: Point;
  /** Unit vector pointing down the page for the text. */
  down: Point;
}

export function frameOf(poly: Polygon): Frame {
  const theta = longestAxisAngle(poly);
  return {
    centre: centroid(poly),
    across: { x: Math.cos(theta), y: Math.sin(theta) },
    down: { x: -Math.sin(theta), y: Math.cos(theta) },
  };
}

/** Subdivides edges until the polygon has at least `n` vertices. */
function padTo(poly: Polygon, n: number): Polygon {
  const out = [...poly];
  while (out.length < n) {
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < out.length; i++) {
      const a = out[i]!;
      const b = out[(i + 1) % out.length]!;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > bestLen) {
        bestLen = d;
        best = i;
      }
    }
    const a = out[best]!;
    const b = out[(best + 1) % out.length]!;
    out.splice(best + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return out;
}

/**
 * Which four vertices of an outline, in order round it, sit closest to the
 * corners of the unit square (top-left, top-right, bottom-right, bottom-left).
 * `norm` is the outline's vertices already fitted into the unit square. For
 * each possible top-left vertex it walks round the outline picking the best
 * top-right, then bottom-right, then bottom-left, always further along, and
 * keeping the best partial pick at every step, so it is O(n^2): an outline with
 * hundreds of vertices costs no more than a coarse one.
 */
export function cornerVertices(norm: Point[]): number[] {
  const corners = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const dist2 = (p: Point, q: Point) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
  const n = norm.length;
  let best = [0, 1, 2, 3];
  let bestCost = Infinity;
  for (let a = 0; a < n; a++) {
    const cost = (offset: number, k: number) => dist2(norm[(a + offset) % n]!, corners[k]!);
    let topRight = { cost: Infinity, at: 0 }; // best top-right so far, and where
    let bottomRight = { cost: Infinity, at: 0 }; // best top-right + bottom-right so far
    const topRightFor = new Array<number>(n).fill(0); // the top-right behind a bottom-right at j
    let end = { cost: Infinity, bl: 0, br: 0 };
    for (let j = 1; j < n; j++) {
      // Each corner may only use picks made at earlier offsets, so test the
      // later corners first and update the running bests last.
      if (j >= 3 && bottomRight.cost < Infinity) {
        const c = cost(j, 3) + bottomRight.cost;
        if (c < end.cost) end = { cost: c, bl: j, br: bottomRight.at };
      }
      if (j >= 2 && topRight.cost < Infinity) {
        const c = cost(j, 2) + topRight.cost;
        topRightFor[j] = topRight.at;
        if (c < bottomRight.cost) bottomRight = { cost: c, at: j };
      }
      const c1 = cost(j, 1);
      if (c1 < topRight.cost) topRight = { cost: c1, at: j };
    }
    if (end.cost === Infinity) continue;
    const total = cost(0, 0) + end.cost;
    if (total < bestCost) {
      bestCost = total;
      best = [a, (a + topRightFor[end.br]!) % n, (a + end.br) % n, (a + end.bl) % n];
    }
  }
  return best;
}

export interface OrientedCage {
  /** Polygon vertices, ordered so that vertex k lands on `cage[k]`. */
  target: Polygon;
  /** Matching vertices on the boundary of the unit square (the text box). */
  source: Point[];
}

/**
 * Pairs the polygon with a unit-square cage whose top-left corner is the
 * polygon vertex nearest the top-left of the text frame, and so on clockwise.
 * The remaining vertices are spread along the square's edges in proportion
 * to the polygon's own edge lengths.
 */
export function orientedCage(poly: Polygon, frame: Frame): OrientedCage {
  let verts = padTo(poly, 4);

  // Coordinates in the text frame, y pointing down.
  const local = (p: Point) => {
    const dx = p.x - frame.centre.x;
    const dy = p.y - frame.centre.y;
    return {
      u: dx * frame.across.x + dy * frame.across.y,
      v: dx * frame.down.x + dy * frame.down.y,
    };
  };

  // The frame is a rotation, so a positive area is clockwise on screen.
  if (area(verts) < 0) verts = [...verts].reverse();

  const loc = verts.map(local);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const q of loc) {
    minU = Math.min(minU, q.u);
    maxU = Math.max(maxU, q.u);
    minV = Math.min(minV, q.v);
    maxV = Math.max(maxV, q.v);
  }
  const norm = loc.map((q) => ({
    x: (q.u - minU) / (maxU - minU || 1),
    y: (q.v - minV) / (maxV - minV || 1),
  }));

  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];
  const dist2 = (p: Point, q: Point) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2;

  const n = verts.length;
  const best = cornerVertices(norm);

  const target: Point[] = [];
  const source: Point[] = [];
  for (let k = 0; k < 4; k++) {
    const startIdx = best[k]!;
    const endIdx = best[(k + 1) % 4]!;
    const steps = (endIdx - startIdx + n) % n || n;
    const run: number[] = [];
    for (let s = 0; s <= steps; s++) run.push((startIdx + s) % n);
    let total = 0;
    const lens: number[] = [0];
    for (let s = 1; s < run.length; s++) {
      const p = verts[run[s - 1]!]!;
      const q = verts[run[s]!]!;
      total += Math.hypot(q.x - p.x, q.y - p.y);
      lens.push(total);
    }
    const from = corners[k]!;
    const to = corners[(k + 1) % 4]!;
    for (let s = 0; s < run.length - 1; s++) {
      const t = total > 0 ? lens[s]! / total : s / (run.length - 1);
      target.push(verts[run[s]!]!);
      source.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }
  return { target, source };
}

/**
 * The largest rectangle, centred on the polygon's centroid and aligned with
 * the text frame, that fits inside a convex polygon. Returned top-left,
 * top-right, bottom-right, bottom-left, in page coordinates.
 */
export function inscribedRect(
  poly: Polygon,
  frame: Frame,
): [Point, Point, Point, Point] {
  const at = (u: number, v: number): Point => ({
    x: frame.centre.x + frame.across.x * u + frame.down.x * v,
    y: frame.centre.y + frame.across.y * u + frame.down.y * v,
  });
  const fits = (hu: number, hv: number) =>
    [at(-hu, -hv), at(hu, -hv), at(hu, hv), at(-hu, hv)].every((p) =>
      pointInConvex(p, poly, 1e-6),
    );

  let reach = 0;
  for (const p of poly)
    reach = Math.max(reach, Math.hypot(p.x - frame.centre.x, p.y - frame.centre.y));

  let bestArea = -1;
  let best = { hu: 0, hv: 0 };
  // Try many width:height ratios and keep whichever encloses the most area.
  for (let i = 0; i <= 40; i++) {
    const k = Math.exp(((i - 20) / 20) * Math.log(12));
    let lo = 0;
    let hi = reach;
    for (let it = 0; it < 30; it++) {
      const mid = (lo + hi) / 2;
      if (fits(k * mid, mid)) lo = mid;
      else hi = mid;
    }
    if (k * lo * lo > bestArea) {
      bestArea = k * lo * lo;
      best = { hu: k * lo, hv: lo };
    }
  }
  const { hu, hv } = best;
  return [at(-hu, -hv), at(hu, -hv), at(hu, hv), at(-hu, hv)];
}
