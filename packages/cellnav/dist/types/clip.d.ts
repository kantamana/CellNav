import { type Point, type Polygon } from "./geometry";
/** The pieces where `a` and `b` overlap. A concave `a` can give several. */
export declare const intersect: (a: Polygon, b: Polygon) => Polygon[];
export declare const union: (a: Polygon, b: Polygon) => Polygon[];
/** Total area where the two overlap. */
export declare const overlapArea: (a: Polygon, b: Polygon) => number;
export declare const largest: (polys: Polygon[]) => Polygon | undefined;
/**
 * Moves every edge `distance` inwards (outwards if negative), keeping the
 * outline true however concave it is. Returns the biggest surviving piece, or
 * undefined if the shape disappears.
 */
export declare function offset(poly: Polygon, distance: number): Polygon | undefined;
/** Even-odd point-in-polygon, for any simple polygon. */
export declare function contains(poly: Polygon, p: Point): boolean;
/**
 * True if the polygon has no inward corner. Each vertex is judged by how far it
 * sits off the line between its neighbours, not by the size of the turn, so a
 * dented outline sampled with many tiny steps is still seen as dented. A dent
 * shallower than `tolerance` px is ignored.
 */
export declare function isConvexPolygon(poly: Polygon, tolerance?: number): boolean;
/** Length of boundary two polygons have in common (along shared edges). */
export declare function sharedLength(a: Polygon, b: Polygon, tol?: number): number;
