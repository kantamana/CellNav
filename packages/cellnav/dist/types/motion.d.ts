import type { Spec } from "./cells";
import { type Motion } from "./scene";
/**
 * Starts the effects in `spec` on a navbar drawn by renderSvg. Each cell has a
 * strength per effect, from 0 to 1, that eases towards 1 while the cell is
 * selected (all, hovered, active, ...) and back to 0 after. Frames are drawn
 * only while something is changing: a hover effect costs nothing until a cell
 * is hovered, and a frozen one is drawn once. It also:
 *   - freezes the clock and skips the easing if the visitor asked to reduce motion,
 *   - pauses while the navbar is off screen,
 *   - restores the plain shapes when stopped.
 * Returns undefined if there is nothing to run.
 */
export declare function startMotion(svg: SVGSVGElement, spec: Spec, pageUrl?: string): Motion | undefined;
