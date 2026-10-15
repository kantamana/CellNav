import type { Item } from "./cells";
import type { Point } from "./geometry";
import { createNoise } from "./noise";

/** Which part of a cell an effect moves. "cells" is the outline. */
export type EffectTarget = "text" | "cells" | "both";

/**
 * An effect, as data. `type` names the effect; the rest is up to that effect.
 * `on` says which cells it applies to: "all" (default), "hover" (the cell
 * under the pointer or with keyboard focus), "active" (the current item), or
 * item ids. Give several as a list.
 */
export interface EffectSpec {
  type: string;
  target?: EffectTarget;
  on?: string | string[];
  /** Milliseconds a cell takes to fade an effect in or out. Default 200. */
  ease?: number;
  [option: string]: unknown;
}

export interface NoiseSpec extends EffectSpec {
  type: "noise";
  /** A starting look; the other options override it. */
  preset?: "jitter" | "wobble";
  /**
   * Zooms the whole wobble: moves and wave widths both grow by this factor, so
   * it gets bigger without getting steeper or spikier (`amount` alone makes it
   * steeper). Default 1.
   */
  size?: number;
  /** Typical largest move, in px. */
  amount?: number;
  /** Size of the wobbles, in px. */
  scale?: number;
  /** How fast it changes, in noise units a second. 0 holds it still. */
  speed?: number;
  seed?: number | "random";
  /**
   * How points move. Left out, x and y each get independent noise, which
   * crumples thin strokes a little.
   *  - "shear": x moves by the noise of y and y by the noise of x, one noise
   *    for both. A shape only slides sideways, so letters keep their ink to
   *    within a fraction of a percent.
   *  - "swell": the opposite. x moves by the noise of x and y by the noise of
   *    y, so each axis stretches and squeezes along itself and strokes pinch
   *    and bulge. It changes area more than any other mode.
   */
  mode?: "shear" | "swell";
  /** The earlier name for `mode: "shear"` (preserving area). */
  preserve?: "area";
}

export const NOISE_PRESETS = {
  // The prototype's look: small, quick, fine-grained.
  jitter: { amount: 3, scale: 10, speed: 6 },
  // Slow and large.
  wobble: { amount: 6, scale: 60, speed: 0.4 },
} as const;
const NOISE_DEFAULTS = { amount: 4, scale: 12, speed: 0 };

/** What a registered effect gives the runtime. */
export interface EffectImpl {
  /** Moves the letters. */
  text: boolean;
  /** Moves the outlines (also the picture clip and the hover outline). */
  cells: boolean;
  on: string[];
  ease: number;
  /** Longest straight stretch, in px, before a moving edge looks angular. */
  detail: number;
  /** True if it changes with time (so frames are needed while it is on). */
  animated: boolean;
  /** Where a point goes at full strength. `seconds` is the effect's clock. */
  displace(p: Point, seconds: number): Point;
}

export type EffectFactory = (spec: EffectSpec, context: { seed: number }) => EffectImpl;

export const effectRegistry = new Map<string, EffectFactory>();

/** Adds an effect type that specs can then use by name. */
export function registerEffect(type: string, factory: EffectFactory) {
  effectRegistry.set(type, factory);
}

export function createEffect(spec: EffectSpec, context: { seed: number }): EffectImpl {
  const factory = effectRegistry.get(spec.type);
  if (!factory) {
    throw new Error(
      `Unknown effect "${spec.type}". Known effects: ${[...effectRegistry.keys()].join(", ") || "none"}.`,
    );
  }
  return factory(spec, context);
}

const parts = (target: EffectTarget | undefined) => ({
  text: target === undefined || target === "text" || target === "both",
  cells: target === "cells" || target === "both",
});

const onList = (on: string | string[] | undefined) =>
  (Array.isArray(on) ? on : on ? [on] : ["all"]).map((s) => s.trim()).filter(Boolean);

const finite = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

// Raw Perlin noise rarely strays past +-0.6; this makes `amount` the typical peak.
const GAIN = 1.65;
const level = (v: number) => Math.max(-1, Math.min(1, v * GAIN));

registerEffect("noise", (raw, { seed }) => {
  const spec = raw as NoiseSpec;
  const base = { ...NOISE_DEFAULTS, ...(spec.preset ? NOISE_PRESETS[spec.preset] : {}) };
  const size = Math.min(50, Math.max(0.05, finite(spec.size, 1)));
  const amount = Math.max(0, finite(spec.amount, base.amount)) * size;
  const scale = Math.max(1, finite(spec.scale, base.scale)) * size;
  const speed = Math.max(0, finite(spec.speed, base.speed));
  const noiseSeed = spec.seed === "random" ? Math.floor(Math.random() * 2 ** 31) : finite(spec.seed, seed);
  const mode = spec.mode ?? (spec.preserve === "area" ? "shear" : "free");
  // Independent noise per axis, so a point does not just slide along a diagonal.
  const nx = createNoise(noiseSeed);
  const ny = createNoise(noiseSeed + 7919);

  return {
    ...parts(spec.target),
    on: onList(spec.on),
    ease: Math.max(0, finite(spec.ease, 200)),
    detail: Math.max(3, scale / 2),
    animated: speed > 0,
    // Noise depends only on position, so two points in the same place always
    // move together: neighbouring cells never pull apart.
    displace: (p, seconds) => {
      const z = seconds * speed;
      if (mode === "shear")
        // x from y, y from x, one noise for both (the prototype's shape)
        return { x: amount * level(nx(p.y / scale, 0, z)), y: amount * level(nx(p.x / scale, 0, z)) };
      if (mode === "swell")
        // x from x, y from y: the mirror image
        return { x: amount * level(nx(p.x / scale, 0, z)), y: amount * level(nx(p.y / scale, 0, z)) };
      return {
        x: amount * level(nx(p.x / scale, p.y / scale, z)),
        y: amount * level(ny(p.x / scale, p.y / scale, z)),
      };
    },
  };
});

export interface SelectionState {
  /** Indices of cells under the pointer or holding keyboard focus. */
  hovered: ReadonlySet<number>;
  /** Index of the current item, if any. */
  active: number | undefined;
}

/** Whether the effect applies to cell `index` right now. */
export function isSelected(
  on: readonly string[],
  index: number,
  items: readonly Item[],
  state: SelectionState,
): boolean {
  const id = items[index]?.id;
  return on.some((token) =>
    token === "all"
      ? true
      : token === "hover"
        ? state.hovered.has(index)
        : token === "active"
          ? state.active === index
          : token === id,
  );
}

/**
 * One step of easing a cell's effect strength (0 to 1) towards its goal.
 * Smooth, never overshoots, and takes no time at all if `easeMs` is 0.
 */
export function stepWeight(weight: number, goal: number, dtMs: number, easeMs: number): number {
  if (easeMs <= 0) return goal;
  const next = weight + (goal - weight) * (1 - Math.exp((-3 * dtMs) / easeMs));
  return Math.abs(goal - next) < 1e-3 ? goal : next;
}

/** Adds points so that no straight stretch is longer than `maxSegment`. */
export function resample(points: Point[], maxSegment: number, closed = true): Point[] {
  const out: Point[] = [];
  const last = closed ? points.length : points.length - 1;
  for (let i = 0; i < last; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    out.push(a);
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / maxSegment);
    for (let k = 1; k < n; k++)
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
  }
  if (!closed && points.length > 0) out.push(points[points.length - 1]!);
  return out;
}
