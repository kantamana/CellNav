import type { Item } from "./cells";
/**
 * How well `href` matches the page at `pageUrl`: 2 if it points at this exact
 * place (same path and same #hash), 1 if it points at this page without a
 * hash, 0 if it points elsewhere.
 */
export declare function matchScore(href: string, pageUrl: string): 0 | 1 | 2;
/**
 * Which item is the current one. `active` is an item id, or "auto" to pick the
 * item whose link best matches the page address (a #hash match beats a plain
 * path match; the first wins a tie). Returns undefined if nothing matches.
 */
export declare function resolveActive(items: Item[], active: string | undefined, pageUrl: string): string | undefined;
