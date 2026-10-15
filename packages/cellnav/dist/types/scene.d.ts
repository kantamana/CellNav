import type { Cell } from "./cells";
/** The SVG parts of one cell that an effect can redraw. */
export interface SceneNodes {
    shape: SVGPathElement;
    ring: SVGPathElement;
    /** The clip for a picture, and the darkening layer over it. */
    clip?: SVGPathElement;
    scrim?: SVGPathElement;
    label?: SVGPathElement;
}
export interface Scene {
    cells: Cell[];
    nodes: SceneNodes[];
}
export interface Motion {
    stop(): void;
    /** Tells the effects which item is now current (for `on: "active"`). */
    setActive(id: string | undefined): void;
}
/** What was drawn into each navbar, so effects can find the parts again. */
export declare const scenes: WeakMap<SVGSVGElement, Scene>;
/** The motion running on each navbar, if any. */
export declare const motions: WeakMap<SVGSVGElement, Motion>;
