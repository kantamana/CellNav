import type { Item } from "./cells";

/**
 * How well `href` matches the page at `pageUrl`: 2 if it points at this exact
 * place (same path and same #hash), 1 if it points at this page without a
 * hash, 0 if it points elsewhere.
 */
export function matchScore(href: string, pageUrl: string): 0 | 1 | 2 {
  let page: URL;
  let target: URL;
  try {
    page = new URL(pageUrl);
    target = new URL(href, page);
  } catch {
    return 0;
  }
  const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);
  if (target.origin !== page.origin || trim(target.pathname) !== trim(page.pathname)) return 0;
  if (target.hash === "") return 1;
  return target.hash === page.hash ? 2 : 0;
}

/**
 * Which item is the current one. `active` is an item id, or "auto" to pick the
 * item whose link best matches the page address (a #hash match beats a plain
 * path match; the first wins a tie). Returns undefined if nothing matches.
 */
export function resolveActive(
  items: Item[],
  active: string | undefined,
  pageUrl: string,
): string | undefined {
  if (!active) return undefined;
  if (active !== "auto") return items.some((i) => i.id === active) ? active : undefined;

  let best: { id: string; score: number } | undefined;
  for (const item of items) {
    const score = matchScore(item.href, pageUrl);
    if (score > 0 && (!best || score > best.score)) best = { id: item.id, score };
  }
  return best?.id;
}
