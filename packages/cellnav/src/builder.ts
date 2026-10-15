import { buildCells, type Cell, type Item, type Spec } from "./cells";
import type { EffectSpec, NoiseSpec } from "./effects";
import { measureImages } from "./images";
import { startMotion } from "./motion";
import { renderNav } from "./nav";
import type { RenderOptions } from "./render";
import type { Font } from "./text";
import type { VoronoiOptions } from "./voronoi";

type LayoutSpec = NonNullable<Spec["layout"]>;
type FillSpec = NonNullable<Spec["fill"]>;

/** Layout: one stretched Voronoi cell per item, from fixed seeds. */
export const voronoi = (opts: VoronoiOptions = {}): LayoutSpec => ({
  type: "voronoi",
  ...opts,
});

/**
 * Effect: Perlin-noise wobble on the letters, the cell outlines, or both.
 * `preset` is "jitter" (small and quick, like the prototype) or "wobble" (slow
 * and large); `amount` (px), `scale` (px) and `speed` (0 = frozen, the default)
 * override it, and `size` zooms the whole wobble without making it steeper. `on` picks the cells: "all", "hover", "active" or item ids.
 * `mode: "shear"` makes x move by the noise of y and y by the noise of x, which
 * keeps letters' ink almost exactly; `mode: "swell"` is the opposite, with
 * strokes pinching and bulging.
 * See NoiseSpec.
 */
export const noise = (opts: Omit<NoiseSpec, "type"> = {}): NoiseSpec => ({ type: "noise", ...opts });

/**
 * Fill: each item's picture (`image` on the item), clipped to its cell.
 * `aspectBlend` (0 to 1, default 0.5) leans each cell towards its picture's
 * proportions, and `shapeFit` (0 to 1, default 1) pushes it towards a
 * rectangle so more of the picture shows; `labels` is when the label shows ("hover", "always", "none").
 * Items without a picture fall back to a plain coloured cell with its label.
 */
export const image = (
  opts: {
    aspectBlend?: number;
    shapeFit?: number;
    labels?: "hover" | "always" | "none";
    padding?: number;
  } = {},
): FillSpec => ({ type: "image", ...opts });

/**
 * Fill: each item's label, bent to fill its cell. `warp` (0..1, default 1)
 * eases that off: 0 keeps the text upright in a plain rectangle. `padding`
 * (px, default 10) keeps the text off the cell walls. The letters follow the
 * cell's outline, curves included.
 */
export const text = (
  opts: {
    warp?: number;
    padding?: number;
    /** "none": no cell background, the cell's colour goes on the text. */
    background?: "cell" | "none";
    /** Longest stretch of letter outline in px (default 2.5). */
    detail?: number;
    /** 0 to 1 (default 1, 0 = off): push rounded letters (O, C, S) out into their corners. */
    cornerFill?: number;
    /** "spread": in a cell with dents, break the word across convex pieces like line breaks. */
    flow?: "outline" | "spread";
  } = {},
): FillSpec => ({
  type: "text",
  ...opts,
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

const toItem = (i: string | Item): Item =>
  typeof i === "string" ? { id: slug(i), label: i, href: `#${slug(i)}` } : i;

/**
 * Immutable fluent builder. Every method returns a new builder, and `.spec()`
 * returns the plain data it has built up: the builder is only sugar over it.
 */
export class CellNav {
  constructor(private readonly s: Spec) {}

  private with(patch: Partial<Spec>) {
    return new CellNav({ ...this.s, ...patch });
  }

  size(width: number, height: number) {
    return this.with({ width, height });
  }
  layout(layout: LayoutSpec) {
    return this.with({ layout });
  }
  fill(fill: FillSpec) {
    return this.with({ fill });
  }
  margin(px: number) {
    return this.with({ margin: px });
  }
  palette(colors: string[]) {
    return this.with({ palette: colors });
  }

  /** A preset name ("ellipse", "hexagon", ...) or an SVG path (convex or concave). */
  boundary(boundary: string) {
    return this.with({ boundary });
  }
  boundaryStroke(color: string) {
    return this.with({ boundaryStroke: color });
  }

  /** Adds an effect. Effects stack, in the order they are added. */
  effect(effect: EffectSpec) {
    return this.with({ effects: [...(this.s.effects ?? []), effect] });
  }

  /** The current item: an item id, or "auto" to match the page address. */
  active(id: string) {
    return this.with({ active: id });
  }

  /** Measures the items' pictures so cells can lean towards their proportions. */
  async measured(): Promise<CellNav> {
    return new CellNav({ ...this.s, items: await measureImages(this.s.items) });
  }

  spec(): Spec {
    return this.s;
  }
  cells(font: Font): Cell[] {
    return buildCells(this.s, font);
  }
  render(font: Font, opts: Pick<RenderOptions, "onNavigate"> = {}): SVGSVGElement {
    return renderNav(this.s, font, opts);
  }
  /** Draws the navbar into `el` and starts its effects. Call `.stop()` to end them. */
  mount(el: Element, font: Font, opts: Pick<RenderOptions, "onNavigate"> = {}): { stop(): void } {
    const svg = this.render(font, opts);
    const motion = startMotion(svg, this.s);
    el.replaceChildren(svg);
    return { stop: () => motion?.stop() };
  }
}

export const cellNav = (items: (string | Item)[]) =>
  new CellNav({ items: items.map(toItem), width: 1000, height: 420 });

/**
 * One word bent to fill one shape: "LOVE" in a heart. A navbar with a single
 * item and a boundary, with settings that suit that: no gap at the edge and a
 * little padding. `shape` is a preset name ("heart", "star", ...) or an SVG
 * path. The shape fills a `width` by `height` box (600 by 600).
 * Everything else about the cell, such as `color` or `background: "none"`,
 * works as it does for any navbar, and the result can be mounted, given
 * effects, and so on.
 */
export function textInShape(
  label: string,
  shape: string,
  opts: {
    width?: number;
    height?: number;
    /** The cell's colour, or the text's with `background: "none"`. */
    color?: string;
    background?: "cell" | "none";
    /** Draws the shape's outline in this colour. */
    stroke?: string;
    /** Where it links to. Default "#". */
    href?: string;
    padding?: number;
    warp?: number;
    /** Longest stretch of letter outline in px (default 2.5). */
    detail?: number;
    /** 0 to 1 (default 1, 0 = off): push rounded letters (O, C, S) out into their corners. */
    cornerFill?: number;
    /** "spread": break the word across the shape's convex parts, like line breaks. */
    flow?: "outline" | "spread";
  } = {},
): CellNav {
  let nav = cellNav([{ id: slug(label), label, href: opts.href ?? "#" }])
    .size(opts.width ?? 600, opts.height ?? 600)
    .boundary(shape)
    .margin(0)
    .fill(
      text({
        padding: opts.padding ?? 6,
        ...(opts.warp !== undefined && { warp: opts.warp }),
        ...(opts.detail !== undefined && { detail: opts.detail }),
        ...(opts.cornerFill !== undefined && { cornerFill: opts.cornerFill }),
        ...(opts.flow && { flow: opts.flow }),
        ...(opts.background && { background: opts.background }),
      }),
    );
  if (opts.color) nav = nav.palette([opts.color]);
  if (opts.stroke) nav = nav.boundaryStroke(opts.stroke);
  return nav;
}
