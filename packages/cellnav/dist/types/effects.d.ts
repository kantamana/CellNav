import type { Item } from "./cells";
import type { Point } from "./geometry";
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
export declare const NOISE_PRESETS: {
    readonly jitter: {
        readonly amount: 3;
        readonly scale: 10;
        readonly speed: 6;
    };
    readonly wobble: {
        readonly amount: 6;
        readonly scale: 60;
        readonly speed: 0.4;
    };
};
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
export type EffectFactory = (spec: EffectSpec, context: {
    seed: number;
}) => EffectImpl;
export declare const effectRegistry: Map<string, EffectFactory>;
/** Adds an effect type that specs can then use by name. */
export declare function registerEffect(type: string, factory: EffectFactory): void;
export declare function createEffect(spec: EffectSpec, context: {
    seed: number;
}): EffectImpl;
export interface SelectionState {
    /** Indices of cells under the pointer or holding keyboard focus. */
    hovered: ReadonlySet<number>;
    /** Index of the current item, if any. */
    active: number | undefined;
}
/** Whether the effect applies to cell `index` right now. */
export declare function isSelected(on: readonly string[], index: number, items: readonly Item[], state: SelectionState): boolean;
/**
 * One step of easing a cell's effect strength (0 to 1) towards its goal.
 * Smooth, never overshoots, and takes no time at all if `easeMs` is 0.
 */
export declare function stepWeight(weight: number, goal: number, dtMs: number, easeMs: number): number;
/** Adds points so that no straight stretch is longer than `maxSegment`. */
export declare function resample(points: Point[], maxSegment: number, closed?: boolean): Point[];
