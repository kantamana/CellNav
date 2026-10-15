import opentype from "opentype.js";
import { describe, expect, it } from "vitest";
import { buildCells, cellNav, text, textContours, textInShape, type Font } from "../src";
import antonUrl from "../src/assets/Anton-Regular.ttf?inline";
import { specFromAttributes as readAttrs } from "../src/attributes";

// A font stub whose one glyph is a square with a rounded side: lines and curves.
const stub = (commands: object[]) => ({ getPath: () => ({ commands }) }) as unknown as Font;
const square = stub([
  { type: "M", x: 0, y: 0 },
  { type: "L", x: 20, y: 0 },
  { type: "L", x: 20, y: 10 },
  { type: "L", x: 0, y: 10 },
  { type: "Z" },
]);
// A half-disc: a straight edge and one big quadratic-curve arc.
const arc = stub([
  { type: "M", x: 0, y: 0 },
  { type: "L", x: 20, y: 0 },
  { type: "Q", x1: 10, y1: 40, x: 0, y: 0 },
  { type: "Z" },
]);

const dist = (a: { x: number; y: number }, b: { x: number; y: number }, w = 1, h = 1) =>
  Math.hypot((b.x - a.x) * w, (b.y - a.y) * h);
const longestStretch = (pts: { x: number; y: number }[], w: number, h: number) =>
  Math.max(...pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]!, w, h)));
const count = (contours: { x: number; y: number }[][]) => contours.reduce((s, c) => s + c.length, 0);

describe("letter outlines sampled for the size they are drawn at", () => {
  it("keeps the old coarse sampling when no size is given", () => {
    // 34 pieces along each unit-length edge (1 / 0.03, rounded up)
    expect(count(textContours(square, "A"))).toBe(4 * 34);
  });

  it.each([100, 300, 600, 1200])("no stretch is longer than 2.5px at %ipx", (size) => {
    const [c] = textContours(square, "A", { width: size, height: size });
    expect(longestStretch(c!, size, size)).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it("works for a box that is much wider than it is tall", () => {
    const [c] = textContours(square, "A", { width: 900, height: 60 });
    expect(longestStretch(c!, 900, 60)).toBeLessThanOrEqual(2.5 + 1e-9);
  });

  it("uses more points for a bigger shape and fewer for a smaller one", () => {
    const n = (s: number) => count(textContours(square, "A", { width: s, height: s }));
    expect(n(600)).toBeGreaterThan(n(300) * 1.8);
    expect(n(300)).toBeGreaterThan(n(100) * 2.5);
  });

  it("uses fewer points when the allowed stretch is longer", () => {
    const n = (px: number) => count(textContours(square, "A", { width: 600, height: 600, segmentPx: px }));
    expect(n(10)).toBeLessThan(n(2.5) / 3);
    expect(n(1000)).toBe(4); // just the corners
  });

  it("still fills the whole unit square, even when a curve's control point sticks out", () => {
    // The half-disc's control point is at y=40 but the curve itself only reaches y=20.
    for (const sized of [{}, { width: 400, height: 400 }]) {
      const pts = textContours(arc, "A", sized).flat();
      expect(Math.min(...pts.map((p) => p.x))).toBeCloseTo(0, 9);
      expect(Math.max(...pts.map((p) => p.x))).toBeCloseTo(1, 9);
      expect(Math.min(...pts.map((p) => p.y))).toBeCloseTo(0, 9);
      expect(Math.max(...pts.map((p) => p.y))).toBeCloseTo(1, 9);
    }
  });

  it("keeps every corner of the original outline", () => {
    const [c] = textContours(square, "A", { width: 400, height: 200 });
    for (const corner of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])
      expect(c).toContainEqual(corner);
  });

  it("caps how many points a single edge can get", () => {
    const [c] = textContours(square, "A", { width: 1e6, height: 1e6 });
    expect(c!.length).toBeLessThanOrEqual(4 * 1000);
  });

  describe("curves", () => {
    // Largest distance from the flattened outline to the true curve, in px.
    const flatness = (size: number) => {
      const [c] = textContours(arc, "A", { width: size, height: size })!;
      // true curve: quadratic from (20,0) via (10,40) to (0,0); unit coords = x/20, y/ (max y of the curve=20)
      const curve = Array.from({ length: 4000 }, (_, i) => {
        const t = i / 3999;
        const m = 1 - t;
        return { x: m * m * 20 + 2 * m * t * 10, y: 2 * m * t * 40 };
      });
      const ys = curve.map((p) => p.y);
      const maxY = Math.max(...ys);
      const unit = curve.map((p) => ({ x: p.x / 20, y: p.y / maxY }));
      let worst = 0;
      for (const p of c!) {
        if (p.y < 0.001) continue; // the straight base
        const d = Math.min(...unit.map((u) => dist(p, u, size, size)));
        worst = Math.max(worst, d);
      }
      return worst;
    };

    it("stay on the true curve, to a fraction of a pixel, at any size", () => {
      for (const size of [100, 300, 600]) expect(flatness(size)).toBeLessThan(0.35);
    });

    it("get more points for a bigger shape, never fewer than before", () => {
      const n = (s: number) => count(textContours(arc, "A", { width: s, height: s }));
      expect(n(600)).toBeGreaterThan(n(100));
      expect(n(5)).toBeGreaterThanOrEqual(10); // at least the old 10 steps
    });
  });
});

describe("outline detail in cells", () => {
  const spec = (detail?: number) =>
    cellNav(["A"])
      .size(600, 600)
      .boundary("circle")
      .margin(0)
      .fill(text({ padding: 6, ...(detail !== undefined && { detail }) }))
      .spec();

  it("a finer detail gives more points, a coarser one fewer", () => {
    const n = (d?: number) => count(buildCells(spec(d), square)[0]!.label);
    expect(n(1)).toBeGreaterThan(n(2.5) * 1.8);
    expect(n(10)).toBeLessThan(n(2.5) / 2.5);
  });

  it("the finished outline has no long stretches, wherever the word is bent to", () => {
    for (const shape of ["circle", "star", "heart", "triangle", "rounded"]) {
      const cell = buildCells(textInShape("A", shape).spec(), square)[0]!;
      for (const c of cell.label) expect(longestStretch(c, 1, 1)).toBeLessThan(10);
    }
  });

  it("a bent edge is smooth: with the old sampling the same word had stretches over 15px", () => {
    // The old fixed sampling cut every edge into pieces of 3% of the text box. In a 500px
    // shape that is 15px between points, which is what showed as corners on warped letters.
    const old = textContours(square, "A")[0]!;
    expect(longestStretch(old, 500, 500)).toBeGreaterThan(14);
    const cell = buildCells(textInShape("A", "circle", { width: 500, height: 500 }).spec(), square)[0]!;
    for (const c of cell.label) expect(longestStretch(c, 1, 1)).toBeLessThan(8);
  });
});

describe("text-detail in the tag and builder", () => {
  const read = (v: string | null) => readAttrs({ items: "A", textDetail: v }, []).fill;

  it("reads a positive number", () => {
    expect(read("1.5")).toEqual({ type: "text", detail: 1.5 });
  });
  it("ignores zero, negative and nonsense", () => {
    for (const v of ["0", "-2", "fine", "", null]) expect(read(v)).toEqual({ type: "text" });
  });
  it("is set by the builder and by textInShape", () => {
    expect(cellNav(["A"]).fill(text({ detail: 4 })).spec().fill).toEqual({ type: "text", detail: 4 });
    expect(textInShape("A", "star", { detail: 3 }).spec().fill).toMatchObject({ detail: 3 });
  });
});

describe("real letters in a real shape (Anton)", () => {
  // The font file as it ships in the bundle: a base64 data URL.
  const bytes = Uint8Array.from(atob(antonUrl.slice(antonUrl.indexOf("base64,") + 7)), (ch) => ch.charCodeAt(0));
  const anton = opentype.parse(bytes.buffer) as Font;

  it("LOVE in a heart is smooth, and not too heavy", () => {
    const t0 = performance.now();
    const cell = buildCells(textInShape("LOVE", "heart").spec(), anton)[0]!;
    const ms = performance.now() - t0;
    const points = count(cell.label);
    for (const c of cell.label) expect(longestStretch(c, 1, 1)).toBeLessThan(12);
    expect(points).toBeGreaterThan(1500); // well above the old fixed sampling at this size
    expect(points).toBeLessThan(30000);
    expect(ms).toBeLessThan(1500);
  });

  it("a navbar of seven words stays light", () => {
    const t0 = performance.now();
    const cells = buildCells(
      cellNav(["Home", "About", "Projects", "Blog", "Music", "Photos", "Contact"]).spec(),
      anton,
    );
    const ms = performance.now() - t0;
    expect(count(cells.flatMap((c) => c.label))).toBeLessThan(60000);
    expect(ms).toBeLessThan(1500);
  });
});
