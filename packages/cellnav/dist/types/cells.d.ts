import type { EffectSpec } from "./effects";
import { type Point, type Polygon } from "./geometry";
import { type Font } from "./text";
import { type VoronoiOptions } from "./voronoi";
export interface Item {
    id: string;
    label: string;
    href: string;
    /** Picture for an image fill. */
    image?: string;
    /** The picture's width:height. Measured from the image if left out. */
    aspect?: number;
}
export type CornerFillAt = "all" | "smooth" | "prevent-glitch";
export interface Spec {
    items: Item[];
    width: number;
    height: number;
    layout?: {
        type: "voronoi";
    } & VoronoiOptions;
    fill?: {
        /** "text": the label fills each cell. "image": the item's picture does. */
        type: "text" | "image";
        /**
         * 1 (default) bends text to fill the whole cell; 0 sets it upright in a plain
         * rectangle. It has no effect on a cell with dents, where the letters always
         * follow the outline.
         */
        warp?: number;
        /** Pixels between the text and the cell walls. Default 10. */
        padding?: number;
        /**
         * Text fill only. How the word goes into a cell with dents. "outline" (the
         * default) bends it onto the cell's own outline, or into its biggest convex
         * part if the cell is deeply dented. "spread" cuts the cell into convex
         * pieces and breaks the word across them like line breaks, preferring to
         * break at a space, so a plus sign or a star is filled arm by arm. It makes
         * no difference to a cell without dents.
         */
        flow?: "outline" | "spread";
        /**
         * Text fill only. The longest stretch of letter outline, in px, once the
         * word is drawn (default 2.5). Smaller is smoother for big letters and
         * larger is lighter, which matters for animated effects.
         */
        detail?: number;
        /**
         * Text fill only. 0 to 1 (default 0, off): how far rounded letters (O, C, S,
         * the bowl of a D) are pushed out into the corners of their box, so they
         * fill a straight-cornered cell instead of leaving a gap there. Straight
         * letters (H, E, A, V) do not change.
         */
        cornerFill?: number;
        /**
         * Text fill only. Where `cornerFill` applies. "all" (default): at every
         * corner of every letter. "smooth": only where the cell's matching corner is
         * practically a straight line (a gentle curve, such as an ellipse's or a
         * heart's lobe), not at a real corner. "prevent-glitch": only at the outer
         * corners of the first and last letters, the ones that meet the cell's
         * corners, which is where a round letter leaves a gap that reads as a
         * dent in the cell's corner.
         */
        cornerFillAt?: CornerFillAt;
        /**
         * Text fill only. "cell" (default) draws each cell as a coloured shape with
         * plain text on it. "none" draws no cell at all and colours the text with
         * the cell's colour instead. The cell is still clickable, and a faint tint
         * of its colour shows on hover and focus.
         */
        background?: "cell" | "none";
        /**
         * Image fill only. How far each cell's shape leans towards its picture's
         * proportions, 0 (ignore them) to 1 (match as well as the layout allows).
         * Default 0.5.
         */
        aspectBlend?: number;
        /**
         * Image fill only. How hard each cell is pushed towards a rectangle, 0 to 1
         * (default 1). A picture is a rectangle clipped to the cell, so the closer
         * the cell is to one, the more of the picture shows. Applies whenever
         * `aspectBlend` is above 0.
         */
        shapeFit?: number;
        /**
         * Image fill only. When the label shows: "hover" (also on focus, and always
         * on touch screens; the default), "always" or "none".
         */
        labels?: "hover" | "always" | "none";
    };
    /** Pixels each outline is pulled in, leaving a gap between cells. */
    margin?: number;
    /**
     * The outer shape the cells fill: a preset ("ellipse", "hexagon", ...) or an
     * SVG path, convex or concave. Fits the width/height box. Default: the
     * whole box.
     */
    boundary?: string;
    /** Draws the boundary as an outline in this colour. */
    boundaryStroke?: string;
    palette?: string[];
    /**
     * The current item: an item id, or "auto" to match the page address. It is
     * outlined and marked aria-current="page".
     */
    active?: string;
    /** Motion and distortion applied to the letters or outlines of chosen cells. */
    effects?: EffectSpec[];
}
export interface Cell {
    item: Item;
    shape: Polygon;
    /** A thinner outline that sits wholly inside the cell, for hover and focus. */
    ring: Polygon;
    label: Point[][];
    /** True when the cell has no background and its colour goes on the text. */
    flat: boolean;
    /** Set when the cell shows a picture. */
    image?: string;
    /** That picture's width:height, if known. */
    imageAspect?: number;
    /** When the label is visible. */
    labelMode: "always" | "hover" | "none";
    color: string;
}
export declare const DEFAULT_PALETTE: string[];
export declare function buildCells(spec: Spec, font: Font): Cell[];
