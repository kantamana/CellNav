import { intersect } from "./clip";
import { isConvexPolygon } from "./clip";
import { area, bounds, type Point, type Polygon } from "./geometry";

/** An inward corner shallower than this (px off the line between its neighbours) is ignored. */
const SHALLOW = 0.5;
/** How far back along the outline to look for the direction an edge is heading, in px. */
const LOOK = 10;
/** Cosine of the turn beyond which the outline counts as having reached a corner (about 25 degrees). */
const CORNER = Math.cos((25 * Math.PI) / 180);
/**
 * A fragment smaller than this many square px is debris, not a part. A cut that
 * trims such a wedge off a part still counts as a cut (it is what makes the part
 * convex), but the wedge is then dropped and never worked on.
 */
const DEBRIS = 1;
/** Most cuts made when splitting a shape, so a ragged outline cannot run away. */
const MAX_CUTS = 80;

/** The sharpest inward corner of the polygon: its index and how far it sits off the line, or undefined. */
function sharpestDent(poly: Polygon): { i: number; depth: number } | undefined {
  const s = Math.sign(area(poly)) || 1;
  let best: { i: number; depth: number } | undefined;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[(i + poly.length - 1) % poly.length]!;
    const b = poly[i]!;
    const c = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross * s >= 0) continue; // turns the same way as the outline: not a dent
    const depth = Math.abs(cross) / (Math.hypot(c.x - a.x, c.y - a.y) || 1);
    if (depth > SHALLOW && (!best || depth > best.depth)) best = { i, depth };
  }
  return best;
}

/**
 * A point about `LOOK` px along the outline from vertex `i`, going `dir` (+1
 * forward, -1 back), to read which way the outline is heading there. It stops
 * early at a corner, so a short edge gives that edge's own direction instead of
 * overshooting to somewhere else; a gentle curve is followed the full distance.
 */
function along(poly: Polygon, i: number, dir: 1 | -1): Point {
  const n = poly.length;
  let k = i;
  let walked = 0;
  let first: Point | undefined; // direction of the first step
  for (let step = 0; step < n; step++) {
    const next = (k + dir + n) % n;
    const dx = poly[next]!.x - poly[k]!.x;
    const dy = poly[next]!.y - poly[k]!.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) {
      k = next;
      continue;
    }
    const unit = { x: dx / len, y: dy / len };
    if (!first) first = unit;
    else if (unit.x * first.x + unit.y * first.y < CORNER) break; // turned a corner: stop here
    walked += len;
    k = next;
    if (walked >= LOOK) break;
  }
  return poly[k]!;
}

/**
 * Removes repeated points and zero-width spikes, where the outline runs out to
 * a tip and straight back. A cut that runs along an existing edge leaves these
 * behind; they hold no area, and no further cut can remove them.
 */
export function trimSpikes(poly: Polygon): Polygon {
  const dedupe = (list: Polygon) =>
    list.filter((p, i) => {
      const q = list[(i + 1) % list.length]!;
      return Math.hypot(q.x - p.x, q.y - p.y) > 1e-6;
    });
  let pts = dedupe(poly);
  for (let changed = true; changed && pts.length >= 3; ) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i + pts.length - 1) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const bc = { x: c.x - b.x, y: c.y - b.y };
      const cross = ab.x * bc.y - ab.y * bc.x;
      const dot = ab.x * bc.x + ab.y * bc.y;
      const reversing = dot < 0 && Math.abs(cross) <= 1e-6 * Math.hypot(ab.x, ab.y) * Math.hypot(bc.x, bc.y);
      if (reversing || Math.hypot(c.x - a.x, c.y - a.y) < 1e-6) {
        // the tip goes; the points either side of it may now be the same point
        pts = dedupe(pts.filter((_, k) => k !== i));
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** The two halves of `poly` either side of the line through `p` heading `d`. */
function cut(poly: Polygon, p: Point, d: Point): Polygon[] {
  const b = bounds(poly);
  const reach = 4 * Math.hypot(b.width, b.height) || 1;
  const n = { x: -d.y, y: d.x };
  const half = (sign: 1 | -1): Polygon => [
    { x: p.x - d.x * reach, y: p.y - d.y * reach },
    { x: p.x + d.x * reach, y: p.y + d.y * reach },
    { x: p.x + d.x * reach + n.x * reach * sign, y: p.y + d.y * reach + n.y * reach * sign },
    { x: p.x - d.x * reach + n.x * reach * sign, y: p.y - d.y * reach + n.y * reach * sign },
  ];
  return [...intersect(poly, half(1)), ...intersect(poly, half(-1))]
    .map(trimSpikes)
    .filter((q) => q.length >= 3 && Math.abs(area(q)) > 1e-6);
}

/**
 * Splits a polygon into convex parts by cutting along straight lines. At each
 * inward corner the outline's own edge is carried on in a straight line across
 * the shape, which removes that corner. Every part keeps the true outline,
 * curves and all, wherever it follows the shape's edge; only the cuts are
 * straight. Of the two edges at a corner, the cut that splits the shape more
 * evenly is used. A convex polygon comes back whole.
 */
export function convexParts(poly: Polygon): Polygon[] {
  const parts: Polygon[] = [poly];
  const stuck = new Set<Polygon>(); // parts no cut could split
  for (let cuts = 0; cuts < MAX_CUTS; cuts++) {
    // Work on the biggest part that still has a real inward corner.
    const target = parts
      .filter((p) => !stuck.has(p) && Math.abs(area(p)) >= DEBRIS && sharpestDent(p))
      .sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)))[0];
    if (!target) break;
    const dent = sharpestDent(target)!;

    const v = target[dent.i]!;
    const back = along(target, dent.i, -1);
    const forward = along(target, dent.i, 1);
    const unit = (from: Point): Point => {
      const len = Math.hypot(v.x - from.x, v.y - from.y) || 1;
      return { x: (v.x - from.x) / len, y: (v.y - from.y) / len };
    };
    // Carry the incoming edge on past the corner, or the outgoing edge back through it.
    // (If the edge lies along another edge, as in a star, that cuts nothing.)
    let usable = [cut(target, v, unit(back)), cut(target, v, unit(forward))].filter((h) => h.length >= 2);
    if (usable.length === 0) {
      // Then cut along the bisector of the inward corner, which always splits it.
      const b = unit(back);
      const f = unit(forward);
      const len = Math.hypot(b.x - f.x, b.y - f.y) || 1;
      usable = [cut(target, v, { x: (b.x - f.x) / len, y: (b.y - f.y) / len })].filter((h) => h.length >= 2);
    }
    if (usable.length === 0) {
      stuck.add(target); // leave it whole and carry on with the others
      continue;
    }
    // Keep the cut that leaves the biggest part biggest, so the biggest convex part stays as big as it can.
    const biggest = (halves: Polygon[]) => Math.max(...halves.map((h) => Math.abs(area(h))));
    const chosen = usable.sort((x, y) => biggest(y) - biggest(x))[0]!;
    parts.splice(parts.indexOf(target), 1, ...chosen);
  }
  const real = parts.filter((p) => Math.abs(area(p)) >= DEBRIS);
  return real.length ? real : parts;
}

/**
 * The convex parts worth putting text in, biggest first: at most `maxPieces`,
 * and none smaller than `minShare` of the whole.
 */
export function convexPieces(poly: Polygon, maxPieces = 4, minShare = 0.1): Polygon[] {
  const total = Math.abs(area(poly));
  const sorted = convexParts(poly).sort((a, b) => Math.abs(area(b)) - Math.abs(area(a)));
  return sorted.filter((p, k) => k === 0 || Math.abs(area(p)) >= minShare * total).slice(0, maxPieces);
}

/** The biggest convex part of a polygon. */
export function largestConvexPart(poly: Polygon): Polygon {
  return convexPieces(poly, 1)[0] ?? poly;
}
