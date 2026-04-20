import type { P5CanvasInstance } from "@p5-wrapper/react";
import type { Point } from "../polygon";

/**
 * Computes mean value coordinates for a point p inside a convex polygon.
 * Returns normalized weights for each vertex.
 */
function getMeanValueCoords(p: Point, polygon: Point[]): number[] {
  const n = polygon.length;
  const w = new Array(n).fill(0);
  let sum = 0;

  for (let i = 0; i < n; i++) {
    const v = polygon[i];
    const vPrev = polygon[(i - 1 + n) % n];
    const vNext = polygon[(i + 1) % n];

    const r = Math.hypot(v.x - p.x, v.y - p.y);
    if (r < 1e-8) {
      const out = new Array(n).fill(0);
      out[i] = 1;
      return out;
    }

    const rPrev = Math.hypot(vPrev.x - p.x, vPrev.y - p.y);
    const rNext = Math.hypot(vNext.x - p.x, vNext.y - p.y);

    const cosAlpha =
      ((vPrev.x - p.x) * (v.x - p.x) + (vPrev.y - p.y) * (v.y - p.y)) /
      (rPrev * r);
    const cosBeta =
      ((vNext.x - p.x) * (v.x - p.x) + (vNext.y - p.y) * (v.y - p.y)) /
      (rNext * r);

    const alpha = Math.acos(Math.min(1, Math.max(-1, cosAlpha)));
    const beta = Math.acos(Math.min(1, Math.max(-1, cosBeta)));

    const weight = (Math.tan(alpha / 2) + Math.tan(beta / 2)) / r;
    w[i] = weight;
    sum += weight;
  }

  for (let i = 0; i < n; i++) {
    w[i] /= sum || 1;
  }

  return w;
}

/**
 * Generates a true square cage with n vertices around the unit square boundary.
 * The cage always includes the four exact square corners, with additional vertices
 * distributed evenly along the edges.
 */
function squareBoundaryCage(n: number): Point[] {
  if (n <= 4) {
    const corners: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    return corners.slice(0, n);
  }

  const extra = n - 4;
  const base = Math.floor(extra / 4);
  const remainder = extra % 4;
  const edgeCounts = [base, base, base, base];
  for (let i = 0; i < remainder; i++) {
    edgeCounts[i] += 1;
  }

  const corners: Point[] = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ];

  const result: Point[] = [];
  for (let edge = 0; edge < 4; edge++) {
    const start = corners[edge];
    const end = corners[(edge + 1) % 4];
    result.push(start);

    const count = edgeCounts[edge];
    for (let j = 0; j < count; j++) {
      const t = (j + 1) / (count + 1);
      result.push({
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      });
    }
  }

  return result;
}

export const warpEffect = (
  polygon: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) => {
  const n = polygon.length;

  return (_p: P5CanvasInstance, pt: Point, _t: number) => {
    const u = (pt.x - minX) / (maxX - minX || 1);
    const v = (pt.y - minY) / (maxY - minY || 1);
    const p = { x: u, y: v };

    // Build a true source cage on the unit square boundary with exactly n vertices.
    const sourcePolygon = squareBoundaryCage(n);
    const lambdas = getMeanValueCoords(p, sourcePolygon);

    let x = 0;
    let y = 0;

    for (let i = 0; i < n; i++) {
      x += lambdas[i] * polygon[i].x;
      y += lambdas[i] * polygon[i].y;
    }

    return { x, y };
  };
};