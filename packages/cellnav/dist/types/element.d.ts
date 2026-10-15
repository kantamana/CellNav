import type { Spec } from "./cells";
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
export declare class CellNavElement extends HTMLElement {
    static observedAttributes: string[];
    private shadow;
    private pending;
    private generation;
    private randomSeed?;
    private motion?;
    private links;
    private onParsed;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private onLocation;
    attributeChangedCallback(): void;
    /** Coalesces several attribute changes into one render. */
    private schedule;
    /**
     * Items from the tag's own links. A link may hold a picture, which an image
     * fill uses: <a href="/about"><img src="about.jpg" alt="About"></a>
     */
    private childItems;
    currentSpec(): Spec;
    private render;
}
