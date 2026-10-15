# CellNav

A navigation bar drawn as a **tessellation of cells**. Each nav item gets a cell; its label (or picture) is bent to fill the cell's shape. It ships as one script file and one HTML tag, `<cell-nav>`, so it drops into any website with no framework and no build step. Cells are real links (keyboard, screen readers, right-click all work).

Everything is plain SVG. The layout is **static and reproducible**: the same attributes always give the same cells.

## Quick start

1. Get the one file `cellnav.iife.js` (the default font is inside it). Download the built copy from GitHub, no build needed:
   `curl -o cellnav.iife.js https://raw.githubusercontent.com/kantamana/CellNav/warp/packages/cellnav/dist/cellnav.iife.js`
   (or build it yourself: `npm install && npm run build` in this folder, which writes `dist/cellnav.iife.js`).
2. Put that file on your site and add it once per page:

```html
<script src="cellnav.iife.js"></script>
```

3. Put the tag where the nav goes. **Links inside the tag are the items** and stay on the page as a plain list of links if the script fails to load:

```html
<cell-nav stretch="2.8" seed="7" height="300" active="auto" corner-fill="1" corner-fill-at="prevent-glitch">
  <a href="/">Home</a>
  <a href="/about">About</a>
  <a href="/work">Work</a>
  <a href="/contact">Contact</a>
</cell-nav>
```

The tag is `display: block` and fills its container's width; `width`/`height` only set the drawing's proportions (default 1000 x 420). Style the container, not the tag's insides.

Items can also come from an attribute: `items="Home,About,Work"` (links become `#home`, `#about`, ...) or JSON: `items='[{"label":"Docs","href":"/docs"},"Blog"]'`. Labels are drawn in capitals.

## Recipes: which look is which attributes

| You want | Use |
|---|---|
| Colored cells with bent text (the default) | nothing extra; add `palette="#a,#b,..."` for your colors |
| Wider or squarer cells | `stretch="3"` (1 = round-ish, higher = wider) |
| A different layout, same items | `seed="9"`, or `seed="random"` for a new one each page load |
| Organic, uneven cells (not tidy) | `organic` |
| Gaps between cells / text kept off the walls | `margin="8"` / `padding="16"` |
| No cell fill, colored letters | `background="none"` (suits a dark page; set `--cellnav-ink`) |
| Pictures instead of text | `fill="image"` with `<a><img></a>` children |
| Cells that lean towards their pictures' proportions | `aspect-blend="0.5"` (0 = ignore pictures, 1 = full) |
| The whole nav in a shape (heart, ellipse, ...) | `boundary="heart"` (plus `boundary-stroke="#000"` for an outline) |
| One word bent to fill one shape | `<cell-nav items="LOVE" boundary="heart" width="600" height="600" margin="0" padding="6">` |
| Round letters (O, C, S) fill the cell's corners (recommended: use this on every text nav) | `corner-fill="1" corner-fill-at="prevent-glitch"` |
| Corner fill only where the cell is smooth, not at real corners | `corner-fill="1" corner-fill-at="smooth"` |
| Corner fill only at the word's two ends, where it meets the cell corners | `corner-fill="1" corner-fill-at="prevent-glitch"` |
| Hand-drawn, rough letters | `noise` (frozen), or `noise="jitter"` (moving) |
| Only the hovered cell wobbles | `noise="wobble" noise-on="hover"` |
| Letters keep their thickness while wobbling | `noise-mode="shear"` (the opposite, strokes pinch and bulge: `swell`) |
| Mark the current page | `active="auto"` (follows the address) or `active="about"` (an item id) |

## Attributes

All optional except the items. Numbers that are not valid are ignored (never an error). Changing an attribute re-renders.

**Items and size**
- `items`: comma list or JSON (see above); or use `<a>` children (which can contain an `<img>`).
- `width`, `height`: drawing proportions, default 1000 x 420. Also the pixel size shapes are cut for.
- `spec`: the whole configuration as one JSON object (wins over everything else; see "The Spec").
- `font-url`: URL of a `.ttf`/`.otf` to use instead of the built-in Anton.

**Layout**
- `stretch` (default 2.5): how much wider than tall cells are.
- `seed` (default 1, or `random`): reproducible layout number.
- `organic`: uneven cells instead of tidy ones. `relaxation="N"`: how many tidying rounds (default 25, or 0 with `organic`).
- `margin` (default 3): gap between cells in px.
- `palette`: comma list of colors, cycled over the cells.
- `boundary`: outer shape the cells fill. A name: `rectangle` `rounded` `ellipse` `circle` `hexagon` `diamond` `triangle` `pentagon` `star` `heart` `cross` `arrow` `drop`; or an SVG path `M ... Z` (commands M L H V Q C Z, not arcs; must not cross itself; stretched to fill width x height). Dents are fine.
- `boundary-stroke`: outline color for the boundary.

**Text**
- `warp` (default 1): 1 bends text to fill its cell, 0 sets it upright in a rectangle. No effect on a cell with dents.
- `padding` (default 10): px between text and cell walls.
- `background`: `cell` (default) or `none` (no fill, the cell's color goes on the text).
- `text-detail` (default 2.5): longest stretch of letter outline in px. Lower is smoother, higher is lighter.
- `corner-fill` (0 to 1, default 0 = off; also written `cornerFill`, which HTML lowercases to `cornerfill`): pushes rounded letters (O, C, S, the bowl of a D) out into the corners of their box so they fill a straight-cornered cell instead of leaving a gap. Straight letters (H, E, A, V) do not change. Also `cornerFill` in `CellNav.text({...})` and `textInShape`.
- `corner-fill-at` (`all` default, `smooth`, or `prevent-glitch`): `all` fills every letter corner; `smooth` only where the cell's matching corner is practically a straight line (a gentle curve such as an ellipse's edge or a heart's lobe), not at a real corner; `prevent-glitch` only the outer corners of the first and last letters of the word (or of each piece with `text-flow="spread"`), the ones that meet the cell's corners, where a round letter leaves a gap that looks like a dent. Also `cornerFillAt` in `CellNav.text({...})` and `textInShape`.
- `text-flow`: `outline` (default) bends the word onto a dented cell's outline, or into its biggest convex part if deeply dented; `spread` cuts a dented cell into convex pieces and breaks the word across them like line breaks, preferring spaces.

**Pictures** (`fill="image"`)
- `fill`: `text` (default) or `image`. Each picture covers its cell, clipped to the cell's shape.
- `aspect-blend` (default 0.5): how far each cell's shape leans towards its picture's proportions. `shape-fit` (default 1): how hard cells are pushed towards rectangles so more of the picture shows.
- `labels`: when the label shows over a picture: `hover` (default; also on focus, and always on touch screens), `always`, `none`.
- Picture proportions come from the `<img>`'s `width`/`height` attributes; if missing they are measured after loading. A link without a picture becomes a plain text cell.

**Behavior**
- `active`: current item, an id or `auto`.

**Effects** (Perlin noise; off unless `noise` or `effects` is present)
- `noise`: bare, or `jitter` (small, quick) or `wobble` (slow, large), or `off`.
- `noise-target`: `text` (default), `cells` (outlines), `both`.
- `noise-on`: which cells: `all` (default), `hover` (also keyboard focus), `active`, or item ids, comma separated.
- `noise-amount` (px, default 4), `noise-scale` (wobble size in px, default 12), `noise-size` (zooms both, bigger without getting spikier), `noise-speed` (0 = frozen, default), `noise-seed`, `noise-ease` (fade in/out ms, default 200).
- `noise-mode`: `shear` (x moves by the noise of y and y by the noise of x: keeps stroke thickness) or `swell` (the opposite); leave out for independent noise. `noise-preserve="area"` is the old name for `shear`.
- `effects`: a JSON list of effects, for several at once or for ones you registered: `effects='[{"type":"noise","preset":"wobble","target":"cells"},{"type":"shake","on":"hover"}]'`.
- Animation respects the visitor's "reduce motion" setting (it freezes), pauses while off-screen, and stops when the element is removed.

## React and Next.js

Use `react/CellNav.tsx`: copy it into your app, and put `dist/cellnav.iife.js` where your site serves static files (in Next.js, the `public/` folder). `examples/next/` is a complete working Next.js (App Router) site made with it.

```tsx
"use client";
import { useRouter, usePathname } from "next/navigation";
import { CellNav } from "@/components/CellNav";

const items = [{ label: "Home", href: "/" }, { label: "About", href: "/about" }];

export function SiteNav() {
  const router = useRouter();
  const path = usePathname();
  return (
    <CellNav
      items={items}
      active={items.find((i) => i.href === path)?.label.toLowerCase()}
      onNavigate={({ href }) => router.push(href)}   // route without a page reload
      stretch={2.8} seed={7} height={260}
    />
  );
}
```

- The component adds the script in the browser only, so nothing runs on the server. The server sends plain links, and the cells draw once the script loads. Do not `import "cellnav"` in server code: the tag needs the browser.
- Props: `items` (required), `active` (an item id, i.e. its label in lower case; pass it from your router, because `"auto"` only follows full page loads), `onNavigate`, `onError`, the common attributes as camelCase props (`width height stretch seed margin padding palette boundary background cornerFill cornerFillAt textFlow`), `attrs` for any other attribute by its dashed name (`attrs={{ noise: "wobble" }}`), `scriptSrc`, `className`, `style`. `cornerFill` defaults to 1 and `cornerFillAt` to `"prevent-glitch"` here. There is no `warp` prop on purpose.
- Changing `items` rebuilds the tag (it does not watch its links). Works with React 18 and 19.

## Events and theming

Events (they bubble and cross the shadow boundary), on the `<cell-nav>` element:
- `cellnav-render`: drawn.
- `cellnav-error`: `detail` is a message (bad attribute, unknown shape or effect...). Nothing is thrown; the previous drawing stays. **Listen for this while building a page.**
- `cellnav-navigate`: a cell was clicked. `detail` is `{id, label, href}`. Cancelable: call `preventDefault()` to do the routing yourself (single-page apps), then update `active`.

CSS custom properties, set on the tag or an ancestor: `--cellnav-ink` (outline color, default `#111`; use a light color on dark pages), `--cellnav-ring-width` (default 3), `--cellnav-hover-brightness` (default 1.12). Hover and keyboard focus lighten the cell and draw an outline inside it; the current item keeps its outline and gets `aria-current="page"`.

## JavaScript API

The script also exposes everything on `window.CellNav` (or `import` from `dist/cellnav.es.js`). The builder is immutable; every method returns a new builder, and `.spec()` returns plain data.

```js
const font = await CellNav.loadFont("/fonts/MyFont.ttf");   // any TTF/OTF; the tag has Anton built in
const nav = CellNav.cellNav(["Home", "About", { label: "Docs", href: "/docs" }])
  .size(1000, 360)
  .layout(CellNav.voronoi({ stretch: 3, rngSeed: 5, organic: false }))
  .fill(CellNav.text({ warp: 1, padding: 10, background: "cell", flow: "outline" }))   // or CellNav.image({ aspectBlend: 0.5 })
  .margin(4).palette(["#ffbe0b", "#fb5607"])
  .boundary("ellipse").boundaryStroke("#111")
  .active("auto")
  .effect(CellNav.noise({ preset: "jitter", on: "hover", mode: "shear" }));
const handle = nav.mount(document.querySelector("#nav"), font);   // draws; handle.stop() ends effects
// also: nav.spec(), nav.render(font) -> SVG element, await nav.measured() (loads picture sizes)
const heart = CellNav.textInShape("LOVE", "heart", { color: "#ff006e" });   // one word in one shape
```

Add your own effect (a function the Spec refers to by name, so it also works from HTML):

```js
CellNav.registerEffect("shake", (spec) => ({
  text: true, cells: false,              // move the letters, not the outlines
  on: [].concat(spec.on ?? "hover"), ease: 120, detail: 8, animated: true,
  displace: (point, seconds) => ({ x: Math.sin(seconds * 50 + point.y * 0.2) * 3, y: 0 }),
}));
// then: <cell-nav effects='[{"type":"shake","on":"hover"}]'>
```

## The Spec

A navbar is described by one plain-data object (`{items, width, height, layout, fill, margin, palette, boundary, boundaryStroke, active, effects}`). The builder, the attributes and the `spec` attribute all produce or read it, so anything you can build in code you can write in HTML (except custom JS functions). Read `src/cells.ts` (`Spec`) for the exact fields and their doc comments.

## Things that commonly go wrong

- **Nothing shows:** open the console; a `cellnav-error` message says why (unknown shape name, `items` JSON broken, no items, crossing path, unknown effect).
- **Unreadable letters:** thin or skewed cells squash words. Use fewer items, shorter labels, a lower `stretch`, or `organic` off. Do not lower `warp` to fix this: it makes the letters look loose and homemade, which is only wanted as a deliberate style. Long labels need big cells; a short word fits best.
- **Colors:** with `background="none"` the palette colors are the text colors, so pale ones vanish on a light page.
- **Pictures:** use a real URL; SVG and raster both work. Give `<img>` `width`/`height` to avoid a wait for measuring. Pictures cover their cell, so edges are cropped.
- **Touch screens** cannot hover, so picture labels are shown always there.
- **Server:** the page must be able to load `cellnav.iife.js`; if you also use `font-url`, that file must be same-origin or allow CORS.
- **After editing source:** run `npm run build` again; the demo pages load `dist/cellnav.iife.js`. If a dev server shows old behavior, restart it.

## Developing

```
npm install
npm run dev      # demo pages: / (builder examples) and /embed-demo/index.html (every feature, each with editable code)
npm run build    # tsc + dist/cellnav.iife.js + dist/cellnav.es.js + dist/types
npm test         # vitest, ~900 tests (geometry, layout, text, effects, attributes)
```

`embed-demo/index.html` is the best reference: every option is shown next to the HTML that makes it, and you can edit that HTML live. `examples/site/` is a small complete website built only from this README.

Source map: `src/element.ts` (the tag), `attributes.ts` (attributes -> Spec), `cells.ts` (Spec -> cells, the main pipeline), `voronoi.ts` (layout), `boundary.ts` (shapes), `parts.ts` (cutting dented shapes into convex parts), `orient.ts` + `warp.ts` (text orientation and the bend), `text.ts` (letter outlines, splitting words), `images.ts`, `effects.ts` + `noise.ts` + `motion.ts` (effects), `render.ts` (SVG), `builder.ts` (fluent API). Vocabulary is in `../../CONTEXT.md`; design decisions in `../../docs/adr/`.
