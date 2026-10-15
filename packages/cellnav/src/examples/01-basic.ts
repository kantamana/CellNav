import { cellNav, voronoi, text } from "../index";

// Items in, Voronoi cells out, each label warped to fill its cell.
export const nav = cellNav(["Home", "About", "Projects", "Blog", "Music", "Photos", "Contact"])
  .layout(voronoi({ rngSeed: 7 }))
  .fill(text());
