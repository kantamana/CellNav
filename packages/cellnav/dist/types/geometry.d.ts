export type Point = {
    x: number;
    y: number;
};
export type Polygon = Point[];
export declare function area(poly: Polygon): number;
export declare function centroid(poly: Polygon): Point;
/** Keeps the half-plane a*x + b*y + c >= 0 (Sutherland–Hodgman step). */
export declare function clipHalfPlane(poly: Polygon, a: number, b: number, c: number): Polygon;
export declare function pointInConvex(p: Point, poly: Polygon, eps?: number): boolean;
export declare function bounds(poly: Polygon): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
};
/** The smallest convex polygon that holds all the points (monotone chain). */
export declare function convexHull(points: Point[]): Polygon;
/**
 * How little a shape is dented: its area over the area of its convex hull. 1 is
 * convex, a heart is about 0.94, a plus sign about 0.68, a star about 0.47.
 */
export declare function solidity(poly: Polygon): number;
/** The point on the polygon's outline that is nearest to `p`. */
export declare function nearestOnOutline(poly: Polygon, p: Point): Point;
