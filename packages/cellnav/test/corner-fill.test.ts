import { describe, expect, it } from "vitest";
import { buildCells, cellNav, textContours, type Font } from "../src";
import { specFromAttributes } from "../src/attributes";

type Cmd = { type: string; x?: number; y?: number };
const circle = (cx: number, r: number): Cmd[] => {
  const c: Cmd[] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    c.push({ type: i ? "L" : "M", x: cx + r * Math.cos(a), y: r * Math.sin(a) });
  }
  return [...c, { type: "Z" }];
};
const box = (x0: number, w: number, h: number): Cmd[] => [
  { type: "M", x: x0, y: 0 },
  { type: "L", x: x0 + w, y: 0 },
  { type: "L", x: x0 + w, y: h },
  { type: "L", x: x0, y: h },
  { type: "Z" },
];
// An "O" (a circle) next to an "H" (a rectangle), one path per letter.
const O = circle(10, 10);
const H = box(30, 20, 20);
const font = {
  getPath: () => ({ commands: [...O, ...H] }),
  getPaths: () => [{ commands: O }, { commands: H }],
} as unknown as Font;

const inkBounds = (cs: { x: number; y: number }[][]) => {
  const p = cs.flat();
  return { minX: Math.min(...p.map((q) => q.x)), maxX: Math.max(...p.map((q) => q.x)) };
};
// Distance from the letter's own top-left box corner to the nearest ink point.
const gapAt = (cs: { x: number; y: number }[][], x0: number, y0: number) =>
  Math.min(...cs.flat().map((p) => Math.hypot(p.x - x0, p.y - y0)));

describe("corner fill is off by default", () => {
  const spec = (cornerFill?: number) => ({
    ...cellNav(["OH"]).spec(),
    fill: { type: "text" as const, ...(cornerFill !== undefined && { cornerFill }) },
  });
  const label = (cornerFill?: number) => buildCells(spec(cornerFill), font)[0]!.label;
  it("matches an explicit 0 and differs from 1", () => {
    expect(label()).toEqual(label(0));
    expect(label()).not.toEqual(label(1));
  });
});

describe("corner fill", () => {
  const off = textContours(font, "OH", { width: 400, height: 200 });
  const on = textContours(font, "OH", { width: 400, height: 200, cornerFill: 1 });

  it("at 0 nothing moves", () => {
    expect(textContours(font, "OH", { width: 400, height: 200, cornerFill: 0 })).toEqual(off);
  });

  it("pushes a round letter into its corners", () => {
    // The O is the first 20/50 of the word's width (0..0.4); its top-left corner is (0, 2/3).
    const before = gapAt(off.slice(0, 1), 0, 2 / 3);
    const after = gapAt(on.slice(0, 1), 0, 2 / 3);
    expect(after).toBeLessThan(before * 0.2);
  });

  it("leaves a straight letter exactly as it was", () => {
    expect(on[1]).toEqual(off[1]);
  });

  it("keeps everything inside the unit square", () => {
    for (const c of on) for (const p of c) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x).toBeLessThanOrEqual(1 + 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeLessThanOrEqual(1 + 1e-9);
    }
    expect(inkBounds(on).maxX).toBeCloseTo(inkBounds(off).maxX, 6);
  });

  it("half the amount moves it about half as far", () => {
    const half = textContours(font, "OH", { width: 400, height: 200, cornerFill: 0.5 });
    const g0 = gapAt(off.slice(0, 1), 0, 2 / 3);
    const g1 = gapAt(half.slice(0, 1), 0, 2 / 3);
    const g2 = gapAt(on.slice(0, 1), 0, 2 / 3);
    expect(g1).toBeLessThan(g0);
    expect(g1).toBeGreaterThan(g2);
  });

  it("works through the attribute and the builder", () => {
    expect(specFromAttributes({ items: "A", cornerFill: "1" }, []).fill).toMatchObject({ cornerFill: 1 });
    expect(specFromAttributes({ items: "A", cornerFill: "0" }, []).fill).toMatchObject({ cornerFill: 0 });
    expect(specFromAttributes({ items: "A" }, []).fill).not.toHaveProperty("cornerFill");
    const spec = cellNav(["A"]).fill({ type: "text", cornerFill: 1 }).spec();
    expect(buildCells(spec, font)).toHaveLength(1);
  });
});
