import { isConvexPolygon } from "./clip";
import { area, bounds, type Point, type Polygon } from "./geometry";

/** Shapes drawn as SVG paths in a 100 x 100 box, then stretched to the real one. */
export const SHAPE_PATHS = {
  triangle: "M50 0 L100 100 L0 100 Z",
  pentagon: "M50 0 L100 38 L81 100 L19 100 L0 38 Z",
  star: "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z",
  heart: "M50 30 C46 0 0 0 0 35 C0 65 50 85 50 100 C50 85 100 65 100 35 C100 0 54 0 50 30 Z",
  cross: "M35 0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z",
  arrow: "M0 30 L60 30 L60 0 L100 50 L60 100 L60 70 L0 70 Z",
  drop: "M50 0 C80 40 100 60 100 72 C100 90 78 100 50 100 C22 100 0 90 0 72 C0 60 20 40 50 0 Z",
} as const;

export const BOUNDARY_PRESETS = [
  "rectangle",
  "rounded",
  "ellipse",
  "circle",
  "hexagon",
  "diamond",
  ...(Object.keys(SHAPE_PATHS) as (keyof typeof SHAPE_PATHS)[]),
] as const;
export type BoundaryPreset = (typeof BOUNDARY_PRESETS)[number];

const arc = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  from: number,
  to: number,
  steps: number,
): Point[] =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const a = from + ((to - from) * i) / steps;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });

type DrawnPreset = "rectangle" | "rounded" | "ellipse" | "circle" | "hexagon" | "diamond";

function preset(name: BoundaryPreset, w: number, h: number): Polygon {
  if (name in SHAPE_PATHS) return pathInBox(SHAPE_PATHS[name as keyof typeof SHAPE_PATHS], w, h);
  switch (name as DrawnPreset) {
    case "rectangle":
      return [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
    case "rounded": {
      const r = Math.min(w, h) * 0.18;
      const P = Math.PI;
      return [
        ...arc(w - r, r, r, r, -P / 2, 0, 8),
        ...arc(w - r, h - r, r, r, 0, P / 2, 8),
        ...arc(r, h - r, r, r, P / 2, P, 8),
        ...arc(r, r, r, r, P, (3 * P) / 2, 8),
      ];
    }
    case "ellipse":
      return arc(w / 2, h / 2, w / 2, h / 2, 0, 2 * Math.PI, 72).slice(0, -1);
    case "circle": {
      const r = Math.min(w, h) / 2;
      return arc(w / 2, h / 2, r, r, 0, 2 * Math.PI, 72).slice(0, -1);
    }
    case "hexagon":
      return [
        { x: 0.25 * w, y: 0 },
        { x: 0.75 * w, y: 0 },
        { x: w, y: 0.5 * h },
        { x: 0.75 * w, y: h },
        { x: 0.25 * w, y: h },
        { x: 0, y: 0.5 * h },
      ];
    case "diamond":
      return [
        { x: 0.5 * w, y: 0 },
        { x: w, y: 0.5 * h },
        { x: 0.5 * w, y: h },
        { x: 0, y: 0.5 * h },
      ];
  }
}

const BASE_CURVE_STEPS = 12;
const MAX_CURVE_STEPS = 400;

export interface PathScale {
  /** How many px a unit of the path becomes, across and down. */
  x: number;
  y: number;
  /** Longest stretch of finished outline, in px. Default 3. */
  segmentPx?: number;
}

/**
 * Reads M L H V C Q Z (absolute or relative) into a flat polygon. Given the
 * scale the path will be drawn at, curves get enough points that no stretch is
 * longer than `segmentPx`; without it each curve gets 12.
 */
export function parsePath(d: string, scale?: PathScale): Polygon {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) throw new Error("Boundary path is empty.");

  const pts: Point[] = [];
  let i = 0;
  let cmd = "";
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const num = () => {
    const t = tokens[i++];
    const n = Number(t);
    if (t === undefined || Number.isNaN(n))
      throw new Error(`Boundary path: expected a number near "${t ?? "end"}".`);
    return n;
  };
  const push = (p: Point) => {
    cur = p;
    pts.push(p);
  };

  const stepsFor = (...pts: Point[]) => {
    if (!scale) return BASE_CURVE_STEPS;
    let length = 0;
    for (let k = 1; k < pts.length; k++)
      length += Math.hypot((pts[k]!.x - pts[k - 1]!.x) * scale.x, (pts[k]!.y - pts[k - 1]!.y) * scale.y);
    return Math.min(MAX_CURVE_STEPS, Math.max(BASE_CURVE_STEPS, Math.ceil(length / (scale.segmentPx ?? 3))));
  };

  while (i < tokens.length) {
    const t = tokens[i]!;
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    } else if (!cmd) {
      throw new Error("Boundary path must start with M.");
    } else if (cmd === "M") cmd = "L"; // extra pairs after M are line-tos
    else if (cmd === "m") cmd = "l";

    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cur.x : 0;
    const oy = rel ? cur.y : 0;

    switch (cmd.toUpperCase()) {
      case "M": {
        const p = { x: ox + num(), y: oy + num() };
        start = p;
        push(p);
        break;
      }
      case "L":
        push({ x: ox + num(), y: oy + num() });
        break;
      case "H":
        push({ x: ox + num(), y: cur.y });
        break;
      case "V":
        push({ x: cur.x, y: oy + num() });
        break;
      case "Q": {
        const p0 = cur;
        const c = { x: ox + num(), y: oy + num() };
        const e = { x: ox + num(), y: oy + num() };
        const steps = stepsFor(p0, c, e);
        for (let k = 1; k <= steps; k++) {
          const s = k / steps;
          const m = 1 - s;
          pts.push({
            x: m * m * p0.x + 2 * m * s * c.x + s * s * e.x,
            y: m * m * p0.y + 2 * m * s * c.y + s * s * e.y,
          });
        }
        cur = e;
        break;
      }
      case "C": {
        const p0 = cur;
        const c1 = { x: ox + num(), y: oy + num() };
        const c2 = { x: ox + num(), y: oy + num() };
        const e = { x: ox + num(), y: oy + num() };
        const steps = stepsFor(p0, c1, c2, e);
        for (let k = 1; k <= steps; k++) {
          const s = k / steps;
          const m = 1 - s;
          pts.push({
            x: m ** 3 * p0.x + 3 * m * m * s * c1.x + 3 * m * s * s * c2.x + s ** 3 * e.x,
            y: m ** 3 * p0.y + 3 * m * m * s * c1.y + 3 * m * s * s * c2.y + s ** 3 * e.y,
          });
        }
        cur = e;
        break;
      }
      case "Z":
        cur = start;
        break;
      default:
        throw new Error(
          `Boundary path: the "${cmd}" command isn't supported. Use M, L, H, V, Q, C and Z.`,
        );
    }
  }
  // Drop repeated points, including a final point that closes the loop.
  const out = pts.filter(
    (p, k) => k === 0 || Math.hypot(p.x - pts[k - 1]!.x, p.y - pts[k - 1]!.y) > 1e-9,
  );
  const first = out[0];
  const last = out[out.length - 1];
  if (first && last && out.length > 1 && Math.hypot(first.x - last.x, first.y - last.y) < 1e-9)
    out.pop();
  if (out.length < 3) throw new Error("Boundary path needs at least 3 points.");
  return out;
}

export const isConvex = isConvexPolygon;

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

/** True if no two edges of the outline cross each other. */
export function isSimple(poly: Polygon): boolean {
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // these two edges share a corner
      const c = poly[j]!;
      const d = poly[(j + 1) % n]!;
      const d1 = cross(a, b, c);
      const d2 = cross(a, b, d);
      const d3 = cross(c, d, a);
      const d4 = cross(c, d, b);
      if (d1 * d2 < 0 && d3 * d4 < 0) return false;
    }
  }
  return true;
}

/**
 * A path flattened finely enough for the box it will fill, then stretched to
 * fill it. The first, rough reading only finds the path's extent, to know how
 * many px each path unit becomes.
 */
function pathInBox(d: string, w: number, h: number): Polygon {
  const rough = bounds(parsePath(d));
  const poly = parsePath(d, { x: w / (rough.width || 1), y: h / (rough.height || 1) });
  return fitToBox(poly, w, h);
}

/** Stretches the polygon's bounding box to exactly fill 0..w by 0..h. */
function fitToBox(poly: Polygon, w: number, h: number): Polygon {
  const b = bounds(poly);
  return poly.map((p) => ({
    x: ((p.x - b.minX) / (b.width || 1)) * w,
    y: ((p.y - b.minY) / (b.height || 1)) * h,
  }));
}

/**
 * A boundary is a preset name ("ellipse", "hexagon", ...) or an SVG path.
 * The outline may be concave (a star, a heart) but must not cross itself.
 */
export function resolveBoundary(
  boundary: string | undefined,
  width: number,
  height: number,
): Polygon {
  const b = boundary?.trim();
  if (!b) return preset("rectangle", width, height);

  const name = b.toLowerCase();
  if ((BOUNDARY_PRESETS as readonly string[]).includes(name))
    return preset(name as BoundaryPreset, width, height);

  if (!/^[Mm]/.test(b)) {
    throw new Error(
      `Unknown boundary "${b}". Use one of ${BOUNDARY_PRESETS.join(", ")}, or an SVG path starting with M.`,
    );
  }
  const poly = pathInBox(b, width, height);
  if (!isSimple(poly)) {
    throw new Error("Boundary path crosses itself. Use an outline that doesn't intersect itself.");
  }
  if (Math.abs(area(poly)) < 1e-6) throw new Error("Boundary path has no area.");
  return poly;
}
