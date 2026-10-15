import type { Item, Spec } from "./cells";
import type { EffectSpec, NoiseSpec } from "./effects";

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

const num = (v: string | null | undefined) => {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";

/** `items` is JSON (`[{"label":…}]` or `["A","B"]`) or a comma-separated list. */
function parseItems(raw: string): Item[] {
  const t = raw.trim();
  const list: (string | Partial<Item>)[] = t.startsWith("[")
    ? JSON.parse(t)
    : t.split(",").map((s) => s.trim()).filter(Boolean);
  return list.map((i) => {
    const label = typeof i === "string" ? i : (i.label ?? "");
    const id = typeof i === "string" ? slug(i) : (i.id ?? slug(label));
    const href = typeof i === "string" ? `#${id}` : (i.href ?? `#${id}`);
    const item: Item = { id, label, href };
    if (typeof i !== "string") {
      if (i.image) item.image = i.image;
      if (typeof i.aspect === "number" && i.aspect > 0) item.aspect = i.aspect;
    }
    return item;
  });
}

/**
 * The `effects` attribute is a JSON list of effects, for any effect type,
 * including ones registered in code: effects='[{"type":"shake","on":"hover"}]'.
 */
function effectsFromJson(raw: string | null | undefined): EffectSpec[] {
  if (raw == null || raw.trim() === "") return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    list = undefined;
  }
  const ok =
    Array.isArray(list) &&
    list.every((e) => e && typeof e === "object" && typeof (e as EffectSpec).type === "string");
  if (!ok) {
    throw new Error('effects must be a JSON list of effects, like [{"type":"noise","on":"hover"}].');
  }
  return list as EffectSpec[];
}

/**
 * The `noise` attribute switches the noise effect on: bare, or with a preset
 * ("jitter", "wobble"). `noise="off"` turns it off. The other noise-* attributes
 * set its options.
 */
function noiseFromAttributes(a: Attrs): NoiseSpec | undefined {
  if (a.noise == null) return undefined;
  const v = a.noise.trim().toLowerCase();
  if (v === "false" || v === "off" || v === "none") return undefined;

  const effect: NoiseSpec = { type: "noise" };
  if (v === "jitter" || v === "wobble") effect.preset = v;
  const target = a.noiseTarget?.trim();
  if (target === "text" || target === "cells" || target === "both") effect.target = target;
  const on = a.noiseOn?.split(",").map((s) => s.trim()).filter(Boolean);
  if (on?.length) effect.on = on;
  for (const [key, raw] of [
    ["size", a.noiseSize],
    ["amount", a.noiseAmount],
    ["scale", a.noiseScale],
    ["speed", a.noiseSpeed],
    ["ease", a.noiseEase],
  ] as const) {
    const n = num(raw);
    if (n !== undefined) effect[key] = n;
  }
  const mode = a.noiseMode?.trim().toLowerCase();
  if (mode === "shear" || mode === "swell") effect.mode = mode;
  // The earlier name for noise-mode="shear".
  else if (a.noisePreserve?.trim().toLowerCase() === "area") effect.mode = "shear";
  if (a.noiseSeed?.trim() === "random") effect.seed = "random";
  else {
    const seed = num(a.noiseSeed);
    if (seed !== undefined) effect.seed = seed;
  }
  return effect;
}

/**
 * Builds a Spec from HTML attributes, falling back to the page's own links
 * (`childItems`). A full `spec` attribute wins over everything else.
 */
export function specFromAttributes(attrs: Attrs, childItems: Item[]): Spec {
  if (attrs.spec) return JSON.parse(attrs.spec) as Spec;

  const items = attrs.items ? parseItems(attrs.items) : childItems;
  const spec: Spec = {
    items,
    width: num(attrs.width) ?? 1000,
    height: num(attrs.height) ?? 420,
  };

  const stretch = num(attrs.stretch);
  const rngSeed =
    attrs.seed?.trim() === "random" ? ("random" as const) : num(attrs.seed);
  const relaxation = num(attrs.relaxation);
  // A bare `organic` attribute is "" in the DOM; `organic="false"` turns it off.
  const organic = attrs.organic != null && attrs.organic.trim() !== "false";
  spec.layout = {
    type: "voronoi",
    ...(organic && { organic }),
    ...(relaxation !== undefined && { relaxation }),
    ...(stretch !== undefined && { stretch }),
    ...(rngSeed !== undefined && { rngSeed }),
  };
  const warp = num(attrs.warp);
  const padding = num(attrs.padding);
  const aspectBlend = num(attrs.aspectBlend);
  const shapeFit = num(attrs.shapeFit);
  const labels = attrs.labels?.trim();
  const background = attrs.background?.trim().toLowerCase();
  const detail = num(attrs.textDetail);
  const cornerFill = num(attrs.cornerFill);
  const cornerFillAt = attrs.cornerFillAt?.trim().toLowerCase();
  const flow = attrs.textFlow?.trim().toLowerCase();
  spec.fill = {
    type: attrs.fill?.trim() === "image" ? "image" : "text",
    ...(aspectBlend !== undefined && { aspectBlend }),
    ...(shapeFit !== undefined && { shapeFit }),
    ...(labels === "hover" || labels === "always" || labels === "none" ? { labels } : {}),
    ...(background === "none" || background === "cell" ? { background } : {}),
    ...(detail !== undefined && detail > 0 && { detail }),
    ...(cornerFill !== undefined && { cornerFill }),
    ...(cornerFillAt === "all" || cornerFillAt === "smooth" ? { cornerFillAt } : {}),
    ...(flow === "spread" || flow === "outline" ? { flow } : {}),
    ...(warp !== undefined && { warp }),
    ...(padding !== undefined && { padding }),
  };

  if (attrs.active?.trim()) spec.active = attrs.active.trim();
  if (attrs.boundary?.trim()) spec.boundary = attrs.boundary.trim();
  if (attrs.boundaryStroke?.trim()) spec.boundaryStroke = attrs.boundaryStroke.trim();

  const noise = noiseFromAttributes(attrs);
  const effects = [...(noise ? [noise] : []), ...effectsFromJson(attrs.effects)];
  if (effects.length) spec.effects = effects;

  const margin = num(attrs.margin);
  if (margin !== undefined) spec.margin = margin;
  if (attrs.palette)
    spec.palette = attrs.palette.split(",").map((c) => c.trim()).filter(Boolean);
  return spec;
}

/** Every attribute `<cell-nav>` reads (and re-renders on). */
export const CELL_NAV_ATTRIBUTES = [
  "items",
  "spec",
  "width",
  "height",
  "stretch",
  "seed",
  "margin",
  "warp",
  "padding",
  "active",
  "fill",
  "aspect-blend",
  "noise",
  "effects",
  "noise-target",
  "noise-on",
  "noise-size",
  "noise-amount",
  "noise-scale",
  "noise-speed",
  "noise-seed",
  "noise-ease",
  "noise-mode",
  "noise-preserve",
  "shape-fit",
  "labels",
  "background",
  "text-detail",
  "corner-fill",
  "corner-fill-at",
  "text-flow",
  "organic",
  "boundary",
  "boundary-stroke",
  "relaxation",
  "palette",
  "font-url",
] as const;
