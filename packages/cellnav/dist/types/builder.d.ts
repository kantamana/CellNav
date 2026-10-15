import { type Cell, type Item, type Spec } from "./cells";
import type { EffectSpec, NoiseSpec } from "./effects";
import type { RenderOptions } from "./render";
import type { Font } from "./text";
import type { VoronoiOptions } from "./voronoi";
type LayoutSpec = NonNullable<Spec["layout"]>;
type FillSpec = NonNullable<Spec["fill"]>;
/** Layout: one stretched Voronoi cell per item, from fixed seeds. */
export declare const voronoi: (opts?: VoronoiOptions) => LayoutSpec;
/**
 * Effect: Perlin-noise wobble on the letters, the cell outlines, or both.
 * `preset` is "jitter" (small and quick, like the prototype) or "wobble" (slow
 * and large); `amount` (px), `scale` (px) and `speed` (0 = frozen, the default)
 * override it, and `size` zooms the whole wobble without making it steeper. `on` picks the cells: "all", "hover", "active" or item ids.
 * `mode: "shear"` makes x move by the noise of y and y by the noise of x, which
 * keeps letters' ink almost exactly; `mode: "swell"` is the opposite, with
 * strokes pinching and bulging.
 * See NoiseSpec.
 */
export declare const noise: (opts?: Omit<NoiseSpec, "type">) => NoiseSpec;
/**
 * Fill: each item's picture (`image` on the item), clipped to its cell.
 * `aspectBlend` (0 to 1, default 0.5) leans each cell towards its picture's
 * proportions, and `shapeFit` (0 to 1, default 1) pushes it towards a
 * rectangle so more of the picture shows; `labels` is when the label shows ("hover", "always", "none").
 * Items without a picture fall back to a plain coloured cell with its label.
 */
export declare const image: (opts?: {
    aspectBlend?: number;
    shapeFit?: number;
    labels?: "hover" | "always" | "none";
    padding?: number;
}) => FillSpec;
/**
 * Fill: each item's label, bent to fill its cell. `warp` (0..1, default 1)
 * eases that off: 0 keeps the text upright in a plain rectangle. `padding`
 * (px, default 10) keeps the text off the cell walls. The letters follow the
 * cell's outline, curves included.
 */
export declare const text: (opts?: {
    warp?: number;
    padding?: number;
    /** "none": no cell background, the cell's colour goes on the text. */
    background?: "cell" | "none";
    /** Longest stretch of letter outline in px (default 2.5). */
    detail?: number;
    /** "spread": in a cell with dents, break the word across convex pieces like line breaks. */
    flow?: "outline" | "spread";
}) => FillSpec;
/**
 * Immutable fluent builder. Every method returns a new builder, and `.spec()`
 * returns the plain data it has built up: the builder is only sugar over it.
 */
export declare class CellNav {
    private readonly s;
    constructor(s: Spec);
    private with;
    size(width: number, height: number): CellNav;
    layout(layout: LayoutSpec): CellNav;
    fill(fill: FillSpec): CellNav;
    margin(px: number): CellNav;
    palette(colors: string[]): CellNav;
    /** A preset name ("ellipse", "hexagon", ...) or an SVG path (convex or concave). */
    boundary(boundary: string): CellNav;
    boundaryStroke(color: string): CellNav;
    /** Adds an effect. Effects stack, in the order they are added. */
    effect(effect: EffectSpec): CellNav;
    /** The current item: an item id, or "auto" to match the page address. */
    active(id: string): CellNav;
    /** Measures the items' pictures so cells can lean towards their proportions. */
    measured(): Promise<CellNav>;
    spec(): Spec;
    cells(font: Font): Cell[];
    render(font: Font, opts?: Pick<RenderOptions, "onNavigate">): SVGSVGElement;
    /** Draws the navbar into `el` and starts its effects. Call `.stop()` to end them. */
    mount(el: Element, font: Font, opts?: Pick<RenderOptions, "onNavigate">): {
        stop(): void;
    };
}
export declare const cellNav: (items: (string | Item)[]) => CellNav;
/**
 * One word bent to fill one shape: "LOVE" in a heart. A navbar with a single
 * item and a boundary, with settings that suit that: no gap at the edge and a
 * little padding. `shape` is a preset name ("heart", "star", ...) or an SVG
 * path. The shape fills a `width` by `height` box (600 by 600).
 * Everything else about the cell, such as `color` or `background: "none"`,
 * works as it does for any navbar, and the result can be mounted, given
 * effects, and so on.
 */
export declare function textInShape(label: string, shape: string, opts?: {
    width?: number;
    height?: number;
    /** The cell's colour, or the text's with `background: "none"`. */
    color?: string;
    background?: "cell" | "none";
    /** Draws the shape's outline in this colour. */
    stroke?: string;
    /** Where it links to. Default "#". */
    href?: string;
    padding?: number;
    warp?: number;
    /** Longest stretch of letter outline in px (default 2.5). */
    detail?: number;
    /** "spread": break the word across the shape's convex parts, like line breaks. */
    flow?: "outline" | "spread";
}): CellNav;
export {};
