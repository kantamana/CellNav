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

import { cageCornerTurns, frameOf, orientedCage } from "../src/orient";
import { resolveBoundary } from "../src";

describe("corner fill only at smooth corners", () => {
  const turnsOf = (poly: { x: number; y: number }[], window = 15) =>
    cageCornerTurns(orientedCage(poly, frameOf(poly)), window).map((t) => (t * 180) / Math.PI);

  it("sees a rectangle's corners as real and an ellipse's as nearly straight", () => {
    const rect = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 200 }, { x: 0, y: 200 }];
    for (const t of turnsOf(rect)) expect(t).toBeGreaterThan(80);
    const ellipse = resolveBoundary("ellipse", 400, 200);
    for (const t of turnsOf(ellipse)) expect(t).toBeLessThan(12);
  });

  it("a corner rounded off by a few px still counts as a corner", () => {
    const r = 8;
    const round: { x: number; y: number }[] = [];
    for (const [cx, cy, a0] of [[400 - r, r, -90], [400 - r, 200 - r, 0], [r, 200 - r, 90], [r, r, 180]] as const)
      for (let i = 0; i <= 8; i++) {
        const a = ((a0 + (i / 8) * 90) * Math.PI) / 180;
        round.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
      }
    for (const t of turnsOf(round, 15)) expect(t).toBeGreaterThan(60);
  });

  const cellsWith = (shape: string, at?: "all" | "smooth") =>
    buildCells(
      {
        ...cellNav(["OH"]).size(400, 200).boundary(shape).margin(0).spec(),
        fill: { type: "text", cornerFill: 1, ...(at && { cornerFillAt: at }) },
      },
      font,
    )[0]!.label;

  it("changes nothing at a real corner (a rectangle)", () => {
    expect(cellsWith("rectangle", "smooth")).toEqual(cellsWith("rectangle", "smooth"));
    const plain = buildCells({ ...cellNav(["OH"]).size(400, 200).boundary("rectangle").margin(0).spec(), fill: { type: "text" } }, font)[0]!.label;
    expect(cellsWith("rectangle", "smooth")).toEqual(plain);
  });

  it("still fills where the cell is smooth (an ellipse), same as 'all'", () => {
    expect(cellsWith("ellipse", "smooth")).toEqual(cellsWith("ellipse", "all"));
    const none = buildCells({ ...cellNav(["OH"]).size(400, 200).boundary("ellipse").margin(0).spec(), fill: { type: "text" } }, font)[0]!.label;
    expect(cellsWith("ellipse", "smooth")).not.toEqual(none);
  });

  it("reads the attribute and the builder option", () => {
    expect(specFromAttributes({ items: "A", cornerFillAt: "smooth" }, []).fill).toMatchObject({ cornerFillAt: "smooth" });
    expect(specFromAttributes({ items: "A", cornerFillAt: "nonsense" }, []).fill).not.toHaveProperty("cornerFillAt");
  });
});

describe("corner fill at the word's ends (prevent-glitch)", () => {
  // Three round letters in a row: left, middle, right.
  const three = {
    getPath: () => ({ commands: [...circle(10, 10), ...circle(30, 10), ...circle(50, 10)] }),
    getPaths: () => [{ commands: circle(10, 10) }, { commands: circle(30, 10) }, { commands: circle(50, 10) }],
  } as unknown as Font;
  const one = {
    getPath: () => ({ commands: circle(10, 10) }),
    getPaths: () => [{ commands: circle(10, 10) }],
  } as unknown as Font;

  const label = (f: Font, word: string, at: "all" | "smooth" | "prevent-glitch", shape = "rectangle") =>
    buildCells(
      { ...cellNav([word]).size(600, 200).boundary(shape).margin(0).spec(), fill: { type: "text", cornerFill: 1, cornerFillAt: at } },
      f,
    )[0]!.label;

  // Gap from a point to the nearest ink of one contour.
  const gap = (c: { x: number; y: number }[], x: number, y: number) =>
    Math.min(...c.map((p) => Math.hypot(p.x - x, p.y - y)));

  it("squares only the outer corners of the first and last letters", () => {
    const none = buildCells({ ...cellNav(["OOO"]).size(600, 200).boundary("rectangle").margin(0).spec(), fill: { type: "text" } }, three)[0]!.label;
    const ends = label(three, "OOO", "prevent-glitch");
    const all = label(three, "OOO", "all");
    // contours: 0 = left letter, 1 = middle, 2 = right.
    expect(ends[1]).toEqual(none[1]); // middle letter untouched
    expect(all[1]).not.toEqual(none[1]); // ...whereas "all" does move it
    // the left letter's left corners moved, its right corners did not
    const [l0, l1] = [none[0]!, ends[0]!];
    const before = (x: number, y: number) => gap(l0, x, y);
    const after = (x: number, y: number) => gap(l1, x, y);
    const top = Math.min(...l0.map((p) => p.y));
    const left = Math.min(...l0.map((p) => p.x));
    const right = Math.max(...l0.map((p) => p.x));
    expect(after(left, top)).toBeLessThan(before(left, top) * 0.3); // outer corner filled
    // The inner corner is not pushed for; it only feels the smooth blend from the outer one.
    expect(after(right, top)).toBeGreaterThan(before(right, top) * 0.75);
  });

  it("treats a one-letter word as having both ends", () => {
    const none = buildCells({ ...cellNav(["O"]).size(600, 200).boundary("rectangle").margin(0).spec(), fill: { type: "text" } }, one)[0]!.label;
    expect(label(one, "O", "prevent-glitch")).toEqual(label(one, "O", "all"));
    expect(label(one, "O", "prevent-glitch")).not.toEqual(none);
  });

  it("reads the attribute", () => {
    expect(specFromAttributes({ items: "A", cornerFillAt: "prevent-glitch" }, []).fill).toMatchObject({ cornerFillAt: "prevent-glitch" });
  });
});
