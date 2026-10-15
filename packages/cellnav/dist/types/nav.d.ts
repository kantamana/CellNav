import { type Spec } from "./cells";
import { type RenderOptions } from "./render";
import type { Font } from "./text";
/** Builds a Spec into a live SVG navbar. Shared by the builder and the tag. */
export declare function renderNav(spec: Spec, font: Font, opts?: Pick<RenderOptions, "onNavigate"> & {
    pageUrl?: string;
}): SVGSVGElement;
