import fontDataUrl from "./assets/Anton-Regular.ttf?inline";
import { CELL_NAV_ATTRIBUTES, specFromAttributes, type Attrs } from "./attributes";
import { resolveActive } from "./active";
import type { Item, Spec } from "./cells";
import { measureImages } from "./images";
import { renderNav } from "./nav";
import { startMotion } from "./motion";
import { setActive } from "./render";
import type { Motion } from "./scene";
import { loadFont, type Font } from "./text";

const ATTRS = CELL_NAV_ATTRIBUTES;

const fonts = new Map<string, Promise<Font>>();
const fontFor = (url: string) => {
  let f = fonts.get(url);
  if (!f) fonts.set(url, (f = loadFont(url)));
  return f;
};

const STYLE = `
  :host { display: block; }
  svg { display: block; width: 100%; height: auto; }
`;

/**
 * <cell-nav items="Home,About,Blog" stretch="2.5"></cell-nav>
 *
 * Events (all bubble and cross the shadow boundary):
 *   cellnav-render    after drawing
 *   cellnav-error     detail = message, when it can't be turned into a navbar
 *   cellnav-navigate  on a click; detail = {id, label, href}. Cancelable: call
 *                     preventDefault() to handle the route yourself.
 *
 * `active` marks the current item: an item id, or "auto" to follow the page
 * address. Style it with --cellnav-ink, --cellnav-ring-width and
 * --cellnav-hover-brightness.
 *
 * Items can also be plain child links, which stay in the page as the
 * fallback when scripts are off or the font fails to load:
 *   <cell-nav><a href="/about">About</a><a href="/blog">Blog</a></cell-nav>
 */
export class CellNavElement extends HTMLElement {
  // `cornerfill` is what HTML makes of the camelCase spelling `cornerFill`.
  static observedAttributes = [...ATTRS, "cornerfill"];

  private shadow = this.attachShadow({ mode: "open" });
  private pending = false;
  private generation = 0;
  private randomSeed?: number;
  private motion?: Motion;

  connectedCallback() {
    this.schedule();
    // With active="auto", follow the address bar as it changes.
    window.addEventListener("hashchange", this.onLocation);
    window.addEventListener("popstate", this.onLocation);
  }
  disconnectedCallback() {
    this.motion?.stop();
    this.motion = undefined;
    window.removeEventListener("hashchange", this.onLocation);
    window.removeEventListener("popstate", this.onLocation);
  }

  private onLocation = () => {
    const svg = this.shadow.querySelector("svg");
    if (!svg || this.getAttribute("active") !== "auto") return;
    setActive(svg as SVGSVGElement, resolveActive(this.currentSpec().items, "auto", location.href));
  };
  attributeChangedCallback() {
    this.schedule();
  }

  /** Coalesces several attribute changes into one render. */
  private schedule() {
    if (this.pending) return;
    this.pending = true;
    queueMicrotask(() => {
      this.pending = false;
      void this.render();
    });
  }

  /**
   * Items from the tag's own links. A link may hold a picture, which an image
   * fill uses: <a href="/about"><img src="about.jpg" alt="About"></a>
   */
  private childItems(): Item[] {
    return Array.from(this.querySelectorAll("a")).map((a) => {
      const img = a.querySelector("img");
      const label = (a.textContent ?? "").trim() || (img?.getAttribute("alt") ?? "").trim();
      const item: Item = {
        id: a.id || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item",
        label,
        href: a.getAttribute("href") ?? "#",
      };
      const src = img?.getAttribute("src");
      if (src) {
        item.image = src;
        const w = Number(img?.getAttribute("width"));
        const h = Number(img?.getAttribute("height"));
        if (w > 0 && h > 0) item.aspect = w / h;
      }
      return item;
    });
  }

  currentSpec(): Spec {
    // Each attribute feeds the spec reader under its camelCase name ("noise-on" -> noiseOn).
    const attrs: Record<string, string | null> = {};
    for (const name of ATTRS) {
      if (name !== "font-url")
        attrs[name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = this.getAttribute(name);
    }
    attrs.cornerFill ??= this.getAttribute("cornerfill");
    const spec = specFromAttributes(attrs as Attrs, this.childItems());
    // Pick the random layout once per tag, so editing other attributes
    // doesn't reshuffle the cells under the reader.
    if (spec.layout?.rngSeed === "random") {
      this.randomSeed ??= Math.floor(Math.random() * 2 ** 31);
      spec.layout = { ...spec.layout, rngSeed: this.randomSeed };
    }
    return spec;
  }

  private async render() {
    const run = ++this.generation;
    try {
      let spec = this.currentSpec();
      if (spec.items.length === 0) {
        throw new Error(
          "No items: put <a> links inside the tag, or add an items attribute.",
        );
      }
      const font = await fontFor(this.getAttribute("font-url") ?? fontDataUrl);
      // Pictures steer the cell shapes, so their proportions are needed first.
      if (spec.fill?.type === "image") spec = { ...spec, items: await measureImages(spec.items) };
      if (run !== this.generation) return; // a newer render superseded this one
      const style = document.createElement("style");
      style.textContent = STYLE;
      const svg = renderNav(spec, font, {
        onNavigate: (item, event) => {
          const navigate = new CustomEvent("cellnav-navigate", {
            detail: { id: item.id, label: item.label, href: item.href },
            cancelable: true,
            bubbles: true,
            composed: true,
          });
          this.dispatchEvent(navigate);
          if (navigate.defaultPrevented) event.preventDefault();
        },
      });
      // Start the effects before swapping, so a bad effect leaves the old navbar in place.
      const motion = startMotion(svg, spec);
      this.motion?.stop();
      this.motion = motion;
      this.shadow.replaceChildren(style, svg);
      this.dispatchEvent(new CustomEvent("cellnav-render", { bubbles: true, composed: true }));
    } catch (err) {
      console.error("<cell-nav>: could not render", err);
      this.dispatchEvent(
        new CustomEvent("cellnav-error", {
          detail: err instanceof Error ? err.message : String(err),
          bubbles: true,
          composed: true,
        }),
      );
    }
  }
}

if (!customElements.get("cell-nav")) {
  customElements.define("cell-nav", CellNavElement);
}
