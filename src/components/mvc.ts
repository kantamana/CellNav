export type Point = { x: number; y: number };

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function dot(a: Point, b: Point) {
  return a.x * b.x + a.y * b.y;
}

function cross(a: Point, b: Point) {
  return a.x * b.y - a.y * b.x;
}

function length(v: Point) {
  return Math.hypot(v.x, v.y);
}

export function mvcWeights(P: Point, poly: Point[]) {
  const n = poly.length;
  const s: Point[] = [];
  const r: number[] = [];
  const angles: number[] = [];
  const w = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    s[i] = sub(poly[i], P);
    r[i] = length(s[i]);
  }

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    angles[i] = Math.atan2(cross(s[i], s[j]), dot(s[i], s[j]));
  }

  for (let i = 0; i < n; i++) {
    const im1 = (i - 1 + n) % n;
    w[i] =
      (Math.tan(angles[im1] / 2) + Math.tan(angles[i] / 2)) / r[i];
  }

  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((wi) => wi / sum);
}

export function warpPoint(
  P: Point,
  srcPoly: Point[],
  dstPoly: Point[]
): Point {
  const w = mvcWeights(P, srcPoly);
  let x = 0, y = 0;

  for (let i = 0; i < w.length; i++) {
    x += w[i] * dstPoly[i].x;
    y += w[i] * dstPoly[i].y;
  }

  return { x, y };
}