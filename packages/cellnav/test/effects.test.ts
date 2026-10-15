import { afterEach, describe, expect, it } from "vitest";
import {
  createEffect,
  effectRegistry,
  isSelected,
  mulberry32,
  registerEffect,
  resample,
  stepWeight,
  type Item,
  type SelectionState,
} from "../src";
import { createNoise } from "../src/noise";

const rng = mulberry32(99);
const samples = (n: number, size = 50) =>
  Array.from({ length: n }, () => ({ x: rng() * size, y: rng() * size, z: rng() * size }));

describe("Perlin noise", () => {
  const field = createNoise(1);
  const pts = samples(20000);
  const values = pts.map((p) => field(p.x, p.y, p.z));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);

  it("is the same every time for a seed, and differs between seeds", () => {
    const again = createNoise(1);
    expect(pts.slice(0, 50).map((p) => again(p.x, p.y, p.z))).toEqual(values.slice(0, 50));
    const other = createNoise(2);
    expect(pts.slice(0, 50).map((p) => other(p.x, p.y, p.z))).not.toEqual(values.slice(0, 50));
  });

  it("stays within -1 and 1 and is centred on 0 (unlike p5's 0 to 1)", () => {
    expect(Math.min(...values)).toBeGreaterThanOrEqual(-1);
    expect(Math.max(...values)).toBeLessThanOrEqual(1);
    expect(Math.abs(mean)).toBeLessThan(0.02);
    expect(sd).toBeGreaterThan(0.2);
    expect(sd).toBeLessThan(0.35);
  });

  it("changes smoothly: nearby points get nearby values, in space and in time", () => {
    const eps = 0.01;
    for (const p of pts.slice(0, 500)) {
      const v = field(p.x, p.y, p.z);
      expect(Math.abs(field(p.x + eps, p.y, p.z) - v)).toBeLessThan(eps * 4);
      expect(Math.abs(field(p.x, p.y + eps, p.z) - v)).toBeLessThan(eps * 4);
      expect(Math.abs(field(p.x, p.y, p.z + eps) - v)).toBeLessThan(eps * 4);
    }
  });

  it("does not collapse to zero at whole numbers", () => {
    const zeros = [0, 1, 2, 3, 4, 5].filter((i) => field(i, i, i) === 0);
    expect(zeros).toHaveLength(0);
  });
});

describe("the noise effect", () => {
  const make = (spec: object, seed = 1) => createEffect({ type: "noise", ...spec }, { seed });
  const pts = samples(400, 400);
  const peak = (e: ReturnType<typeof make>, t = 0) =>
    Math.max(...pts.flatMap((p) => [Math.abs(e.displace(p, t).x), Math.abs(e.displace(p, t).y)]));
  const rough = (e: ReturnType<typeof make>) => {
    // How much the displacement differs between points 3px apart.
    let sum = 0;
    for (const p of pts) {
      const a = e.displace(p, 0);
      const b = e.displace({ x: p.x + 3, y: p.y }, 0);
      sum += Math.hypot(a.x - b.x, a.y - b.y);
    }
    return sum / pts.length;
  };

  it("never moves a point further than `amount` along either axis", () => {
    for (const amount of [1, 4, 10]) expect(peak(make({ amount }))).toBeLessThanOrEqual(amount + 1e-9);
  });

  it("really uses its range: the typical big move is a good part of `amount`", () => {
    expect(peak(make({ amount: 10 }))).toBeGreaterThan(5);
  });

  it("amount 0 does nothing at all", () => {
    expect(peak(make({ amount: 0 }))).toBe(0);
  });

  it("holds still when speed is 0, and changes with time when it is not", () => {
    const frozen = make({ speed: 0 });
    const live = make({ speed: 2 });
    const p = { x: 123, y: 45 };
    expect(frozen.displace(p, 0)).toEqual(frozen.displace(p, 99));
    expect(live.displace(p, 0)).not.toEqual(live.displace(p, 0.5));
    expect(frozen.animated).toBe(false);
    expect(live.animated).toBe(true);
  });

  it("is smoother over a larger scale", () => {
    expect(rough(make({ scale: 80, amount: 6 }))).toBeLessThan(rough(make({ scale: 6, amount: 6 })));
  });

  it("moves points in the same place the same way, wherever they come from", () => {
    const e = make({ speed: 1 });
    expect(e.displace({ x: 10, y: 20 }, 1.5)).toEqual(e.displace({ x: 10, y: 20 }, 1.5));
  });

  it("has a default look, two presets, and lets options override a preset", () => {
    const d = make({});
    expect(d.animated).toBe(false);
    expect(make({ preset: "jitter" }).animated).toBe(true);
    expect(make({ preset: "wobble" }).animated).toBe(true);
    // jitter is the small fast look, wobble the big slow one
    expect(peak(make({ preset: "jitter" }))).toBeLessThan(peak(make({ preset: "wobble" })));
    expect(make({ preset: "jitter", speed: 0 }).animated).toBe(false);
    expect(peak(make({ preset: "wobble", amount: 1 }))).toBeLessThanOrEqual(1 + 1e-9);
  });

  it("ignores nonsense numbers rather than producing NaN", () => {
    const e = make({ amount: "big", scale: NaN, speed: -3 });
    const d = e.displace({ x: 5, y: 5 }, 1);
    expect(Number.isFinite(d.x) && Number.isFinite(d.y)).toBe(true);
    expect(e.animated).toBe(false);
  });

  it("follows the layout seed unless given its own, and 'random' differs each time", () => {
    const p = { x: 31, y: 17 };
    expect(make({}, 5).displace(p, 0)).toEqual(make({}, 5).displace(p, 0));
    expect(make({}, 5).displace(p, 0)).not.toEqual(make({}, 6).displace(p, 0));
    expect(make({ seed: 9 }, 5).displace(p, 0)).toEqual(make({ seed: 9 }, 6).displace(p, 0));
    expect(make({ seed: "random" }).displace(p, 0)).not.toEqual(make({ seed: "random" }).displace(p, 0));
  });

  it("moves the letters by default, and the outlines or both when asked", () => {
    expect(make({})).toMatchObject({ text: true, cells: false });
    expect(make({ target: "text" })).toMatchObject({ text: true, cells: false });
    expect(make({ target: "cells" })).toMatchObject({ text: false, cells: true });
    expect(make({ target: "both" })).toMatchObject({ text: true, cells: true });
  });

  it("applies to all cells by default, and takes a name, a list, or ids", () => {
    expect(make({}).on).toEqual(["all"]);
    expect(make({ on: "hover" }).on).toEqual(["hover"]);
    expect(make({ on: ["hover", " about "] }).on).toEqual(["hover", "about"]);
  });

  it("asks for finer points when the wobbles are small", () => {
    expect(make({ scale: 12 }).detail).toBeLessThan(make({ scale: 120 }).detail);
    expect(make({ scale: 1 }).detail).toBeGreaterThanOrEqual(3);
  });
});

describe("adding effects", () => {
  afterEach(() => effectRegistry.delete("shift"));

  it("complains about an unknown effect and names the ones that exist", () => {
    expect(() => createEffect({ type: "sparkle" }, { seed: 1 })).toThrow(/Unknown effect "sparkle".*noise/);
  });

  it("runs an effect someone registered, by name", () => {
    registerEffect("shift", (spec) => ({
      text: true,
      cells: false,
      on: ["all"],
      ease: 0,
      detail: 5,
      animated: false,
      displace: (p) => ({ x: p.x + Number(spec.by ?? 1), y: p.y }),
    }));
    const e = createEffect({ type: "shift", by: 7 }, { seed: 1 });
    expect(e.displace({ x: 1, y: 2 }, 0)).toEqual({ x: 8, y: 2 });
  });
});

describe("which cells an effect applies to", () => {
  const items: Item[] = ["home", "about", "blog"].map((id) => ({ id, label: id, href: "#" + id }));
  const state = (hovered: number[] = [], active?: number): SelectionState => ({
    hovered: new Set(hovered),
    active,
  });

  it("'all' picks every cell", () => {
    for (const i of [0, 1, 2]) expect(isSelected(["all"], i, items, state())).toBe(true);
  });

  it("'hover' picks only the cell under the pointer or holding focus", () => {
    const s = state([1]);
    expect([0, 1, 2].map((i) => isSelected(["hover"], i, items, s))).toEqual([false, true, false]);
    expect([0, 1, 2].map((i) => isSelected(["hover"], i, items, state()))).toEqual([false, false, false]);
  });

  it("'active' picks the current item", () => {
    expect([0, 1, 2].map((i) => isSelected(["active"], i, items, state([], 2)))).toEqual([false, false, true]);
    expect(isSelected(["active"], 0, items, state())).toBe(false);
  });

  it("item ids pick those items", () => {
    expect([0, 1, 2].map((i) => isSelected(["about", "blog"], i, items, state()))).toEqual([false, true, true]);
  });

  it("any of several reasons is enough", () => {
    const s = state([0], 2);
    expect([0, 1, 2].map((i) => isSelected(["hover", "active"], i, items, s))).toEqual([true, false, true]);
  });
});

describe("fading an effect in and out", () => {
  it("moves towards the goal and never overshoots", () => {
    for (const [from, to] of [[0, 1], [1, 0], [0.3, 0.8]] as const) {
      let w: number = from;
      let last = Math.abs(to - w);
      for (let i = 0; i < 200; i++) {
        w = stepWeight(w, to, 16, 200);
        expect(Math.abs(to - w)).toBeLessThanOrEqual(last + 1e-12);
        expect(w).toBeGreaterThanOrEqual(Math.min(from, to) - 1e-12);
        expect(w).toBeLessThanOrEqual(Math.max(from, to) + 1e-12);
        last = Math.abs(to - w);
      }
      expect(w).toBe(to);
    }
  });

  it("takes about the requested time", () => {
    let w = 0;
    for (let ms = 0; ms < 200; ms += 16) w = stepWeight(w, 1, 16, 200);
    expect(w).toBeGreaterThan(0.9);
    expect(w).toBeLessThan(1);
    let early = 0;
    for (let ms = 0; ms < 32; ms += 16) early = stepWeight(early, 1, 16, 200);
    expect(early).toBeLessThan(0.5);
  });

  it("is instant with no easing, and does nothing when no time passes", () => {
    expect(stepWeight(0, 1, 16, 0)).toBe(1);
    expect(stepWeight(1, 0, 16, 0)).toBe(0);
    expect(stepWeight(0.4, 1, 0, 200)).toBeCloseTo(0.4, 9);
  });

  it("gives the same result whether time arrives in one step or several", () => {
    let a = 0;
    a = stepWeight(a, 1, 100, 200);
    let b = 0;
    for (let i = 0; i < 10; i++) b = stepWeight(b, 1, 10, 200);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("adding points so edges can move smoothly", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  const longest = (pts: { x: number; y: number }[], closed: boolean) =>
    Math.max(
      ...pts
        .slice(0, closed ? pts.length : -1)
        .map((a, i) => Math.hypot(pts[(i + 1) % pts.length]!.x - a.x, pts[(i + 1) % pts.length]!.y - a.y)),
    );

  it("leaves no stretch longer than asked, and keeps every original corner", () => {
    const out = resample(square, 7);
    expect(longest(out, true)).toBeLessThanOrEqual(7 + 1e-9);
    for (const c of square) expect(out).toContainEqual(c);
    expect(out.length).toBe(4 * Math.ceil(100 / 7));
  });

  it("changes nothing when the edges are already short enough", () => {
    expect(resample(square, 500)).toEqual(square);
  });

  it("keeps the end of an open path", () => {
    const open = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const out = resample(open, 3, false);
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 10, y: 0 });
    expect(longest(out, false)).toBeLessThanOrEqual(3 + 1e-9);
  });

  it("copes with an empty list", () => {
    expect(resample([], 5)).toEqual([]);
  });
});

describe('noise that keeps area ("x from y, y from x")', () => {
  const shoelace = (pts: { x: number; y: number }[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s / 2);
  };
  const bar = (x: number, y: number, w: number, h: number) => [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
  const circle = (cx: number, cy: number, r = 40, n = 600) =>
    Array.from({ length: n }, (_, i) => ({
      x: cx + r * Math.cos((2 * Math.PI * i) / n),
      y: cy + r * Math.sin((2 * Math.PI * i) / n),
    }));

  const same = (spec: object = {}, seed = 1) => createEffect({ type: "noise", preserve: "area", ...spec }, { seed });
  const free = (spec: object = {}, seed = 1) => createEffect({ type: "noise", ...spec }, { seed });

  // How much the area of a shape changes, averaged over many places and moments.
  const change = (
    e: ReturnType<typeof same>,
    shape: (x: number, y: number) => { x: number; y: number }[],
    strength = 1,
  ) => {
    const r = mulberry32(7);
    let sum = 0;
    let worst = 0;
    const n = 80;
    for (let k = 0; k < n; k++) {
      const base = resample(shape(r() * 600, r() * 600), Math.max(3, e.detail));
      const t = r() * 20;
      const moved = base.map((p) => {
        const d = e.displace(p, t);
        return { x: p.x + d.x * strength, y: p.y + d.y * strength };
      });
      const c = Math.abs(shoelace(moved) / shoelace(base) - 1);
      sum += c;
      worst = Math.max(worst, c);
    }
    return { mean: sum / n, worst };
  };
  const stroke = (x: number, y: number) => bar(x, y, 8, 60);
  const combos = [
    { amount: 4, scale: 12, speed: 1 },
    { amount: 3, scale: 10, speed: 2 },
    { amount: 6, scale: 30, speed: 0 },
  ];

  it("moves x by the noise of y, and y by the noise of x", () => {
    const e = same({ speed: 1 });
    const r = mulberry32(11);
    for (let i = 0; i < 100; i++) {
      const a = { x: r() * 500, y: r() * 500 };
      // same y: same sideways move, whatever x is
      expect(e.displace({ x: a.x + 123, y: a.y }, 2).x).toBeCloseTo(e.displace(a, 2).x, 12);
      // same x: same up-and-down move, whatever y is
      expect(e.displace({ x: a.x, y: a.y + 321 }, 2).y).toBeCloseTo(e.displace(a, 2).y, 12);
    }
  });

  it("uses the very same noise in both directions", () => {
    const e = same({ speed: 1 });
    const r = mulberry32(12);
    for (let i = 0; i < 100; i++) {
      const u = r() * 500;
      const v = r() * 500;
      // the sideways move at height v equals the up-and-down move at distance v across
      expect(e.displace({ x: u, y: v }, 1.5).x).toBeCloseTo(e.displace({ x: v, y: u }, 1.5).y, 12);
    }
  });

  it("free noise does not have that structure", () => {
    const e = free({ speed: 1 });
    expect(e.displace({ x: 10 + 200, y: 40 }, 2).x).not.toBeCloseTo(e.displace({ x: 10, y: 40 }, 2).x, 3);
  });

  it.each(combos)("keeps a thin stroke's area (amount $amount, scale $scale)", (c) => {
    const kept = change(same(c), stroke);
    expect(kept.mean).toBeLessThan(0.02);
    expect(kept.worst).toBeLessThan(0.08);
  });

  it.each(combos)("free noise changes it many times as much (amount $amount, scale $scale)", (c) => {
    expect(change(free(c), stroke).mean).toBeGreaterThan(change(same(c), stroke).mean * 5);
  });

  it("keeps a wider stroke, a round shape and a whole cell too", () => {
    const e = same({ amount: 4, scale: 12, speed: 1 });
    expect(change(e, (x, y) => bar(x, y, 14, 90)).mean).toBeLessThan(0.01);
    expect(change(e, (x, y) => circle(x + 40, y + 40)).worst).toBeLessThan(0.03);
    expect(change(e, (x, y) => bar(x, y, 300, 120)).worst).toBeLessThan(0.005);
  });

  it("keeps it while a cell fades the effect in or out", () => {
    for (const strength of [0.25, 0.5, 0.75]) {
      expect(change(same({ amount: 4, scale: 12, speed: 1 }), stroke, strength).mean).toBeLessThan(0.02);
    }
  });

  it("never moves a point further than `amount` along either axis", () => {
    const e = same({ amount: 5 });
    const r = mulberry32(13);
    for (let i = 0; i < 2000; i++) {
      const d = e.displace({ x: r() * 800, y: r() * 800 }, r() * 10);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(5 + 1e-9);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("amount 0 does nothing; speed 0 holds still; speed above 0 moves", () => {
    const p = { x: 55, y: 66 };
    const still = same({ amount: 0 }).displace(p, 3);
    expect(still.x).toBeCloseTo(0, 12); // may be -0, which is the same thing here
    expect(still.y).toBeCloseTo(0, 12);
    expect(same({ speed: 0 }).displace(p, 0)).toEqual(same({ speed: 0 }).displace(p, 50));
    expect(same({ speed: 2 }).displace(p, 0)).not.toEqual(same({ speed: 2 }).displace(p, 0.7));
    expect(same({ speed: 2 }).animated).toBe(true);
  });

  it("is the same every time for a seed, and different for another", () => {
    const p = { x: 55, y: 66 };
    expect(same({}, 4).displace(p, 0)).toEqual(same({}, 4).displace(p, 0));
    expect(same({}, 4).displace(p, 0)).not.toEqual(same({}, 5).displace(p, 0));
  });

  it("works with the presets, targets, selection and fading like the free mode", () => {
    const e = same({ preset: "jitter", target: "both", on: ["hover"], ease: 350 });
    expect(e).toMatchObject({ text: true, cells: true, on: ["hover"], ease: 350, animated: true });
    expect(e.detail).toBe(free({ preset: "jitter" }).detail);
  });
});

describe("noise size: bigger without getting steeper", () => {
  const make = (spec: object = {}, seed = 1) => createEffect({ type: "noise", ...spec }, { seed });
  const shared = (spec: object = {}, seed = 1) => createEffect({ type: "noise", preserve: "area", ...spec }, { seed });
  const r = mulberry32(21);
  const pts = Array.from({ length: 300 }, () => ({ x: r() * 400, y: r() * 400 }));

  // The same field seen from k times as far away: moves are k times longer and
  // the wobbles k times wider, so the shape of the wobble does not change.
  it.each([0.5, 2, 3.5])("size %s is the size-1 wobble zoomed by that factor", (k) => {
    for (const build of [make, shared]) {
      const base = build({ amount: 4, scale: 12, speed: 1 });
      const big = build({ amount: 4, scale: 12, speed: 1, size: k });
      for (const p of pts) {
        const want = base.displace({ x: p.x / k, y: p.y / k }, 1.7);
        const got = big.displace(p, 1.7);
        expect(got.x).toBeCloseTo(want.x * k, 9);
        expect(got.y).toBeCloseTo(want.y * k, 9);
      }
    }
  });

  it("moves points further but not at a steeper angle", () => {
    // slope = how much the move changes over a short step, relative to the step
    const slope = (e: ReturnType<typeof make>) => {
      let sum = 0;
      for (const p of pts) {
        const a = e.displace(p, 0);
        const b = e.displace({ x: p.x + 0.5, y: p.y }, 0);
        sum += Math.hypot(b.x - a.x, b.y - a.y) / 0.5;
      }
      return sum / pts.length;
    };
    const reach = (e: ReturnType<typeof make>) => Math.max(...pts.map((p) => Math.abs(e.displace(p, 0).x)));
    const one = make({ amount: 4, scale: 12 });
    const three = make({ amount: 4, scale: 12, size: 3 });
    expect(reach(three)).toBeGreaterThan(reach(one) * 2.5);
    expect(slope(three) / slope(one)).toBeGreaterThan(0.9);
    expect(slope(three) / slope(one)).toBeLessThan(1.1);
    // raising `amount` alone does get steeper: that is the problem size solves
    const louder = make({ amount: 12, scale: 12 });
    expect(slope(louder) / slope(one)).toBeGreaterThan(2.5);
  });

  it("size 1 changes nothing", () => {
    const p = { x: 31, y: 77 };
    expect(make({ size: 1 }).displace(p, 0.4)).toEqual(make({}).displace(p, 0.4));
  });

  it("works on top of a preset", () => {
    const j = make({ preset: "jitter" });
    const j2 = make({ preset: "jitter", size: 2 });
    const p = { x: 40, y: 60 };
    expect(j2.displace(p, 1).x).toBeCloseTo(2 * j.displace({ x: 20, y: 30 }, 1).x, 9);
  });

  it("asks for coarser points when the wobbles are wider", () => {
    expect(make({ size: 4 }).detail).toBeGreaterThan(make({}).detail);
  });

  it("copes with sizes that make no sense", () => {
    for (const size of [0, -3, NaN, "big"]) {
      const d = make({ size }).displace({ x: 9, y: 9 }, 1);
      expect(Number.isFinite(d.x) && Number.isFinite(d.y)).toBe(true);
    }
    // a size of zero or less falls back to a tiny wobble, not a huge one
    expect(Math.abs(make({ size: 0 }).displace({ x: 9, y: 9 }, 1).x)).toBeLessThan(1);
    expect(Math.abs(make({ size: 1e9 }).displace({ x: 9, y: 9 }, 1).x)).toBeLessThan(4 * 50 + 1);
  });
});

describe('the opposite: noise that swells and pinches ("x from x, y from y")', () => {
  const shoelace = (pts: { x: number; y: number }[]) => {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % pts.length]!;
      s += a.x * b.y - b.x * a.y;
    }
    return Math.abs(s / 2);
  };
  const stroke = (x: number, y: number) => [
    { x, y },
    { x: x + 8, y },
    { x: x + 8, y: y + 60 },
    { x, y: y + 60 },
  ];
  const build = (mode?: string, spec: object = {}, seed = 1) =>
    createEffect({ type: "noise", ...(mode && { mode }), ...spec }, { seed });

  const meanChange = (e: ReturnType<typeof build>) => {
    const r = mulberry32(7);
    let sum = 0;
    for (let k = 0; k < 80; k++) {
      const base = resample(stroke(r() * 600, r() * 600), Math.max(3, e.detail));
      const t = r() * 20;
      const moved = base.map((p) => {
        const d = e.displace(p, t);
        return { x: p.x + d.x, y: p.y + d.y };
      });
      sum += Math.abs(shoelace(moved) / shoelace(base) - 1);
    }
    return sum / 80;
  };
  const settings = { amount: 4, scale: 12, speed: 1 };

  it("moves x by the noise of x, and y by the noise of y", () => {
    const e = build("swell", { speed: 1 });
    const r = mulberry32(31);
    for (let i = 0; i < 100; i++) {
      const a = { x: r() * 500, y: r() * 500 };
      // same x: same sideways move, whatever y is
      expect(e.displace({ x: a.x, y: a.y + 123 }, 2).x).toBeCloseTo(e.displace(a, 2).x, 12);
      // same y: same up-and-down move, whatever x is
      expect(e.displace({ x: a.x + 321, y: a.y }, 2).y).toBeCloseTo(e.displace(a, 2).y, 12);
    }
  });

  it("uses the very same noise in both directions", () => {
    const e = build("swell", { speed: 1 });
    const r = mulberry32(32);
    for (let i = 0; i < 100; i++) {
      const u = r() * 500;
      const v = r() * 500;
      // the sideways move at x = u equals the up-and-down move at y = u
      expect(e.displace({ x: u, y: v }, 1.5).x).toBeCloseTo(e.displace({ x: v, y: u }, 1.5).y, 12);
    }
  });

  it("is not the shear: the two modes move the same point differently", () => {
    const p = { x: 120, y: 340 };
    expect(build("swell").displace(p, 0)).not.toEqual(build("shear").displace(p, 0));
  });

  it("changes a thin stroke's area much more than shear, and more than free noise", () => {
    const swell = meanChange(build("swell", settings));
    expect(swell).toBeGreaterThan(meanChange(build("shear", settings)) * 10);
    expect(swell).toBeGreaterThan(meanChange(build(undefined, settings)));
    expect(swell).toBeGreaterThan(0.05);
  });

  it("never moves a point further than `amount` along either axis", () => {
    const e = build("swell", { amount: 5 });
    const r = mulberry32(33);
    for (let i = 0; i < 2000; i++) {
      const d = e.displace({ x: r() * 800, y: r() * 800 }, r() * 10);
      expect(Math.abs(d.x)).toBeLessThanOrEqual(5 + 1e-9);
      expect(Math.abs(d.y)).toBeLessThanOrEqual(5 + 1e-9);
    }
  });

  it("holds still at speed 0, moves with speed, and follows the seed", () => {
    const p = { x: 55, y: 66 };
    expect(build("swell", { speed: 0 }).displace(p, 0)).toEqual(build("swell", { speed: 0 }).displace(p, 50));
    expect(build("swell", { speed: 2 }).displace(p, 0)).not.toEqual(build("swell", { speed: 2 }).displace(p, 0.7));
    expect(build("swell", {}, 4).displace(p, 0)).toEqual(build("swell", {}, 4).displace(p, 0));
    expect(build("swell", {}, 4).displace(p, 0)).not.toEqual(build("swell", {}, 5).displace(p, 0));
  });

  it("zooms with `size` like the other modes", () => {
    const base = build("swell", { amount: 4, scale: 12, speed: 1 });
    const big = build("swell", { amount: 4, scale: 12, speed: 1, size: 3 });
    for (const p of [{ x: 90, y: 30 }, { x: 410, y: 250 }, { x: 5, y: 700 }]) {
      const want = base.displace({ x: p.x / 3, y: p.y / 3 }, 1.2);
      expect(big.displace(p, 1.2).x).toBeCloseTo(want.x * 3, 9);
      expect(big.displace(p, 1.2).y).toBeCloseTo(want.y * 3, 9);
    }
  });

  it("keeps the same targets, selection and fading as the other modes", () => {
    const e = build("swell", { preset: "jitter", target: "both", on: ["hover"], ease: 350 });
    expect(e).toMatchObject({ text: true, cells: true, on: ["hover"], ease: 350, animated: true });
  });

  it("the older `preserve: area` still means shear", () => {
    const p = { x: 70, y: 19 };
    expect(createEffect({ type: "noise", preserve: "area" }, { seed: 1 }).displace(p, 0)).toEqual(
      build("shear").displace(p, 0),
    );
  });

  it("an unknown mode falls back to the default", () => {
    const p = { x: 70, y: 19 };
    expect(build("twist").displace(p, 0)).toEqual(build(undefined).displace(p, 0));
  });
});
