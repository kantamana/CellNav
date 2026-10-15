import { type Point, type Polygon } from "./geometry";
export declare function mulberry32(seed: number): () => number;
/** Cells of `seeds` inside `region` (the whole box by default), convex or not. */
export declare function voronoiCells(seeds: Point[], width: number, height: number, region?: Polygon): Polygon[];
export interface VoronoiOptions {
    /** How much wider than tall the cells are. 1 = isotropic. */
    stretch?: number;
    /** A number makes the layout reproducible; "random" picks a fresh one each call. */
    rngSeed?: number | "random";
    /**
     * Lloyd relaxation passes: more = more even, symmetric-looking cells.
     * Defaults to 25, or to 0 when `organic` is set.
     */
    relaxation?: number;
    /**
     * Organic layout: seeds are scattered at random with only a minimum gap
     * between them and are not evened out, so cells vary in size and shape.
     */
    organic?: boolean;
    /** Fixed seed positions in 0..1 coordinates, replacing the generated ones. */
    points?: Point[];
}
export declare const DEFAULT_STRETCH = 2.5;
export interface VoronoiLayout {
    seeds: Point[];
    cells: Polygon[];
}
export declare function voronoiLayout(count: number, width: number, height: number, opts?: VoronoiOptions, boundary?: Polygon, 
/** Wanted width:height of each cell (page proportions), by item. */
aspects?: number[], 
/**
 * How hard to push each cell towards a rectangle, by item (0 = not at all).
 * A picture covers the cell's bounding box and is clipped to the cell, so
 * the share of it that stays visible is the cell's area over that box.
 */
rectangularity?: number[]): VoronoiLayout;
