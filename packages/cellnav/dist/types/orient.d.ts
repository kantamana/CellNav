import { type Point, type Polygon } from "./geometry";
/**
 * Angle (radians, in (-PI/2, PI/2]) of the polygon's longest axis, from the
 * principal axis of its area. Folding into that range means the reading
 * direction always points rightwards, so text is never upside down.
 */
export declare function longestAxisAngle(poly: Polygon): number;
export interface Frame {
    centre: Point;
    /** Unit vector the text reads along (x component is never negative). */
    across: Point;
    /** Unit vector pointing down the page for the text. */
    down: Point;
}
export declare function frameOf(poly: Polygon): Frame;
/**
 * Which four vertices of an outline, in order round it, sit closest to the
 * corners of the unit square (top-left, top-right, bottom-right, bottom-left).
 * `norm` is the outline's vertices already fitted into the unit square. For
 * each possible top-left vertex it walks round the outline picking the best
 * top-right, then bottom-right, then bottom-left, always further along, and
 * keeping the best partial pick at every step, so it is O(n^2): an outline with
 * hundreds of vertices costs no more than a coarse one.
 */
export declare function cornerVertices(norm: Point[]): number[];
export interface OrientedCage {
    /** Polygon vertices, ordered so that vertex k lands on `cage[k]`. */
    target: Polygon;
    /** Matching vertices on the boundary of the unit square (the text box). */
    source: Point[];
}
/**
 * Pairs the polygon with a unit-square cage whose top-left corner is the
 * polygon vertex nearest the top-left of the text frame, and so on clockwise.
 * The remaining vertices are spread along the square's edges in proportion
 * to the polygon's own edge lengths.
 */
export declare function orientedCage(poly: Polygon, frame: Frame): OrientedCage;
/**
 * The largest rectangle, centred on the polygon's centroid and aligned with
 * the text frame, that fits inside a convex polygon. Returned top-left,
 * top-right, bottom-right, bottom-left, in page coordinates.
 */
export declare function inscribedRect(poly: Polygon, frame: Frame): [Point, Point, Point, Point];
