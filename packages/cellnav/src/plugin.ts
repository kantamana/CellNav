// Entry point of the drop-in bundle: registers <cell-nav> and exposes the
// builder as `CellNav.cellNav(...)` on the page for people who prefer code.
import "./element";
export * from "./index";
export { CellNavElement } from "./element";
export { specFromAttributes } from "./attributes";
export { CELL_NAV_ATTRIBUTES } from "./attributes";
