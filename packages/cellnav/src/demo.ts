import { loadFont, type CellNav } from "./index";
import fontUrl from "./assets/Anton-Regular.ttf?url";

import * as e1 from "./examples/01-basic";
import * as e2 from "./examples/02-stretch";
import * as e3 from "./examples/03-fixed-points";
import * as e4 from "./examples/04-style";
import raw1 from "./examples/01-basic.ts?raw";
import raw2 from "./examples/02-stretch.ts?raw";
import raw3 from "./examples/03-fixed-points.ts?raw";
import raw4 from "./examples/04-style.ts?raw";
import * as e5 from "./examples/05-warp";
import raw5 from "./examples/05-warp.ts?raw";
import * as e6 from "./examples/06-boundary";
import raw6 from "./examples/06-boundary.ts?raw";

// The code shown is the very file that runs, so the page can't drift from it.
const examples: { title: string; nav: CellNav; code: string }[] = [
  { title: "1 · Basic", nav: e1.nav, code: raw1 },
  { title: "2 · Stretch", nav: e2.nav, code: raw2 },
  { title: "3 · Fixed points", nav: e3.nav, code: raw3 },
  { title: "4 · Margin and palette", nav: e4.nav, code: raw4 },
  { title: "5 · Warp strength", nav: e5.nav, code: raw5 },
  { title: "6 · Boundary", nav: e6.nav, code: raw6 },
];

const font = await loadFont(fontUrl);
const root = document.getElementById("examples")!;

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...kids: (Node | string)[]
) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...kids);
  return node;
};

for (const ex of examples) {
  const out = el("div", { className: "out" });
  ex.nav.mount(out, font);

  const spec = el(
    "details",
    {},
    el("summary", {}, "The Spec this builds (plain data, what <cell-nav> will take)"),
    el("pre", {}, JSON.stringify(ex.nav.spec(), null, 2)),
  );

  root.append(
    el(
      "section",
      {},
      el("h2", {}, ex.title),
      el("div", { className: "grid" }, el("pre", { className: "code" }, ex.code.trim()), out),
      spec,
    ),
  );
}
