import { describe, expect, it } from "vitest";
import {
  area,
  buildCells,
  cellNav,
  matchScore,
  resolveActive,
  voronoiLayout,
  type Font,
  type Item,
} from "../src";
import { contains } from "../src/clip";
import { specFromAttributes } from "../src/attributes";

const items: Item[] = [
  { id: "home", label: "Home", href: "/" },
  { id: "about", label: "About", href: "/about" },
  { id: "blog", label: "Blog", href: "/blog/" },
  { id: "team", label: "Team", href: "/about#team" },
  { id: "docs", label: "Docs", href: "https://other.example/docs" },
];

describe("which link matches the page", () => {
  const at = (path: string) => `https://site.example${path}`;

  it("scores an exact path as 1, an exact path plus hash as 2, anything else as 0", () => {
    expect(matchScore("/about", at("/about"))).toBe(1);
    expect(matchScore("/about#team", at("/about#team"))).toBe(2);
    expect(matchScore("/about#team", at("/about"))).toBe(0);
    expect(matchScore("/about", at("/blog"))).toBe(0);
  });

  it("ignores a trailing slash but not a different path", () => {
    expect(matchScore("/blog/", at("/blog"))).toBe(1);
    expect(matchScore("/blog", at("/blog/"))).toBe(1);
    expect(matchScore("/blogger", at("/blog"))).toBe(0);
  });

  it("treats a bare #hash link as pointing at this page", () => {
    expect(matchScore("#home", at("/x#home"))).toBe(2);
    expect(matchScore("#home", at("/x#about"))).toBe(0);
    expect(matchScore("#home", at("/x"))).toBe(0);
  });

  it("never matches another site, and tolerates junk", () => {
    expect(matchScore("https://other.example/docs", at("/docs"))).toBe(0);
    expect(matchScore("/a", "not a url")).toBe(0);
  });
});

describe("resolving the active item", () => {
  const at = (path: string) => `https://site.example${path}`;

  it("returns nothing unless asked", () => {
    expect(resolveActive(items, undefined, at("/about"))).toBeUndefined();
  });

  it("takes an item id as is, if it exists", () => {
    expect(resolveActive(items, "blog", at("/"))).toBe("blog");
    expect(resolveActive(items, "nope", at("/"))).toBeUndefined();
  });

  it("auto picks by address, preferring a #hash match", () => {
    expect(resolveActive(items, "auto", at("/"))).toBe("home");
    expect(resolveActive(items, "auto", at("/about"))).toBe("about");
    expect(resolveActive(items, "auto", at("/about#team"))).toBe("team");
    expect(resolveActive(items, "auto", at("/blog"))).toBe("blog");
  });

  it("auto picks nothing when no link matches", () => {
    expect(resolveActive(items, "auto", at("/elsewhere"))).toBeUndefined();
  });
});

describe("hover and focus outline", () => {
  const font = {
    getPath: () => ({
      commands: [
        { type: "M", x: 0, y: 0 },
        { type: "L", x: 20, y: 0 },
        { type: "L", x: 20, y: 10 },
        { type: "L", x: 0, y: 10 },
        { type: "Z" },
      ],
    }),
  } as unknown as Font;
  const STAR = "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z";

  it.each([undefined, "ellipse", STAR])("sits inside its cell and is smaller (boundary %s)", (boundary) => {
    const cells = buildCells(
      {
        items: ["A", "B", "C", "D", "E", "F"].map((l) => ({ id: l, label: l, href: "#" })),
        width: 1000,
        height: 400,
        boundary,
        layout: { type: "voronoi", rngSeed: 3 },
      },
      font,
    );
    for (const c of cells) {
      expect(Math.abs(area(c.ring))).toBeLessThan(Math.abs(area(c.shape)));
      for (const p of c.ring) {
        const near = [0, 0.05, -0.05].some((d) => contains(c.shape, { x: p.x + d, y: p.y + d }));
        expect(near).toBe(true);
      }
    }
  });

  it("layout code is unaffected by the outline", () => {
    const a = voronoiLayout(5, 1000, 400, { rngSeed: 2 });
    expect(a.cells).toHaveLength(5);
  });
});

describe("active in the Spec", () => {
  it("is set by the builder", () => {
    expect(cellNav(["A", "B"]).active("b").spec().active).toBe("b");
    expect(cellNav(["A"]).active("auto").spec().active).toBe("auto");
  });

  it("is read from the tag", () => {
    expect(specFromAttributes({ items: "A", active: " auto " }, []).active).toBe("auto");
    expect(specFromAttributes({ items: "A" }, []).active).toBeUndefined();
  });
});
