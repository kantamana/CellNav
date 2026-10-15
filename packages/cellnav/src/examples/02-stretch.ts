import { cellNav, voronoi, text } from "../index";

// `stretch` is how much wider than tall the cells are (1 = round-ish).
export const nav = cellNav(["Home", "About", "Projects", "Blog", "Music", "Photos"])
  .size(1000, 360)
  .layout(voronoi({ stretch: 5, rngSeed: 3 }))
  .fill(text());
