import { cellNav, voronoi, text } from "../index";

// `margin` is the gap between cells in px; `palette` cycles through the cells.
export const nav = cellNav(["Sun", "Sea", "Sky", "Sand", "Wind"])
  .size(1000, 320)
  .layout(voronoi({ stretch: 3, rngSeed: 11 }))
  .fill(text())
  .margin(8)
  .palette(["#0b132b", "#1c2541", "#3a506b", "#5bc0be", "#6fffe9"]);
