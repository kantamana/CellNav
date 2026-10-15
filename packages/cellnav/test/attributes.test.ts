import { describe, expect, it } from "vitest";
import { specFromAttributes } from "../src/attributes";

describe("<cell-nav> attributes", () => {
  it("reads a comma-separated item list", () => {
    const s = specFromAttributes({ items: "Home, About Us" }, []);
    expect(s.items).toEqual([
      { id: "home", label: "Home", href: "#home" },
      { id: "about-us", label: "About Us", href: "#about-us" },
    ]);
  });

  it("reads items as JSON with real hrefs", () => {
    const s = specFromAttributes(
      { items: '[{"label":"Blog","href":"/blog"}, "Music"]' },
      [],
    );
    expect(s.items.map((i) => i.href)).toEqual(["/blog", "#music"]);
  });

  it("falls back to the page's own child links", () => {
    const child = [{ id: "a", label: "A", href: "/a" }];
    expect(specFromAttributes({}, child).items).toEqual(child);
  });

  it("maps look attributes onto the Spec", () => {
    const s = specFromAttributes(
      { items: "A", stretch: "3", seed: "9", margin: "6", palette: "#fff, #000", height: "200" },
      [],
    );
    expect(s).toMatchObject({
      height: 200,
      margin: 6,
      palette: ["#fff", "#000"],
      layout: { type: "voronoi", stretch: 3, rngSeed: 9 },
    });
  });

  it("ignores junk numbers instead of producing NaN", () => {
    const s = specFromAttributes({ items: "A", stretch: "wide" }, []);
    expect(s.layout).toEqual({ type: "voronoi" });
  });

  it("lets a full spec attribute win", () => {
    const full = { items: [], width: 5, height: 5 };
    expect(specFromAttributes({ spec: JSON.stringify(full), items: "A" }, [])).toEqual(full);
  });
});
