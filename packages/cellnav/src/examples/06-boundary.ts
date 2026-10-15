import { cellNav, voronoi, text } from "../index";

// `boundary` is the outer shape the cells fill: a preset name ("rounded",
// "ellipse", "circle", "hexagon", "diamond") or an SVG path.
// Everything outside it stays empty. `boundaryStroke` draws it as an outline.
export const nav = cellNav(["Home", "About", "Work", "Blog", "Contact", "Shop"])
  .size(1000, 420)
  .layout(voronoi({ stretch: 2.2, rngSeed: 4 }))
  .fill(text({ padding: 14 }))
  .boundary("ellipse")
  .boundaryStroke("#1b1b1b");
