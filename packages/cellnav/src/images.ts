import type { Item } from "./cells";

/**
 * The width:height a cell is steered towards. With no `blend` the cell keeps
 * the layout's own `stretch`; with a blend of 1 it takes the image's own
 * proportions; in between it leans that fraction of the way, measured in
 * ratios (so 0.5 lands halfway between 2.5:1 and 1:2 at about 1.1:1).
 */
export function targetAspect(
  stretch: number,
  aspect: number | undefined,
  blend: number,
): number {
  if (!aspect || !Number.isFinite(aspect) || aspect <= 0) return stretch;
  const b = Math.min(1, Math.max(0, blend));
  return Math.exp((1 - b) * Math.log(stretch) + b * Math.log(aspect));
}

/**
 * Where to draw a picture so that it covers `box` (like CSS "cover"): scaled
 * until both sides are covered and centred, so the overflow is cropped evenly.
 * Used instead of preserveAspectRatio="slice", which Chrome overrides with an
 * SVG picture's own setting and so letterboxes it.
 */
export function coverRect(
  box: { x: number; y: number; width: number; height: number },
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  const wide = box.width / box.height > aspect;
  const width = wide ? box.width : box.height * aspect;
  const height = wide ? box.width / aspect : box.height;
  return {
    x: box.x - (width - box.width) / 2,
    y: box.y - (height - box.height) / 2,
    width,
    height,
  };
}

const known = new Map<string, Promise<number | undefined>>();

/** Loads an image just far enough to learn its width:height. */
function aspectOf(url: string, timeoutMs: number): Promise<number | undefined> {
  let p = known.get(url);
  if (!p) {
    p = new Promise<number | undefined>((resolve) => {
      const img = new Image();
      const done = (v: number | undefined) => {
        clearTimeout(timer);
        resolve(v);
      };
      const timer = setTimeout(() => done(undefined), timeoutMs);
      img.onload = () =>
        done(img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : undefined);
      img.onerror = () => done(undefined);
      img.src = url;
    });
    known.set(url, p);
  }
  return p;
}

/**
 * Fills in `aspect` for items that have an image but no known proportions.
 * An image that fails to load or times out is left without one, so its cell
 * simply keeps the default shape.
 */
export async function measureImages(items: Item[], timeoutMs = 5000): Promise<Item[]> {
  return Promise.all(
    items.map(async (item) =>
      item.image && item.aspect === undefined
        ? { ...item, aspect: await aspectOf(item.image, timeoutMs) }
        : item,
    ),
  );
}
