import type { Point } from "./geometry";
/** Mean value coordinates of `p` with respect to the cage `cage`. */
export declare function meanValueWeights(p: Point, cage: Point[]): number[];
/** Maps points inside `source` onto the matching positions in `target`. */
export declare function cageWarp(source: Point[], target: Point[]): (p: Point) => Point;
