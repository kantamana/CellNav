# Using CellNav (for agents)

CellNav is a `<cell-nav>` web component: a navbar of cells with text or pictures bent to fill them.

- **To build a website with it:** read `README.md` (quick start, recipes, every attribute, events, JS API, pitfalls). `examples/site/` is a complete small site made only from that README; copy its pattern.
- **Setup:** `npm install && npm run build`, then copy `dist/cellnav.iife.js` next to your HTML and add `<script src="cellnav.iife.js"></script>`.
- **While building a page, listen for errors:** `document.addEventListener("cellnav-error", e => console.warn(e.detail))`. Bad attributes never throw; the tag reports them there.
- **Every feature, with live editable code:** `npm run dev`, open `/embed-demo/index.html`.
- **Before changing the library:** `npm test` (must stay green), `CONTEXT.md` has the vocabulary, `docs/adr/` the decisions. Rebuild after source changes (pages load `dist/`).
- **House style for every `<cell-nav>` with text (the owner's rules, follow them unless told otherwise):**
  - Always add `corner-fill="1" corner-fill-at="prevent-glitch"`. It squares the outer corners of the first and last letters so round letters (O, C, S, D) do not leave a dent-like gap in the cell's corners. It is not the library default, so you must write it every time (in code: `CellNav.text({ cornerFill: 1, cornerFillAt: "prevent-glitch" })`).
  - **Never set `warp` below 1** (and do not write `warp` at all): the owner dislikes how `warp="0.5"` looks, and it is not a fix for squashed letters. If letters look squashed, change the layout instead: fewer items, shorter labels, a lower `stretch`, bigger `height`.
  - Only use another `corner-fill-at` value (`smooth`, `all`) or a lower `warp` if the owner asks for that look.
- **Keep it simple.** The owner has pushed back on over-engineering twice; prefer the smallest change that works, and measure before building anything elaborate.
