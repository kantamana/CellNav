import { describe, expect, it } from "vitest";
import * as api from "../src";
import { CELL_NAV_ATTRIBUTES } from "../src/attributes";
import { BEHAVIOR_CSS } from "../src/render";
import readme from "../README.md?raw";

// The README is what another person (or agent) builds a website from, so it must not drift from the code.
const mentions = (word: string) => readme.includes("`" + word + "`") || readme.includes("`" + word + "=") || readme.includes(word + "=\"");

describe("the README matches the code", () => {
  it.each([...CELL_NAV_ATTRIBUTES])("documents the %s attribute", (name) => {
    expect(mentions(name), name).toBe(true);
  });

  it.each([...api.BOUNDARY_PRESETS])("lists the %s shape", (name) => {
    expect(readme).toContain("`" + name + "`");
  });

  it("names the three events and the three CSS variables", () => {
    for (const e of ["cellnav-render", "cellnav-error", "cellnav-navigate"]) expect(readme).toContain(e);
    for (const v of ["--cellnav-ink", "--cellnav-ring-width", "--cellnav-hover-brightness"]) {
      expect(readme).toContain(v);
      expect(BEHAVIOR_CSS).toContain(v);
    }
  });

  it("only uses builder functions that exist", () => {
    for (const fn of ["cellNav", "voronoi", "text", "image", "noise", "textInShape", "registerEffect", "loadFont"])
      expect(typeof (api as Record<string, unknown>)[fn], fn).toBe("function");
    const nav = api.cellNav(["A"]);
    for (const m of ["size", "layout", "fill", "margin", "palette", "boundary", "boundaryStroke", "active", "effect", "spec", "render", "mount", "measured"])
      expect(typeof (nav as unknown as Record<string, unknown>)[m], m).toBe("function");
  });

  it("states defaults that are true", () => {
    expect(api.DEFAULT_STRETCH).toBe(2.5);
    expect(readme).toContain("`stretch` (default 2.5)");
    const cell = api.cellNav(["A", "B"]).spec();
    expect(cell.width).toBe(1000);
    expect(cell.height).toBe(420);
    expect(readme).toContain("default 1000 x 420");
  });

  it("every preset noise name it mentions exists", () => {
    for (const p of Object.keys(api.NOISE_PRESETS)) expect(readme).toContain(p);
  });

  it("every effect option it shows for the custom effect is what the runtime reads", () => {
    for (const key of ["text", "cells", "on", "ease", "detail", "animated", "displace"]) expect(readme).toContain(key);
  });
});
