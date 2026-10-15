import { afterEach, describe, expect, it, vi } from "vitest";
import {
  area,
  bounds,
  buildCells,
  cellNav,
  coverRect,
  image,
  measureImages,
  resolveBoundary,
  targetAspect,
  voronoiLayout,
  type Font,
  type Item,
  type Spec,
} from "../src";
import { specFromAttributes } from "../src/attributes";

const W = 1000;
const H = 400;
const ASPECTS = [3, 0.5, 1, 2, 0.7, 1.4];
const seeds = Array.from({ length: 12 }, (_, i) => i + 1);

describe("target proportions", () => {
  it("keeps the layout's stretch at blend 0 and takes the picture's at 1", () => {
    expect(targetAspect(2.5, 0.5, 0)).toBeCloseTo(2.5, 9);
    expect(targetAspect(2.5, 0.5, 1)).toBeCloseTo(0.5, 9);
  });

  it("lands in between for a blend in between, as a ratio", () => {
    expect(targetAspect(4, 1, 0.5)).toBeCloseTo(2, 9);
    expect(targetAspect(2, 8, 0.5)).toBeCloseTo(4, 9);
  });

  it("ignores a missing or nonsense picture shape and clamps the blend", () => {
    expect(targetAspect(2.5, undefined, 1)).toBe(2.5);
    expect(targetAspect(2.5, 0, 1)).toBe(2.5);
    expect(targetAspect(2.5, NaN, 1)).toBe(2.5);
    expect(targetAspect(2.5, 0.5, 7)).toBeCloseTo(0.5, 9);
    expect(targetAspect(2.5, 0.5, -3)).toBeCloseTo(2.5, 9);
  });
});

describe("cells that lean towards their pictures", () => {
  const targetsFor = (blend: number) => ASPECTS.map((a) => targetAspect(2.5, a, blend));
  const aspectOf = (poly: { x: number; y: number }[]) => bounds(poly).width / bounds(poly).height;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const meanAspects = (blend: number, region = resolveBoundary(undefined, W, H)) => {
    const rows = seeds.map((rngSeed) =>
      voronoiLayout(6, W, H, { rngSeed }, region, targetsFor(blend)).cells.map(aspectOf),
    );
    return { wide: mean(rows.map((r) => r[0]!)), tall: mean(rows.map((r) => r[1]!)) };
  };

  it("does nothing when no picture asks for a different shape", () => {
    const plain = voronoiLayout(6, W, H, { rngSeed: 3 });
    const same = voronoiLayout(6, W, H, { rngSeed: 3 }, undefined, ASPECTS.map(() => 2.5));
    expect(same.cells).toEqual(plain.cells);
  });

  it("a wide picture gets a wider cell than a tall one", () => {
    const m = meanAspects(1);
    expect(m.wide).toBeGreaterThan(m.tall * 3);
  });

  it("leans further the higher the blend", () => {
    const [a, b, c] = [0, 0.5, 1].map((x) => meanAspects(x));
    expect(a!.tall).toBeGreaterThan(b!.tall);
    expect(b!.tall).toBeGreaterThan(c!.tall);
    expect(c!.wide).toBeGreaterThan(a!.wide);
    // "Tend towards, but not quite": halfway sits clearly between the extremes.
    expect(b!.tall).toBeGreaterThan(c!.tall * 1.3);
    expect(b!.tall).toBeLessThan(a!.tall * 0.7);
  });

  it("matches the targets much better than an unsteered layout", () => {
    const error = (steer: boolean) =>
      mean(
        seeds.map((rngSeed) => {
          const cells = voronoiLayout(6, W, H, { rngSeed }, undefined, steer ? targetsFor(1) : undefined).cells;
          return mean(cells.map((c, i) => Math.abs(Math.log(aspectOf(c) / targetsFor(1)[i]!))));
        }),
      );
    expect(error(true)).toBeLessThan(error(false) * 0.5);
  });

  it("is deterministic", () => {
    const a = voronoiLayout(6, W, H, { rngSeed: 4 }, undefined, targetsFor(1));
    const b = voronoiLayout(6, W, H, { rngSeed: 4 }, undefined, targetsFor(1));
    expect(a.cells).toEqual(b.cells);
  });

  const STAR = "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z";
  it.each([undefined, "ellipse", "hexagon", STAR])("still tiles the boundary exactly (%s)", (name) => {
    const region = resolveBoundary(name, W, H);
    const regionArea = Math.abs(area(region));
    for (const rngSeed of [1, 2, 3]) {
      const { cells } = voronoiLayout(6, W, H, { rngSeed }, region, targetsFor(1));
      const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
      expect(total).toBeGreaterThan(regionArea * 0.97);
      expect(total).toBeLessThan(regionArea * 1.01);
      expect(cells.every((c) => c.length >= 3)).toBe(true);
    }
  });
});

describe("image fill cells", () => {
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

  const items = (withImages: boolean): Item[] =>
    ["A", "B", "C", "D", "E"].map((l, i) => ({
      id: l,
      label: l,
      href: "#",
      ...(withImages && i !== 2 && { image: `/${l}.jpg`, aspect: ASPECTS[i] }),
    }));
  const spec = (fill: Spec["fill"], withImages = true): Spec => ({
    items: items(withImages),
    width: W,
    height: H,
    layout: { type: "voronoi" as const, rngSeed: 5 },
    ...(fill && { fill }),
  });

  it("gives items with a picture an image and a hover label", () => {
    const cells = buildCells(spec({ type: "image" }), font);
    expect(cells.map((c) => c.image)).toEqual(["/A.jpg", "/B.jpg", undefined, "/D.jpg", "/E.jpg"]);
    expect(cells.map((c) => c.labelMode)).toEqual(["hover", "hover", "always", "hover", "hover"]);
  });

  it("a cell without a picture keeps its label visible", () => {
    expect(buildCells(spec({ type: "image", labels: "none" }), font)[2]!.labelMode).toBe("always");
  });

  it("honours the labels setting", () => {
    for (const labels of ["always", "none"] as const)
      expect(buildCells(spec({ type: "image", labels }), font)[0]!.labelMode).toBe(labels);
  });

  it("text fills never carry a picture", () => {
    for (const c of buildCells(spec({ type: "text" }), font)) {
      expect(c.image).toBeUndefined();
      expect(c.labelMode).toBe("always");
    }
  });

  it("an image fill with no pictures lays out exactly like the text fill", () => {
    const a = buildCells(spec({ type: "image" }, false), font).map((c) => c.shape);
    const b = buildCells(spec({ type: "text" }, false), font).map((c) => c.shape);
    expect(a).toEqual(b);
  });

  it("aspectBlend 0 keeps the text layout; a higher blend changes it", () => {
    const text = buildCells(spec({ type: "text" }), font).map((c) => c.shape);
    const none = buildCells(spec({ type: "image", aspectBlend: 0 }), font).map((c) => c.shape);
    const some = buildCells(spec({ type: "image", aspectBlend: 1 }), font).map((c) => c.shape);
    expect(none).toEqual(text);
    expect(some).not.toEqual(text);
  });

  it("is set by the builder", () => {
    const s = cellNav(["A"]).fill(image({ aspectBlend: 0.7, labels: "always" })).spec();
    expect(s.fill).toEqual({ type: "image", aspectBlend: 0.7, labels: "always" });
  });
});

describe("pictures in tag attributes", () => {
  it("reads fill, aspect-blend and labels", () => {
    const s = specFromAttributes(
      { items: "A", fill: "image", aspectBlend: "0.8", labels: "always" },
      [],
    );
    expect(s.fill).toEqual({ type: "image", aspectBlend: 0.8, labels: "always" });
  });

  it("defaults to a text fill, and drops junk values", () => {
    expect(specFromAttributes({ items: "A" }, []).fill).toEqual({ type: "text" });
    expect(specFromAttributes({ items: "A", fill: "video", labels: "sometimes", aspectBlend: "x" }, []).fill).toEqual({ type: "text" });
  });

  it("reads pictures and proportions from item JSON", () => {
    const s = specFromAttributes(
      { items: '[{"label":"Sea","href":"/sea","image":"sea.jpg","aspect":1.5},{"label":"Sky","image":"sky.jpg","aspect":-3},"Sun"]' },
      [],
    );
    expect(s.items[0]).toEqual({ id: "sea", label: "Sea", href: "/sea", image: "sea.jpg", aspect: 1.5 });
    expect(s.items[1]).toMatchObject({ image: "sky.jpg" });
    expect(s.items[1]!.aspect).toBeUndefined(); // a nonsense shape is dropped
    expect(s.items[2]!.image).toBeUndefined();
  });
});

describe("measuring pictures", () => {
  const loaded: string[] = [];
  class FakeImage {
    onload?: () => void;
    onerror?: () => void;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(url: string) {
      loaded.push(url);
      if (url.includes("hang")) return; // never answers
      setTimeout(() => {
        if (url.includes("bad")) this.onerror?.();
        else {
          this.naturalWidth = url.includes("tall") ? 400 : 800;
          this.naturalHeight = url.includes("tall") ? 800 : 400;
          this.onload?.();
        }
      }, 0);
    }
  }
  afterEach(() => vi.unstubAllGlobals());

  const item = (image?: string, aspect?: number): Item => ({ id: "x", label: "X", href: "#", image, aspect });

  it("reads each picture's width:height", async () => {
    vi.stubGlobal("Image", FakeImage);
    const [wide, tall] = await measureImages([item("/m-wide.jpg"), item("/m-tall.jpg")]);
    expect(wide!.aspect).toBe(2);
    expect(tall!.aspect).toBe(0.5);
  });

  it("asks only once per picture, and skips ones that already know", async () => {
    vi.stubGlobal("Image", FakeImage);
    loaded.length = 0;
    await measureImages([item("/once.jpg"), item("/once.jpg"), item("/known.jpg", 1.5), item(undefined)]);
    await measureImages([item("/once.jpg")]);
    expect(loaded.filter((u) => u === "/once.jpg")).toHaveLength(1);
    expect(loaded).not.toContain("/known.jpg");
  });

  it("leaves a picture that fails or hangs without a shape", async () => {
    vi.stubGlobal("Image", FakeImage);
    const [bad, hang] = await measureImages([item("/bad.jpg"), item("/hang.jpg")], 30);
    expect(bad!.aspect).toBeUndefined();
    expect(hang!.aspect).toBeUndefined();
  });
});

describe("cells that fit their pictures' shape", () => {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const targets = ASPECTS.map((a) => targetAspect(2.5, a, 1));
  // Share of a picture that stays visible: it covers the cell's bounding box
  // and is clipped to the cell, so this is the cell's area over that box.
  const visible = (poly: { x: number; y: number }[]) => {
    const b = bounds(poly);
    return Math.abs(area(poly)) / (b.width * b.height);
  };
  const aspectError = (cells: { x: number; y: number }[][]) =>
    mean(cells.map((c, i) => Math.abs(Math.log(bounds(c).width / bounds(c).height / targets[i]!))));

  const run = (weight: number, name: string | undefined) => {
    const region = resolveBoundary(name, W, H);
    const rows = seeds.map((rngSeed) =>
      voronoiLayout(6, W, H, { rngSeed }, region, targets, ASPECTS.map(() => weight)).cells,
    );
    return {
      visible: mean(rows.map((cells) => mean(cells.map(visible)))),
      worst: Math.min(...rows.map((cells) => Math.min(...cells.map(visible)))),
      error: mean(rows.map(aspectError)),
    };
  };

  it.each([undefined, "ellipse"])("shows more of each picture, without a worse aspect fit (%s)", (name) => {
    const without = run(0, name);
    const withFit = run(0.5, name);
    expect(withFit.visible).toBeGreaterThan(without.visible + 0.04);
    expect(withFit.error).toBeLessThan(without.error + 0.08);
  });

  it("in a plain box the typical picture is mostly visible and none is nearly lost", () => {
    const r = run(0.5, undefined);
    expect(r.visible).toBeGreaterThan(0.88);
    expect(r.worst).toBeGreaterThan(0.5);
  });

  it("asking for rectangles alone also works, even if no picture's shape is known", () => {
    const flat = ASPECTS.map(() => 2.5);
    const plain = voronoiLayout(6, W, H, { rngSeed: 3 }, undefined, flat);
    const rect = voronoiLayout(6, W, H, { rngSeed: 3 }, undefined, flat, flat.map(() => 0.5));
    expect(rect.cells).not.toEqual(plain.cells);
    expect(mean(rect.cells.map(visible))).toBeGreaterThan(mean(plain.cells.map(visible)));
  });

  const STAR = "M50 0 L61 35 L98 35 L68 57 L79 91 L50 70 L21 91 L32 57 L2 35 L39 35 Z";
  it.each([undefined, "ellipse", STAR])("still tiles the boundary exactly (%s)", (name) => {
    const region = resolveBoundary(name, W, H);
    const regionArea = Math.abs(area(region));
    for (const rngSeed of [1, 2, 3]) {
      const { cells } = voronoiLayout(6, W, H, { rngSeed }, region, targets, ASPECTS.map(() => 0.5));
      const total = cells.reduce((s, c) => s + Math.abs(area(c)), 0);
      expect(total).toBeGreaterThan(regionArea * 0.97);
      expect(total).toBeLessThan(regionArea * 1.01);
    }
  });

  describe("through the Spec", () => {
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
    const specWith = (fill: Spec["fill"], rngSeed: number): Spec => ({
      items: ["A", "B", "C", "D", "E", "F"].map((l, i) => ({
        id: l,
        label: l,
        href: "#",
        image: `/${l}.jpg`,
        aspect: ASPECTS[i],
      })),
      width: W,
      height: H,
      layout: { type: "voronoi", rngSeed },
      fill,
    });
    const shown = (shapeFit: number | undefined) =>
      mean(
        seeds.map((rngSeed) =>
          mean(
            buildCells(
              specWith({ type: "image", aspectBlend: 1, ...(shapeFit !== undefined && { shapeFit }) }, rngSeed),
              font,
            ).map((c) => visible(c.shape)),
          ),
        ),
      );

    it("shapeFit 1 (the default) shows more of the pictures than shapeFit 0", () => {
      expect(shown(undefined)).toBeGreaterThan(shown(0) + 0.03);
      expect(shown(1)).toBeCloseTo(shown(undefined), 9);
    });

    it("shapeFit 0 with aspectBlend 0 leaves the plain text layout alone", () => {
      const text = buildCells(specWith({ type: "text" }, 3), font).map((c) => c.shape);
      const off = buildCells(specWith({ type: "image", aspectBlend: 0, shapeFit: 1 }, 3), font).map((c) => c.shape);
      expect(off).toEqual(text);
    });
  });

  it("is read from the tag and set by the builder", () => {
    expect(specFromAttributes({ items: "A", fill: "image", shapeFit: "0.3" }, []).fill).toEqual({
      type: "image",
      shapeFit: 0.3,
    });
    expect(cellNav(["A"]).fill(image({ shapeFit: 0.4 })).spec().fill).toEqual({ type: "image", shapeFit: 0.4 });
  });
});

describe("covering a cell with a picture", () => {
  const box = { x: 100, y: 50, width: 300, height: 100 };
  const sides = (r: { x: number; y: number; width: number; height: number }) => ({
    left: r.x,
    top: r.y,
    right: r.x + r.width,
    bottom: r.y + r.height,
  });

  it.each([0.2, 0.5, 1, 3, 5, 12])("always covers the whole box (picture %s)", (aspect) => {
    const r = sides(coverRect(box, aspect));
    expect(r.left).toBeLessThanOrEqual(box.x + 1e-9);
    expect(r.top).toBeLessThanOrEqual(box.y + 1e-9);
    expect(r.right).toBeGreaterThanOrEqual(box.x + box.width - 1e-9);
    expect(r.bottom).toBeGreaterThanOrEqual(box.y + box.height - 1e-9);
  });

  it.each([0.2, 0.5, 1, 3, 5, 12])("keeps the picture's own shape (picture %s)", (aspect) => {
    const r = coverRect(box, aspect);
    expect(r.width / r.height).toBeCloseTo(aspect, 9);
  });

  it.each([0.2, 1, 5])("is centred on the box (picture %s)", (aspect) => {
    const r = coverRect(box, aspect);
    expect(r.x + r.width / 2).toBeCloseTo(box.x + box.width / 2, 9);
    expect(r.y + r.height / 2).toBeCloseTo(box.y + box.height / 2, 9);
  });

  it("touches both sides it fits exactly, and overflows only the other one", () => {
    // Picture and box have the same shape: no crop at all.
    expect(coverRect(box, 3)).toEqual(box);
    // Tall picture in a wide box: full width, cropped top and bottom.
    const tall = coverRect(box, 0.5);
    expect(tall.width).toBeCloseTo(box.width, 9);
    expect(tall.height).toBeGreaterThan(box.height);
    // Wide picture in the same box: full height, cropped left and right.
    const wide = coverRect(box, 12);
    expect(wide.height).toBeCloseTo(box.height, 9);
    expect(wide.width).toBeGreaterThan(box.width);
  });
});

describe("cells carry their picture's shape", () => {
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

  it("passes the aspect through, only for image cells", () => {
    const items: Item[] = [
      { id: "a", label: "A", href: "#", image: "/a.jpg", aspect: 1.5 },
      { id: "b", label: "B", href: "#", image: "/b.jpg" },
      { id: "c", label: "C", href: "#", aspect: 2 },
    ];
    const image = buildCells({ items, width: W, height: H, fill: { type: "image" } }, font);
    expect(image.map((c) => c.imageAspect)).toEqual([1.5, undefined, undefined]);
    const text = buildCells({ items, width: W, height: H, fill: { type: "text" } }, font);
    expect(text.every((c) => c.imageAspect === undefined)).toBe(true);
  });
});
