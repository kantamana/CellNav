import { cellNav, voronoi, text } from "../index";

// Same layout as example 1's seed but with `warp` eased off. 1 bends each
// label to the whole cell (the default), 0 keeps it upright in a rectangle,
// and anything between blends the two. Try changing the number.
export const nav = cellNav(["Home", "About", "Projects", "Blog", "Contact"])
  .size(1000, 300)
  .layout(voronoi({ stretch: 2.8, rngSeed: 7 }))
  .fill(text({ warp: 0.4 }));
