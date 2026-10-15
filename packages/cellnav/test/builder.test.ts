import { describe, expect, it } from "vitest";
import { cellNav, text, voronoi } from "../src";

describe("fluent builder", () => {
  it("is immutable: each call returns a new builder", () => {
    const a = cellNav(["Home"]);
    const b = a.margin(9);
    expect(a.spec().margin).toBeUndefined();
    expect(b.spec().margin).toBe(9);
  });

  it("turns strings into items with slugs and hash links", () => {
    const [item] = cellNav(["About Us"]).spec().items;
    expect(item).toEqual({ id: "about-us", label: "About Us", href: "#about-us" });
  });

  it("is only sugar over the Spec data", () => {
    const spec = cellNav(["A", "B"])
      .size(500, 200)
      .layout(voronoi({ stretch: 3, rngSeed: 4 }))
      .fill(text())
      .spec();
    expect(spec).toMatchObject({
      width: 500,
      height: 200,
      layout: { type: "voronoi", stretch: 3, rngSeed: 4 },
      fill: { type: "text" },
    });
  });
});
