import { type Polygon } from "./geometry";
/**
 * Removes repeated points and zero-width spikes, where the outline runs out to
 * a tip and straight back. A cut that runs along an existing edge leaves these
 * behind; they hold no area, and no further cut can remove them.
 */
export declare function trimSpikes(poly: Polygon): Polygon;
/**
 * Splits a polygon into convex parts by cutting along straight lines. At each
 * inward corner the outline's own edge is carried on in a straight line across
 * the shape, which removes that corner. Every part keeps the true outline,
 * curves and all, wherever it follows the shape's edge; only the cuts are
 * straight. Of the two edges at a corner, the cut that splits the shape more
 * evenly is used. A convex polygon comes back whole.
 */
export declare function convexParts(poly: Polygon): Polygon[];
/**
 * The convex parts worth putting text in, biggest first: at most `maxPieces`,
 * and none smaller than `minShare` of the whole.
 */
export declare function convexPieces(poly: Polygon, maxPieces?: number, minShare?: number): Polygon[];
/** The biggest convex part of a polygon. */
export declare function largestConvexPart(poly: Polygon): Polygon;
