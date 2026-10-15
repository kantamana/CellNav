import {
  area,
  bounds,
  centroid,
  clipHalfPlane,
  pointInConvex,
  type Point,
  type Polygon,
} from "./geometry";
import {
  contains,
  intersect,
  isConvexPolygon,
  largest,
  sharedLength,
  union,
} from "./clip";

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cellOf(seed: Point, seeds: Point[], box: Polygon): Polygon {
  let poly = box;
  for (const o of seeds) {
    if (o === seed) continue;
    // Keep the side of the bisector that contains `seed`.
    const a = 2 * (seed.x - o.x);
    const b = 2 * (seed.y - o.y);
    const c = o.x ** 2 + o.y ** 2 - seed.x ** 2 - seed.y ** 2;
    poly = clipHalfPlane(poly, a, b, c);
    if (poly.length === 0) break;
  }
  return poly;
}

const rectangle = (width: number, height: number): Polygon => [
  { x: 0, y: 0 },
  { x: width, y: 0 },
  { x: width, y: height },
  { x: 0, y: height },
];

/**
 * Cells of `seeds` inside a concave `region`. A seed's ordinary cell can be
 * cut into several pieces by a dent. The piece holding the seed is its cell;
 * a stranded piece goes to the neighbouring cell it shares the most edge with,
 * so the cells still tile the region and every cell is one connected shape.
 */
function concaveCells(seeds: Point[], region: Polygon): Polygon[] {
  const b = bounds(region);
  const frame: Polygon = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ];

  const cells: Polygon[] = [];
  let stranded: { owner: number; poly: Polygon }[] = [];
  seeds.forEach((s, i) => {
    const pieces = intersect(cellOf(s, seeds, frame), region);
    const main = pieces.find((p) => contains(p, s)) ?? largest(pieces) ?? [];
    cells[i] = main;
    for (const p of pieces) if (p !== main) stranded.push({ owner: i, poly: p });
  });

  // Biggest pieces first. Keep going while a pass still places something, as a
  // piece may only touch a neighbour once another piece has been attached.
  stranded.sort((x, y) => Math.abs(area(y.poly)) - Math.abs(area(x.poly)));
  for (let progress = true; progress && stranded.length > 0; ) {
    progress = false;
    const left: typeof stranded = [];
    for (const piece of stranded) {
      let best = -1;
      let bestLen = 0;
      cells.forEach((c, j) => {
        if (j === piece.owner) return;
        const len = sharedLength(piece.poly, c);
        if (len > bestLen) {
          bestLen = len;
          best = j;
        }
      });
      const merged = best >= 0 ? union(cells[best]!, piece.poly) : [];
      if (merged.length === 1) {
        cells[best] = merged[0]!;
        progress = true;
      } else {
        left.push(piece);
      }
    }
    stranded = left;
  }
  return cells;
}

/** Cells of `seeds` inside `region` (the whole box by default), convex or not. */
export function voronoiCells(
  seeds: Point[],
  width: number,
  height: number,
  region: Polygon = rectangle(width, height),
) {
  return isConvexPolygon(region)
    ? seeds.map((s) => cellOf(s, seeds, region))
    : concaveCells(seeds, region);
}

export interface VoronoiOptions {
  /** How much wider than tall the cells are. 1 = isotropic. */
  stretch?: number;
  /** A number makes the layout reproducible; "random" picks a fresh one each call. */
  rngSeed?: number | "random";
  /**
   * Lloyd relaxation passes: more = more even, symmetric-looking cells.
   * Defaults to 25, or to 0 when `organic` is set.
   */
  relaxation?: number;
  /**
   * Organic layout: seeds are scattered at random with only a minimum gap
   * between them and are not evened out, so cells vary in size and shape.
   */
  organic?: boolean;
  /** Fixed seed positions in 0..1 coordinates, replacing the generated ones. */
  points?: Point[];
}

export const DEFAULT_STRETCH = 2.5;

export interface VoronoiLayout {
  seeds: Point[];
  cells: Polygon[];
}

/**
 * Random seeds with a minimum gap between them (dart throwing). If a gap
 * can't be met, it is loosened a little, so a crowded layout never stalls.
 */
function scatter(
  count: number,
  w: number,
  h: number,
  rand: () => number,
  sample: () => Point,
): Point[] {
  const pts: Point[] = [];
  let gap = 0.6 * Math.sqrt((w * h) / Math.max(count, 1));
  while (pts.length < count) {
    let placed = false;
    for (let tries = 0; tries < 60 && !placed; tries++) {
      const p = sample();
      if (pts.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= gap)) {
        pts.push(p);
        placed = true;
      }
    }
    if (!placed) gap *= 0.9;
  }
  return pts;
}

/**
 * Seeds are fixed. The tessellation is computed in a space where x is divided
 * by `stretch`, then mapped back, so every cell stays a true Voronoi cell of
 * that squashed metric and comes out `stretch` times wider. `boundary` is the
 * outline (page coordinates, convex or concave) that the cells must fill.
 */
/**
 * Nudges and swaps the seeds so that each cell's width:height approaches its
 * target, while keeping cell sizes roughly even. Cell edges stay straight
 * Voronoi edges, so this steers the shapes rather than fixing them exactly.
 * A seeded hill-climb: the same seed always gives the same layout.
 */
function pullTowardsAspects(
  start: Point[],
  region: Polygon,
  w: number,
  h: number,
  stretch: number,
  targets: number[],
  rectangularity: number[],
  rand: () => number,
  inside: (p: Point) => boolean,
): Point[] {
  const n = start.length;
  const share = Math.abs(area(region)) / n;
  const concave = !isConvexPolygon(region);

  const cost = (seeds: Point[]) => {
    let c = 0;
    voronoiCells(seeds, w, h, region).forEach((poly, i) => {
      if (poly.length < 3) {
        c += 1e3;
        return;
      }
      const b = bounds(poly);
      const aspect = (b.width * stretch) / Math.max(b.height, 1e-6);
      c += Math.log(aspect / targets[i]!) ** 2;
      // Share of the bounding box the cell fills: 1 for a rectangle.
      c += rectangularity[i]! * (1 - Math.abs(area(poly)) / Math.max(b.width * b.height, 1e-6));
      c += 0.6 * Math.log(Math.max(Math.abs(area(poly)), 1e-6) / share) ** 2;
    });
    return c;
  };

  let seeds = start.map((p) => ({ ...p }));
  let best = cost(seeds);
  // Wanting rectangles as well as proportions is a harder search: look longer.
  const wantsRects = rectangularity.some((r) => r > 0);
  const iterations = concave ? (wantsRects ? 300 : 120) : wantsRects ? 1500 : 400;
  const step0 = 0.25 * Math.sqrt(share);

  for (let it = 0; it < iterations; it++) {
    const trial = seeds.map((p) => ({ ...p }));
    if (n > 1 && rand() < 0.25) {
      // Swap two seeds: gives a wide item a roomier spot without a long walk.
      const a = Math.floor(rand() * n);
      let b = Math.floor(rand() * n);
      if (b === a) b = (b + 1) % n;
      [trial[a], trial[b]] = [trial[b]!, trial[a]!];
    } else {
      const k = Math.floor(rand() * n);
      const step = step0 * (1 - it / iterations) + step0 * 0.05;
      const p = {
        x: trial[k]!.x + (rand() - 0.5) * 2 * step,
        y: trial[k]!.y + (rand() - 0.5) * 2 * step,
      };
      if (!inside(p)) continue;
      trial[k] = p;
    }
    const c = cost(trial);
    if (c < best) {
      best = c;
      seeds = trial;
    }
  }
  return seeds;
}

export function voronoiLayout(
  count: number,
  width: number,
  height: number,
  opts: VoronoiOptions = {},
  boundary?: Polygon,
  /** Wanted width:height of each cell (page proportions), by item. */
  aspects?: number[],
  /**
   * How hard to push each cell towards a rectangle, by item (0 = not at all).
   * A picture covers the cell's bounding box and is clipped to the cell, so
   * the share of it that stays visible is the cell's area over that box.
   */
  rectangularity?: number[],
): VoronoiLayout {
  const stretch = opts.stretch ?? DEFAULT_STRETCH;
  const relaxation = opts.relaxation ?? (opts.organic ? 0 : 25);
  const w = width / stretch;
  const rngSeed =
    opts.rngSeed === "random"
      ? Math.floor(Math.random() * 2 ** 31)
      : (opts.rngSeed ?? 1);
  const rand = mulberry32(rngSeed);

  // Work in the squashed space: the boundary's x is divided by `stretch` too.
  const region: Polygon = (boundary ?? rectangle(width, height)).map((p) => ({
    x: p.x / stretch,
    y: p.y,
  }));
  const box = bounds(region);
  const concave = !isConvexPolygon(region);
  const sample = (): Point => {
    for (let tries = 0; tries < 1000; tries++) {
      const p = {
        x: box.minX + rand() * box.width,
        y: box.minY + rand() * box.height,
      };
      if (concave ? contains(region, p) : pointInConvex(p, region)) return p;
    }
    return concave ? region[0]! : centroid(region);
  };

  let seeds: Point[] = opts.points
    ? opts.points.map((p) => ({
        x: box.minX + p.x * box.width,
        y: box.minY + p.y * box.height,
      }))
    : opts.organic
      ? scatter(count, box.width, box.height, rand, sample)
      : Array.from({ length: count }, sample);

  if (!opts.points && relaxation > 0) {
    for (let i = 0; i < relaxation; i++) {
      const cells = voronoiCells(seeds, w, height, region);
      seeds = seeds.map((s, k) => {
        const cell = cells[k]!;
        if (cell.length < 3) return s;
        const c = centroid(cell);
        // In a concave shape the centroid can fall outside it: stay put then.
        return concave && !contains(region, c) ? s : c;
      });
    }
  }

  const steered =
    aspects &&
    aspects.length === seeds.length &&
    (aspects.some((a) => Math.abs(a - stretch) > 1e-6) ||
      (rectangularity?.some((r) => r > 0) ?? false));
  if (!opts.points && steered) {
    seeds = pullTowardsAspects(
      seeds,
      region,
      w,
      height,
      stretch,
      aspects,
      rectangularity ?? aspects.map(() => 0),
      rand,
      (p) => (concave ? contains(region, p) : pointInConvex(p, region)),
    );
  }

  const cells = voronoiCells(seeds, w, height, region).map((poly) =>
    poly.map((p) => ({ x: p.x * stretch, y: p.y })),
  );
  return { seeds: seeds.map((s) => ({ x: s.x * stretch, y: s.y })), cells };
}
