import type { Point } from "./geometry";

/** Mean value coordinates of `p` with respect to the cage `cage`. */
export function meanValueWeights(p: Point, cage: Point[]): number[] {
  const n = cage.length;
  const w = new Array<number>(n).fill(0);
  const s = cage.map((v) => ({ x: v.x - p.x, y: v.y - p.y }));
  const r = s.map((v) => Math.hypot(v.x, v.y));

  for (let i = 0; i < n; i++) {
    if (r[i]! < 1e-9) {
      w[i] = 1;
      return w;
    }
  }

  const tanHalf: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = s[i]!;
    const b = s[j]!;
    const cross = a.x * b.y - a.y * b.x;
    const dot = a.x * b.x + a.y * b.y;
    const ang = Math.atan2(cross, dot);
    // `p` lies on the edge i->j: interpolate linearly.
    if (Math.abs(cross) < 1e-9 && dot < 0) {
      const di = r[i]!;
      const dj = r[j]!;
      const out = new Array<number>(n).fill(0);
      out[i] = dj / (di + dj);
      out[j] = di / (di + dj);
      return out;
    }
    tanHalf.push(Math.tan(ang / 2));
  }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const prev = tanHalf[(i - 1 + n) % n]!;
    w[i] = (prev + tanHalf[i]!) / r[i]!;
    sum += w[i]!;
  }
  return w.map((x) => x / (sum || 1));
}

/** Maps points inside `source` onto the matching positions in `target`. */
export function cageWarp(source: Point[], target: Point[]) {
  return (p: Point): Point => {
    const w = meanValueWeights(p, source);
    let x = 0;
    let y = 0;
    for (let i = 0; i < w.length; i++) {
      x += w[i]! * target[i]!.x;
      y += w[i]! * target[i]!.y;
    }
    return { x, y };
  };
}
