import opentype from "opentype.js";
import type { Point } from "./geometry";

export type Font = opentype.Font;

export async function loadFont(url: string): Promise<Font> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load font ${url}: ${res.status}`);
  return opentype.parse(await res.arrayBuffer());
}

/** What the outlines were sampled with before sizes were known. */
const BASE_CURVE_STEPS = 10;
const BASE_SEGMENT = 0.03;
/** Most points a single curve or straight edge may be cut into. */
const MAX_SPLITS = 1000;

export interface OutlineOptions {
  /**
   * The size in px of the shape the text will be bent to fill. With it, points
   * are added until no stretch of outline is longer than `segmentPx` once it is
   * drawn, so curves do not turn into polygons however large the word is.
   * Without it, a fixed, coarser sampling is used.
   */
  width?: number;
  height?: number;
  /** Longest stretch of finished outline, in px. Default 2.5. */
  segmentPx?: number;
  /** 0 to 1: how far rounded letters are squared up into their corners. Default 0. */
  cornerFill?: number;
}

/** A corner gap (as a share of the half-box) below this is "touching", above `GAP_FULL` is a real round corner. */
const GAP_TOUCH = 0.03;
const GAP_ROUND = 0.15;
/** A gap past these is a point or flat end (A's apex, V's tip), not a round corner. */
const GAP_POINTED = 0.5;
const GAP_FAR = 0.75;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Pushes the rounded corners of one letter out into its box's corners (an O
 * becomes a rounded square). Each corner is judged on its own and blended smoothly: where the ink
 * already touches the corner (H, E, the left of a D) or is only a pointed or
 * flat end (A, V) nothing moves, so straight letters stay straight. Points
 * are moved along the line from the letter's centre, so the push is zero on
 * the axes and the outline stays smooth.
 */
function squareCorners(contours: Point[][], amount: number): void {
  const pts = contours.flat();
  if (!pts.length) return;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const hx = (Math.max(...xs) - Math.min(...xs)) / 2 || 1;
  const hy = (Math.max(...ys) - Math.min(...ys)) / 2 || 1;
  // How strongly each corner (by sign of x, then y) is rounded.
  const strength = new Map<string, number>();
  for (const sx of [-1, 1])
    for (const sy of [-1, 1]) {
      let gap = Infinity;
      for (const p of pts) gap = Math.min(gap, Math.hypot((p.x - cx) / hx - sx, (p.y - cy) / hy - sy));
      strength.set(`${sx},${sy}`, smooth(GAP_TOUCH, GAP_ROUND, gap) * (1 - smooth(GAP_POINTED, GAP_FAR, gap)));
    }
  for (const c of contours)
    for (const p of c) {
      const dx = (p.x - cx) / hx;
      const dy = (p.y - cy) / hy;
      const edge = Math.max(Math.abs(dx), Math.abs(dy));
      if (edge < 1e-9) continue;
      // The four corners' strengths, blended smoothly so the push has no kink at the axes.
      let s = 0;
      for (const sx of [-1, 1])
        for (const sy of [-1, 1])
          s += strength.get(`${sx},${sy}`)! * ((1 + sx * dx) / 2) * ((1 + sy * dy) / 2);
      // Circle to square, but never past the box.
      const full = Math.min(Math.hypot(dx, dy) / edge, 1 / edge);
      const k = 1 + amount * s * (full - 1);
      p.x = cx + dx * k * hx;
      p.y = cy + dy * k * hy;
    }
}

/**
 * Text as closed contours inside the unit square (stretched to fill it). The
 * outline is flattened finely enough for the size it will be drawn at: p5 adds
 * vertices the same way (`sampleFactor`), and for the same reason, because a
 * warp stretches every straight piece and any corner between pieces shows.
 */
export function textContours(font: Font, text: string, opts: OutlineOptions = {}): Point[][] {
  const path = font.getPath(text, 0, 0, 100);

  // Rough extent, control points included: only used to estimate how many px each
  // font unit becomes. (Control points can stick out past the real outline, so
  // the unit square is fitted to the sampled outline below, not to this.)
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const cmd of path.commands) {
    if (cmd.type === "Z") continue;
    for (const [x, y] of [
      [cmd.x, cmd.y],
      ["x1" in cmd ? cmd.x1 : cmd.x, "y1" in cmd ? cmd.y1 : cmd.y],
      ["x2" in cmd ? cmd.x2 : cmd.x, "y2" in cmd ? cmd.y2 : cmd.y],
    ] as [number, number][]) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  const sized = opts.width !== undefined && opts.height !== undefined;
  const segmentPx = Math.max(0.25, opts.segmentPx ?? 2.5);
  // px per font unit across and down: the text box is stretched to the shape.
  const sx = sized ? opts.width! / (maxX - minX || 1) : 0;
  const sy = sized ? opts.height! / (maxY - minY || 1) : 0;
  const px = (dx: number, dy: number) => Math.hypot(dx * sx, dy * sy);

  const curveSteps = (...pts: Point[]) => {
    if (!sized) return BASE_CURVE_STEPS;
    let length = 0;
    for (let i = 1; i < pts.length; i++) length += px(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
    return Math.min(MAX_SPLITS, Math.max(BASE_CURVE_STEPS, Math.ceil(length / segmentPx)));
  };

  const contours: Point[][] = [];
  // Which letter each contour belongs to (only needed to square corners).
  const letterOf: number[] = [];
  let letter = 0;
  let cur: Point[] = [];
  let last: Point = { x: 0, y: 0 };

  const flush = () => {
    if (cur.length > 1) {
      contours.push(cur);
      letterOf.push(letter);
    }
    cur = [];
  };

  const amount = Math.min(1, Math.max(0, opts.cornerFill ?? 0));
  const letters = amount > 0 && typeof font.getPaths === "function" ? font.getPaths(text, 0, 0, 100) : [path];
  for (const glyph of letters) {
    letter++;
    flush();
  for (const cmd of glyph.commands) {
    if (cmd.type === "M") {
      flush();
      last = { x: cmd.x, y: cmd.y };
      cur.push(last);
    } else if (cmd.type === "L") {
      last = { x: cmd.x, y: cmd.y };
      cur.push(last);
    } else if (cmd.type === "Q") {
      const p0 = last;
      const steps = curveSteps(p0, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x, y: cmd.y });
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const m = 1 - t;
        cur.push({
          x: m * m * p0.x + 2 * m * t * cmd.x1 + t * t * cmd.x,
          y: m * m * p0.y + 2 * m * t * cmd.y1 + t * t * cmd.y,
        });
      }
      last = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "C") {
      const p0 = last;
      const steps = curveSteps(p0, { x: cmd.x1, y: cmd.y1 }, { x: cmd.x2, y: cmd.y2 }, { x: cmd.x, y: cmd.y });
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const m = 1 - t;
        cur.push({
          x: m ** 3 * p0.x + 3 * m * m * t * cmd.x1 + 3 * m * t * t * cmd.x2 + t ** 3 * cmd.x,
          y: m ** 3 * p0.y + 3 * m * m * t * cmd.y1 + 3 * m * t * t * cmd.y2 + t ** 3 * cmd.y,
        });
      }
      last = { x: cmd.x, y: cmd.y };
    } else if (cmd.type === "Z") {
      flush();
    }
  }
  }
  flush();
  if (amount > 0) {
    for (let l = 1; l <= letter; l++)
      squareCorners(contours.filter((_, i) => letterOf[i] === l), amount);
  }

  // Fit the unit square to the outline itself.
  let fx = Infinity;
  let fX = -Infinity;
  let fy = Infinity;
  let fY = -Infinity;
  for (const c of contours)
    for (const p of c) {
      fx = Math.min(fx, p.x);
      fX = Math.max(fX, p.x);
      fy = Math.min(fy, p.y);
      fY = Math.max(fY, p.y);
    }
  const w = fX - fx || 1;
  const h = fY - fy || 1;

  // Normalise, then split long straight runs so the warp can bend them.
  return contours.map((c) => {
    const norm = c.map((p) => ({ x: (p.x - fx) / w, y: (p.y - fy) / h }));
    const out: Point[] = [];
    for (let i = 0; i < norm.length; i++) {
      const a = norm[i]!;
      const b = norm[(i + 1) % norm.length]!;
      out.push(a);
      const n = sized
        ? Math.min(MAX_SPLITS, Math.ceil(Math.hypot((b.x - a.x) * opts.width!, (b.y - a.y) * opts.height!) / segmentPx))
        : Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / BASE_SEGMENT);
      for (let k = 1; k < n; k++) {
        out.push({
          x: a.x + ((b.x - a.x) * k) / n,
          y: a.y + ((b.y - a.y) * k) / n,
        });
      }
    }
    return out;
  });
}

/** Width of `s` in the font; falls back to one unit per character. */
const advance = (font: Font, s: string) =>
  typeof font.getAdvanceWidth === "function" ? font.getAdvanceWidth(s, 100) : s.length;

/**
 * How much worse a cut inside a word counts than a cut at a space, as a share
 * of the whole text's width. A space that is within this distance of where a
 * cut ideally goes beats a cut in the middle of a word.
 */
const MID_WORD_PENALTY = 0.15;

/**
 * Shares a label out over several pieces that are read in order, like line
 * breaks. `lengths` is how long each piece is along the reading direction; a
 * longer piece takes more of the text. Each cut goes where the shares say, but
 * prefers a space close by to a spot in the middle of a word. Every piece gets
 * at least one letter, so if there are fewer letters than pieces only the
 * longest pieces are used.
 */
export function splitText(
  font: Font,
  text: string,
  lengths: number[],
): { text: string; piece: number }[] {
  const chars = [...text];
  const isGap = (c: string) => c.trim() === "";
  const letters = chars.filter((c) => !isGap(c)).length;
  if (letters === 0) return [];

  // With fewer letters than pieces, keep the longest pieces, in order.
  let keep = lengths.map((_, i) => i);
  if (keep.length > letters) {
    const longest = [...keep].sort((a, b) => lengths[b]! - lengths[a]!).slice(0, letters);
    keep = keep.filter((i) => longest.includes(i));
  }
  const m = keep.length;
  const whole = () => [{ text: text.trim(), piece: keep[0]! }];
  if (m === 1) return whole();

  const n = chars.length;
  const widths = chars.map((c) => advance(font, c));
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  // Where each possible cut (before character p) falls along the text, 0 to 1,
  // and how many letters lie before it.
  const at = new Array<number>(n + 1).fill(0);
  const lettersBefore = new Array<number>(n + 1).fill(0);
  for (let p = 1; p <= n; p++) {
    at[p] = at[p - 1]! + widths[p - 1]! / total;
    lettersBefore[p] = lettersBefore[p - 1]! + (isGap(chars[p - 1]!) ? 0 : 1);
  }
  const atSpace = (p: number) => isGap(chars[p - 1]!) || isGap(chars[p]!);

  const keptLengths = keep.map((i) => lengths[i]!);
  const keptTotal = keptLengths.reduce((a, b) => a + b, 0) || 1;
  const ideal: number[] = [];
  let run = 0;
  for (let j = 0; j < m - 1; j++) {
    run += keptLengths[j]! / keptTotal;
    ideal.push(run);
  }
  const cost = (j: number, p: number) => Math.abs(at[p]! - ideal[j]!) + (atSpace(p) ? 0 : MID_WORD_PENALTY);

  // Cheapest increasing cuts such that every piece holds at least one letter.
  type Cell = { cost: number; from: number };
  const best: Cell[][] = Array.from({ length: m - 1 }, () => Array.from({ length: n }, () => ({ cost: Infinity, from: -1 })));
  for (let p = 1; p < n; p++) if (lettersBefore[p]! >= 1) best[0]![p] = { cost: cost(0, p), from: 0 };
  for (let j = 1; j < m - 1; j++)
    for (let p = 2; p < n; p++)
      for (let a = 1; a < p; a++) {
        const prev = best[j - 1]![a]!;
        if (prev.cost === Infinity || lettersBefore[p]! - lettersBefore[a]! < 1) continue;
        const c = prev.cost + cost(j, p);
        if (c < best[j]![p]!.cost) best[j]![p] = { cost: c, from: a };
      }
  let end = -1;
  let endCost = Infinity;
  for (let p = 1; p < n; p++) {
    const c = best[m - 2]![p]!.cost;
    if (c < endCost && letters - lettersBefore[p]! >= 1) {
      endCost = c;
      end = p;
    }
  }
  if (end < 0) return whole();

  const cuts: number[] = [];
  for (let j = m - 2, p = end; j >= 0; j--) {
    cuts.unshift(p);
    p = best[j]![p]!.from;
  }
  const bounds = [0, ...cuts, n];
  return keep
    .map((piece, j) => ({ text: chars.slice(bounds[j]!, bounds[j + 1]!).join("").trim(), piece }))
    .filter((c) => c.text !== "");
}
