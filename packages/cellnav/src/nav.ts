import { resolveActive } from "./active";
import { resolveBoundary } from "./boundary";
import { buildCells, type Spec } from "./cells";
import { renderSvg, type RenderOptions } from "./render";
import type { Font } from "./text";

/** Builds a Spec into a live SVG navbar. Shared by the builder and the tag. */
export function renderNav(
  spec: Spec,
  font: Font,
  opts: Pick<RenderOptions, "onNavigate"> & { pageUrl?: string } = {},
): SVGSVGElement {
  const { width, height, boundary, boundaryStroke } = spec;
  const pageUrl = opts.pageUrl ?? (typeof location !== "undefined" ? location.href : "");
  return renderSvg(buildCells(spec, font), width, height, {
    outline: boundaryStroke
      ? { boundary: resolveBoundary(boundary, width, height), stroke: boundaryStroke }
      : undefined,
    active: resolveActive(spec.items, spec.active, pageUrl),
    onNavigate: opts.onNavigate,
  });
}
