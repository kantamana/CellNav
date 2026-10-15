import type { Point } from "./geometry";
import type { Cell, Item } from "./cells";
export declare const pathData: (contours: Point[][]) => string;
/**
 * Hover, focus and current-page styling. A host page can restyle it with these
 * custom properties, which cross the shadow boundary:
 *   --cellnav-ink               outline colour (default #111)
 *   --cellnav-ring-width        outline width in drawing units (default 3)
 *   --cellnav-hover-brightness  how much a hovered cell lightens (default 1.12)
 */
export declare const BEHAVIOR_CSS = "\n.cn-link { cursor: pointer; outline: none; }\n.cn-scrim { fill: #000; opacity: 0; pointer-events: none; transition: opacity .15s; }\n.cn-link:hover .cn-scrim, .cn-link:focus-visible .cn-scrim { opacity: .38; }\n.cn-label-hover { opacity: 0; transition: opacity .15s; }\n.cn-link:hover .cn-label-hover, .cn-link:focus-visible .cn-label-hover { opacity: 1; }\n.cn-image-label { fill: #fff; stroke: rgba(0,0,0,.55); stroke-width: 3; paint-order: stroke; stroke-linejoin: round; }\n@media (hover: none) { .cn-label-hover { opacity: 1; } }\n.cn-cell { transition: filter .15s; }\n.cn-flat { fill-opacity: 0; transition: fill-opacity .15s; }\n.cn-link:hover .cn-flat, .cn-link:focus-visible .cn-flat { fill-opacity: .16; }\n.cn-ring { fill: none; stroke: var(--cellnav-ink, #111); stroke-width: var(--cellnav-ring-width, 3);\n  opacity: 0; pointer-events: none; transition: opacity .15s; }\n.cn-link:hover .cn-cell, .cn-link:focus-visible .cn-cell { filter: brightness(var(--cellnav-hover-brightness, 1.12)); }\n.cn-link:hover .cn-ring { opacity: .55; }\n.cn-link:focus-visible .cn-ring, .cn-link[aria-current] .cn-ring { opacity: 1; }\n@media (prefers-reduced-motion: reduce) { .cn-cell, .cn-flat, .cn-ring, .cn-scrim, .cn-label-hover { transition: none; } }\n";
export interface RenderOptions {
    /** Draws the outer boundary as an outline. */
    outline?: {
        boundary: Point[];
        stroke: string;
    };
    /** Id of the current item. */
    active?: string;
    /** Called when a cell is clicked, before the browser follows the link. */
    onNavigate?: (item: Item, event: MouseEvent) => void;
}
export declare function renderSvg(cells: Cell[], width: number, height: number, opts?: RenderOptions): SVGSVGElement;
/** Moves the "current page" mark to another cell without redrawing. */
export declare function setActive(svg: SVGSVGElement, id: string | undefined): void;
