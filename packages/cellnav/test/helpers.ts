import { textContours, type Font, type Point } from "../src";
import { contains } from "../src/clip";

/** Spec setting that leaves a straight outline with no extra points (see glyphCorners). */
export const NO_EXTRA_POINTS = 1e9;

/**
 * The four real corners (top-left, top-right, bottom-right, bottom-left) of a
 * square test glyph after it has been placed in a cell. Letter outlines get
 * extra points along their edges, so the corners are only at known places if
 * the cell was built with `detail: NO_EXTRA_POINTS`, which leaves the square
 * with just its four corners, in order.
 */
export function glyphCorners(
  font: Font,
  text: string,
  label: Point[][],
): [Point, Point, Point, Point] {
  const unit = textContours(font, text, { width: 1, height: 1, segmentPx: NO_EXTRA_POINTS })[0]!;
  if (unit.length !== 4 || label[0]!.length !== 4) {
    throw new Error("glyphCorners needs a cell built with detail: NO_EXTRA_POINTS and a square test glyph.");
  }
  return label[0]!.slice(0, 4) as [Point, Point, Point, Point];
}

/**
 * How far the glyph is from an unbent rectangle or parallelogram: 0 if its top
 * edge equals its bottom edge as a vector, bigger the more it is bent.
 */
export function bend(corners: [Point, Point, Point, Point]): number {
  const [tl, tr, br, bl] = corners;
  return Math.hypot(tr.x - tl.x - (br.x - bl.x), tr.y - tl.y - (br.y - bl.y));
}

/** Distance from a point to the nearest edge of a polygon. */
export function edgeDistance(poly: Point[], p: Point): number {
  return Math.min(
    ...poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    }),
  );
}

/** Inside a polygon of any shape, counting its edge (the even-odd test alone is strict about edges). */
export function insideRegion(poly: Point[], p: Point, tolerance = 0.1): boolean {
  return contains(poly, p) || edgeDistance(poly, p) < tolerance;
}

/** How far the deepest inward corner of a polygon sits off the line between its neighbours (0 if convex). */
export function deepestDent(poly: Point[]): number {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    sign += a.x * b.y - b.x * a.y;
  }
  const s = Math.sign(sign) || 1;
  let worst = 0;
  poly.forEach((b, i) => {
    const a = poly[(i + poly.length - 1) % poly.length]!;
    const c = poly[(i + 1) % poly.length]!;
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross * s < 0) worst = Math.max(worst, Math.abs(cross) / (Math.hypot(c.x - a.x, c.y - a.y) || 1));
  });
  return worst;
}
