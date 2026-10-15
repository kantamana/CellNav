import { cellNav, voronoi, text } from "../index";

// Place the seeds yourself, in 0..1 coordinates (x across, y down).
// Nothing is random here: the same points always give the same cells.
export const nav = cellNav(["Home", "Work", "About", "Contact"])
  .size(1000, 300)
  .layout(
    voronoi({
      stretch: 1,
      points: [
        { x: 0.12, y: 0.5 },
        { x: 0.38, y: 0.5 },
        { x: 0.64, y: 0.5 },
        { x: 0.9, y: 0.5 },
      ],
    }),
  )
  .fill(text());
