# Using CellNav (for agents)

CellNav is a `<cell-nav>` web component: a navbar of cells with text or pictures bent to fill them.

- **To build a website with it:** read `README.md` (quick start, recipes, every attribute, events, JS API, pitfalls). `examples/site/` is a complete small site made only from that README; copy its pattern.
- **Setup:** `npm install && npm run build`, then copy `dist/cellnav.iife.js` next to your HTML and add `<script src="cellnav.iife.js"></script>`.
- **While building a page, listen for errors:** `document.addEventListener("cellnav-error", e => console.warn(e.detail))`. Bad attributes never throw; the tag reports them there.
- **Every feature, with live editable code:** `npm run dev`, open `/embed-demo/index.html`.
- **Before changing the library:** `npm test` (must stay green), `CONTEXT.md` has the vocabulary, `docs/adr/` the decisions. Rebuild after source changes (pages load `dist/`).
- **Keep it simple.** The owner has pushed back on over-engineering twice; prefer the smallest change that works, and measure before building anything elaborate.
