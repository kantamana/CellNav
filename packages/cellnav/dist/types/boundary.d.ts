import { isConvexPolygon } from "./clip";
import { type Polygon } from "./geometry";
/** Shapes drawn as SVG paths in a 100 x 100 box, then stretched to the real one. */
export declare const SHAPE_PATHS: {
    readonly triangle: "M50 0 L100 100 L0 100 Z";
    readonly pentagon: "M50 0 L100 38 L81 100 L19 100 L0 38 Z";
    readonly star: "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z";
    readonly heart: "M50 30 C46 0 0 0 0 35 C0 65 50 85 50 100 C50 85 100 65 100 35 C100 0 54 0 50 30 Z";
    readonly cross: "M35 0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z";
    readonly arrow: "M0 30 L60 30 L60 0 L100 50 L60 100 L60 70 L0 70 Z";
    readonly drop: "M50 0 C80 40 100 60 100 72 C100 90 78 100 50 100 C22 100 0 90 0 72 C0 60 20 40 50 0 Z";
};
export declare const BOUNDARY_PRESETS: readonly ["rectangle", "rounded", "ellipse", "circle", "hexagon", "diamond", ...("triangle" | "pentagon" | "star" | "heart" | "cross" | "arrow" | "drop")[]];
export type BoundaryPreset = (typeof BOUNDARY_PRESETS)[number];
export interface PathScale {
    /** How many px a unit of the path becomes, across and down. */
    x: number;
    y: number;
    /** Longest stretch of finished outline, in px. Default 3. */
    segmentPx?: number;
}
/**
 * Reads M L H V C Q Z (absolute or relative) into a flat polygon. Given the
 * scale the path will be drawn at, curves get enough points that no stretch is
 * longer than `segmentPx`; without it each curve gets 12.
 */
export declare function parsePath(d: string, scale?: PathScale): Polygon;
export declare const isConvex: typeof isConvexPolygon;
/** True if no two edges of the outline cross each other. */
export declare function isSimple(poly: Polygon): boolean;
/**
 * A boundary is a preset name ("ellipse", "hexagon", ...) or an SVG path.
 * The outline may be concave (a star, a heart) but must not cross itself.
 */
export declare function resolveBoundary(boundary: string | undefined, width: number, height: number): Polygon;
