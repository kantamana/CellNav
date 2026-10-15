import type { Item } from "./cells";
/**
 * The width:height a cell is steered towards. With no `blend` the cell keeps
 * the layout's own `stretch`; with a blend of 1 it takes the image's own
 * proportions; in between it leans that fraction of the way, measured in
 * ratios (so 0.5 lands halfway between 2.5:1 and 1:2 at about 1.1:1).
 */
export declare function targetAspect(stretch: number, aspect: number | undefined, blend: number): number;
/**
 * Where to draw a picture so that it covers `box` (like CSS "cover"): scaled
 * until both sides are covered and centred, so the overflow is cropped evenly.
 * Used instead of preserveAspectRatio="slice", which Chrome overrides with an
 * SVG picture's own setting and so letterboxes it.
 */
export declare function coverRect(box: {
    x: number;
    y: number;
    width: number;
    height: number;
}, aspect: number): {
    x: number;
    y: number;
    width: number;
    height: number;
};
/**
 * Fills in `aspect` for items that have an image but no known proportions.
 * An image that fails to load or times out is left without one, so its cell
 * simply keeps the default shape.
 */
export declare function measureImages(items: Item[], timeoutMs?: number): Promise<Item[]>;
