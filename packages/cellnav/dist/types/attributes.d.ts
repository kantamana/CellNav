import type { Item, Spec } from "./cells";
export interface Attrs {
    items?: string | null;
    spec?: string | null;
    width?: string | null;
    height?: string | null;
    stretch?: string | null;
    seed?: string | null;
    margin?: string | null;
    warp?: string | null;
    padding?: string | null;
    active?: string | null;
    fill?: string | null;
    aspectBlend?: string | null;
    shapeFit?: string | null;
    labels?: string | null;
    background?: string | null;
    textDetail?: string | null;
    cornerFill?: string | null;
    cornerFillAt?: string | null;
    textFlow?: string | null;
    organic?: string | null;
    boundary?: string | null;
    boundaryStroke?: string | null;
    relaxation?: string | null;
    palette?: string | null;
    noise?: string | null;
    effects?: string | null;
    noiseTarget?: string | null;
    noiseOn?: string | null;
    noiseSize?: string | null;
    noiseAmount?: string | null;
    noiseScale?: string | null;
    noiseSpeed?: string | null;
    noiseSeed?: string | null;
    noiseEase?: string | null;
    noisePreserve?: string | null;
    noiseMode?: string | null;
}
/**
 * Builds a Spec from HTML attributes, falling back to the page's own links
 * (`childItems`). A full `spec` attribute wins over everything else.
 */
export declare function specFromAttributes(attrs: Attrs, childItems: Item[]): Spec;
/** Every attribute `<cell-nav>` reads (and re-renders on). */
export declare const CELL_NAV_ATTRIBUTES: readonly ["items", "spec", "width", "height", "stretch", "seed", "margin", "warp", "padding", "active", "fill", "aspect-blend", "noise", "effects", "noise-target", "noise-on", "noise-size", "noise-amount", "noise-scale", "noise-speed", "noise-seed", "noise-ease", "noise-mode", "noise-preserve", "shape-fit", "labels", "background", "text-detail", "corner-fill", "corner-fill-at", "text-flow", "organic", "boundary", "boundary-stroke", "relaxation", "palette", "font-url"];
