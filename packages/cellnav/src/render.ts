import type { Point } from "./geometry";
import type { Cell, Item } from "./cells";
import { coverRect } from "./images";
import { motions, scenes, type SceneNodes } from "./scene";

const NS = "http://www.w3.org/2000/svg";

export const pathData = (contours: Point[][]) =>
  contours
    .map(
      (c) =>
        "M" + c.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join("L") + "Z",
    )
    .join("");

/** Dark text on light cells, light text on dark ones (hex colours only). */
function labelColor(fill: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(fill);
  if (!m) return "#111";
  const n = parseInt(m[1]!, 16);
  const lum =
    (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.5 ? "#111" : "#f7f5ee";
}

/**
 * Hover, focus and current-page styling. A host page can restyle it with these
 * custom properties, which cross the shadow boundary:
 *   --cellnav-ink               outline colour (default #111)
 *   --cellnav-ring-width        outline width in drawing units (default 3)
 *   --cellnav-hover-brightness  how much a hovered cell lightens (default 1.12)
 */
export const BEHAVIOR_CSS = `
.cn-link { cursor: pointer; outline: none; }
.cn-scrim { fill: #000; opacity: 0; pointer-events: none; transition: opacity .15s; }
.cn-link:hover .cn-scrim, .cn-link:focus-visible .cn-scrim { opacity: .38; }
.cn-label-hover { opacity: 0; transition: opacity .15s; }
.cn-link:hover .cn-label-hover, .cn-link:focus-visible .cn-label-hover { opacity: 1; }
.cn-image-label { fill: #fff; stroke: rgba(0,0,0,.55); stroke-width: 3; paint-order: stroke; stroke-linejoin: round; }
@media (hover: none) { .cn-label-hover { opacity: 1; } }
.cn-cell { transition: filter .15s; }
.cn-flat { fill-opacity: 0; transition: fill-opacity .15s; }
.cn-link:hover .cn-flat, .cn-link:focus-visible .cn-flat { fill-opacity: .16; }
.cn-ring { fill: none; stroke: var(--cellnav-ink, #111); stroke-width: var(--cellnav-ring-width, 3);
  opacity: 0; pointer-events: none; transition: opacity .15s; }
.cn-link:hover .cn-cell, .cn-link:focus-visible .cn-cell { filter: brightness(var(--cellnav-hover-brightness, 1.12)); }
.cn-link:hover .cn-ring { opacity: .55; }
.cn-link:focus-visible .cn-ring, .cn-link[aria-current] .cn-ring { opacity: 1; }
@media (prefers-reduced-motion: reduce) { .cn-cell, .cn-flat, .cn-ring, .cn-scrim, .cn-label-hover { transition: none; } }
`;

export interface RenderOptions {
  /** Draws the outer boundary as an outline. */
  outline?: { boundary: Point[]; stroke: string };
  /** Id of the current item. */
  active?: string;
  /** Called when a cell is clicked, before the browser follows the link. */
  onNavigate?: (item: Item, event: MouseEvent) => void;
}

let renderCount = 0;

export function renderSvg(
  cells: Cell[],
  width: number,
  height: number,
  opts: RenderOptions = {},
): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("role", "navigation");
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.display = "block";

  // Picture clips need ids, which must not clash if several navbars share a page.
  const uid = `cn${++renderCount}`;
  const style = document.createElementNS(NS, "style");
  style.textContent = BEHAVIOR_CSS;
  svg.append(style);
  const nodes: SceneNodes[] = [];

  if (opts.outline) {
    const edge = document.createElementNS(NS, "path");
    edge.setAttribute("d", pathData([opts.outline.boundary]));
    edge.setAttribute("fill", "none");
    edge.setAttribute("stroke", opts.outline.stroke);
    edge.setAttribute("stroke-width", "3");
    edge.setAttribute("pointer-events", "none");
    svg.append(edge);
  }

  cells.forEach((cell, index) => {
    const a = document.createElementNS(NS, "a");
    a.setAttribute("class", "cn-link");
    a.setAttribute("href", cell.item.href);
    a.setAttribute("aria-label", cell.item.label);
    a.setAttribute("data-id", cell.item.id);
    // Not every browser makes an SVG link focusable on its own.
    a.setAttribute("tabindex", "0");
    if (cell.item.id === opts.active) a.setAttribute("aria-current", "page");
    if (opts.onNavigate) {
      const onNavigate = opts.onNavigate;
      a.addEventListener("click", (e) => onNavigate(cell.item, e as MouseEvent));
    }

    const shape = document.createElementNS(NS, "path");
    shape.setAttribute("class", cell.flat ? "cn-cell cn-flat" : "cn-cell");
    shape.setAttribute("d", pathData([cell.shape]));
    shape.setAttribute("fill", cell.color);

    const ring = document.createElementNS(NS, "path");
    ring.setAttribute("class", "cn-ring");
    ring.setAttribute("d", pathData([cell.ring]));

    a.append(shape);
    const node: SceneNodes = { shape, ring };
    nodes.push(node);

    if (cell.image) {
      // The picture is scaled to cover the cell's bounding box, then clipped to its shape.
      const xs = cell.shape.map((p) => p.x);
      const ys = cell.shape.map((p) => p.y);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      const clip = document.createElementNS(NS, "clipPath");
      clip.setAttribute("id", `${uid}-${index}`);
      const clipShape = document.createElementNS(NS, "path");
      clipShape.setAttribute("d", pathData([cell.shape]));
      clip.append(clipShape);
      node.clip = clipShape;

      const box = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
      const known = cell.imageAspect && cell.imageAspect > 0 ? cell.imageAspect : undefined;
      // With the picture's shape known, place it so it covers the box exactly and
      // stretch it to that rectangle; otherwise ask the browser to cover.
      const r = known ? coverRect(box, known) : box;
      const img = document.createElementNS(NS, "image");
      img.setAttribute("href", cell.image);
      img.setAttribute("x", String(r.x));
      img.setAttribute("y", String(r.y));
      img.setAttribute("width", String(r.width));
      img.setAttribute("height", String(r.height));
      img.setAttribute("preserveAspectRatio", known ? "none" : "xMidYMid slice");
      img.setAttribute("clip-path", `url(#${uid}-${index})`);
      img.setAttribute("pointer-events", "none");

      const scrim = document.createElementNS(NS, "path");
      scrim.setAttribute("class", "cn-scrim");
      scrim.setAttribute("d", pathData([cell.shape]));
      node.scrim = scrim;
      a.append(clip, img, scrim);
    }

    a.append(ring);

    if (cell.labelMode !== "none") {
      const label = document.createElementNS(NS, "path");
      label.setAttribute("d", pathData(cell.label));
      label.setAttribute("fill-rule", "evenodd");
      label.setAttribute("pointer-events", "none");
      if (cell.image) {
        label.setAttribute(
          "class",
          cell.labelMode === "hover" ? "cn-image-label cn-label-hover" : "cn-image-label",
        );
      } else {
        // On a coloured cell the text contrasts with it; with no cell it takes the colour.
        label.setAttribute("fill", cell.flat ? cell.color : labelColor(cell.color));
      }
      a.append(label);
      node.label = label;
    }
    svg.append(a);
  });
  scenes.set(svg, { cells, nodes });
  return svg;
}

/** Moves the "current page" mark to another cell without redrawing. */
export function setActive(svg: SVGSVGElement, id: string | undefined) {
  svg.querySelectorAll("a.cn-link").forEach((a) => {
    if (a.getAttribute("data-id") === id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  motions.get(svg)?.setActive(id);
}
