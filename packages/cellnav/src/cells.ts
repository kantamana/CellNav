import { contains, isConvexPolygon, offset } from "./clip";
import type { EffectSpec } from "./effects";
import { area, bounds, centroid, nearestOnOutline, solidity, type Point, type Polygon } from "./geometry";
import { resolveBoundary } from "./boundary";
import { frameOf, inscribedRect, orientedCage } from "./orient";
import { convexPieces, largestConvexPart } from "./parts";
import { splitText, textContours, type Font } from "./text";
import { targetAspect } from "./images";
import { DEFAULT_STRETCH, voronoiLayout, type VoronoiOptions } from "./voronoi";
import { cageWarp } from "./warp";

export interface Item {
  id: string;
  label: string;
  href: string;
  /** Picture for an image fill. */
  image?: string;
  /** The picture's width:height. Measured from the image if left out. */
  aspect?: number;
}

export interface Spec {
  items: Item[];
  width: number;
  height: number;
  layout?: { type: "voronoi" } & VoronoiOptions;
  fill?: {
    /** "text": the label fills each cell. "image": the item's picture does. */
    type: "text" | "image";
    /**
     * 1 (default) bends text to fill the whole cell; 0 sets it upright in a plain
     * rectangle. It has no effect on a cell with dents, where the letters always
     * follow the outline.
     */
    warp?: number;
    /** Pixels between the text and the cell walls. Default 10. */
    padding?: number;
    /**
     * Text fill only. How the word goes into a cell with dents. "outline" (the
     * default) bends it onto the cell's own outline, or into its biggest convex
     * part if the cell is deeply dented. "spread" cuts the cell into convex
     * pieces and breaks the word across them like line breaks, preferring to
     * break at a space, so a plus sign or a star is filled arm by arm. It makes
     * no difference to a cell without dents.
     */
    flow?: "outline" | "spread";
    /**
     * Text fill only. The longest stretch of letter outline, in px, once the
     * word is drawn (default 2.5). Smaller is smoother for big letters and
     * larger is lighter, which matters for animated effects.
     */
    detail?: number;
    /**
     * Text fill only. 0 to 1 (default 0, off): how far rounded letters (O, C, S,
     * the bowl of a D) are pushed out into the corners of their box, so they
     * fill a straight-cornered cell instead of leaving a gap there. Straight
     * letters (H, E, A, V) do not change.
     */
    cornerFill?: number;
    /**
     * Text fill only. "cell" (default) draws each cell as a coloured shape with
     * plain text on it. "none" draws no cell at all and colours the text with
     * the cell's colour instead. The cell is still clickable, and a faint tint
     * of its colour shows on hover and focus.
     */
    background?: "cell" | "none";
    /**
     * Image fill only. How far each cell's shape leans towards its picture's
     * proportions, 0 (ignore them) to 1 (match as well as the layout allows).
     * Default 0.5.
     */
    aspectBlend?: number;
    /**
     * Image fill only. How hard each cell is pushed towards a rectangle, 0 to 1
     * (default 1). A picture is a rectangle clipped to the cell, so the closer
     * the cell is to one, the more of the picture shows. Applies whenever
     * `aspectBlend` is above 0.
     */
    shapeFit?: number;
    /**
     * Image fill only. When the label shows: "hover" (also on focus, and always
     * on touch screens; the default), "always" or "none".
     */
    labels?: "hover" | "always" | "none";
  };
  /** Pixels each outline is pulled in, leaving a gap between cells. */
  margin?: number;
  /**
   * The outer shape the cells fill: a preset ("ellipse", "hexagon", ...) or an
   * SVG path, convex or concave. Fits the width/height box. Default: the
   * whole box.
   */
  boundary?: string;
  /** Draws the boundary as an outline in this colour. */
  boundaryStroke?: string;
  palette?: string[];
  /**
   * The current item: an item id, or "auto" to match the page address. It is
   * outlined and marked aria-current="page".
   */
  active?: string;
  /** Motion and distortion applied to the letters or outlines of chosen cells. */
  effects?: EffectSpec[];
}

export interface Cell {
  item: Item;
  shape: Polygon;
  /** A thinner outline that sits wholly inside the cell, for hover and focus. */
  ring: Polygon;
  label: Point[][];
  /** True when the cell has no background and its colour goes on the text. */
  flat: boolean;
  /** Set when the cell shows a picture. */
  image?: string;
  /** That picture's width:height, if known. */
  imageAspect?: number;
  /** When the label is visible. */
  labelMode: "always" | "hover" | "none";
  color: string;
}

export const DEFAULT_PALETTE = [
  "#ffbe0b",
  "#fb5607",
  "#ff006e",
  "#8338ec",
  "#3a86ff",
  "#06d6a0",
  "#ef476f",
  "#118ab2",
];

/**
 * Pulls every edge in by `distance`. If that would swallow the shape, the
 * distance is halved until enough is left, so a tiny cell shrinks less
 * instead of vanishing.
 */
// How far inside the cell its hover/focus outline is drawn.
const RING_INSET = 3;

function pulledIn(shape: Polygon, distance: number): Polygon {
  const full = Math.abs(area(shape));
  for (let d = Math.max(distance, 0); d > 0.25; d /= 2) {
    const o = offset(shape, d);
    if (o && Math.abs(area(o)) >= full * 0.2) return o;
  }
  return shape;
}

/** Bends `text` to fill the convex shape `textShape`. */
function fitText(
  font: Font,
  text: string,
  textShape: Polygon,
  strength: number,
  segmentPx?: number,
  cornerFill?: number,
): Point[][] {
  const frame = frameOf(textShape);
  const { source, target } = orientedCage(textShape, frame);
  const bend = cageWarp(source, target);
  // `warp` eases the bend towards an upright rectangle in the shape. A dented
  // outline has no such rectangle, so there the letters always follow the outline.
  const dented = !isConvexPolygon(textShape, CONVEX_ENOUGH);
  const rect = dented ? undefined : inscribedRect(textShape, frame);
  // Warping onto a dented outline can push a point a hair out through a dent;
  // such a point is moved back to the nearest spot on the outline.
  const place = (p: Point): Point => {
    const b = bend(p);
    if (dented) return contains(textShape, b) ? b : nearestOnOutline(textShape, b);
    if (!rect || strength >= 1) return b;
    const [tl, tr, , bl] = rect;
    const rigid = {
      x: tl.x + p.x * (tr.x - tl.x) + p.y * (bl.x - tl.x),
      y: tl.y + p.x * (tr.y - tl.y) + p.y * (bl.y - tl.y),
    };
    if (strength === 0) return rigid;
    return {
      x: rigid.x + (b.x - rigid.x) * strength,
      y: rigid.y + (b.y - rigid.y) * strength,
    };
  };
  // Sample the outline finely enough for the size it is about to be drawn at.
  const box = bounds(textShape);
  return textContours(font, text, { width: box.width, height: box.height, segmentPx, cornerFill }).map((c) =>
    c.map(place),
  );
}

const showsImage = (spec: Spec, item: Item) => spec.fill?.type === "image" && !!item.image;

/** A dent shallower than this many px does not make a shape count as dented. */
const CONVEX_ENOUGH = 0.5;

/** Most convex pieces a dented cell is cut into when the word is spread over it. */
const SPREAD_PIECES = 6;

/** Below this solidity (area over convex hull area) a cell counts as deeply dented. */
const DENTED = 0.85;

/** Weight of the "be a rectangle" pull at the default shape fit of 1. */
const RECTANGULARITY = 0.5;

/**
 * What the pictures ask of the layout, as the two arguments voronoiLayout
 * takes: each item's wanted proportions, and how hard to push it towards a
 * rectangle. Nothing is asked if the fill is not an image fill, no item has a
 * picture, or the aspect blend is 0.
 */
function steering(spec: Spec): [number[], number[]] | [] {
  if (spec.fill?.type !== "image") return [];
  const blend = spec.fill.aspectBlend ?? 0.5;
  if (blend <= 0 || !spec.items.some((i) => showsImage(spec, i))) return [];
  const stretch = spec.layout?.stretch ?? DEFAULT_STRETCH;
  const fit = Math.min(1, Math.max(0, spec.fill.shapeFit ?? 1));
  return [
    spec.items.map((i) => (showsImage(spec, i) ? targetAspect(stretch, i.aspect, blend) : stretch)),
    spec.items.map((i) => (showsImage(spec, i) ? RECTANGULARITY * fit : 0)),
  ];
}

export function buildCells(spec: Spec, font: Font): Cell[] {
  const { items, width, height } = spec;
  const layout = voronoiLayout(
    items.length,
    width,
    height,
    spec.layout,
    resolveBoundary(spec.boundary, width, height),
    ...steering(spec),
  );
  const palette = spec.palette ?? DEFAULT_PALETTE;
  const padding = spec.fill?.padding ?? 10;
  const detail = spec.fill?.detail;
  const cornerFill = spec.fill?.cornerFill;
  const spread = spec.fill?.flow === "spread";
  // warp = 1 bends text to the whole cell; 0 sets it upright in a rectangle.
  const strength = Math.min(1, Math.max(0, spec.fill?.warp ?? 1));

  return items.map((item, i) => {
    const shape = pulledIn(layout.cells[i]!, spec.margin ?? 3);

    // The word is warped straight onto the cell's outline, so its letters follow
    // the outline's curves. That stays inside the cell unless the cell is deeply
    // dented (a plus sign, a star), where the warp would fling letters out
    // through the notches; then the word goes in the cell's biggest convex part.
    const label = item.label.toUpperCase();
    let contours: Point[][];
    if (spread && !isConvexPolygon(shape, CONVEX_ENOUGH)) {
      // Cut the cell into convex pieces and break the word across them in reading order.
      const pieces = convexPieces(shape, SPREAD_PIECES).map((p) => pulledIn(p, padding));
      const along = frameOf(shape);
      const order = pieces
        .map((p) => ({ p, at: centroid(p).x * along.across.x + centroid(p).y * along.across.y }))
        .sort((a, b) => a.at - b.at)
        .map((o) => o.p);
      const lengths = order.map((p) => {
        const f = frameOf(p);
        const s = p.map((q) => q.x * f.across.x + q.y * f.across.y);
        return Math.max(...s) - Math.min(...s);
      });
      contours = splitText(font, label, lengths).flatMap((chunk) =>
        fitText(font, chunk.text, order[chunk.piece]!, strength, detail, cornerFill),
      );
    } else {
      const target = solidity(shape) >= DENTED ? shape : largestConvexPart(shape);
      contours = fitText(font, label, pulledIn(target, padding), strength, detail, cornerFill);
    }

    return {
      item,
      shape,
      ring: pulledIn(shape, RING_INSET),
      label: contours,
      flat: spec.fill?.background === "none" && !showsImage(spec, item),
      image: showsImage(spec, item) ? item.image : undefined,
      imageAspect: showsImage(spec, item) ? item.aspect : undefined,
      labelMode: !showsImage(spec, item) ? "always" : (spec.fill?.labels ?? "hover"),
      color: palette[i % palette.length]!,
    };
  });
}
