import { describe, expect, it } from "vitest";
import { cellNav, noise } from "../src";
import { specFromAttributes } from "../src/attributes";

const read = (a: Record<string, string | null>) => specFromAttributes({ items: "A,B", ...a }, []).effects;

describe("noise in HTML attributes", () => {
  it("is off unless the noise attribute is there", () => {
    expect(read({})).toBeUndefined();
    expect(read({ noiseAmount: "9", noiseOn: "hover" })).toBeUndefined();
  });

  it("a bare noise attribute switches on the default look", () => {
    expect(read({ noise: "" })).toEqual([{ type: "noise" }]);
    expect(read({ noise: "true" })).toEqual([{ type: "noise" }]);
  });

  it("takes a preset", () => {
    expect(read({ noise: "jitter" })).toEqual([{ type: "noise", preset: "jitter" }]);
    expect(read({ noise: " Wobble " })).toEqual([{ type: "noise", preset: "wobble" }]);
  });

  it("can be turned off again", () => {
    for (const v of ["off", "false", "none"]) expect(read({ noise: v })).toBeUndefined();
  });

  it("reads every option", () => {
    expect(
      read({
        noise: "wobble",
        noiseTarget: "both",
        noiseOn: "hover, about",
        noiseAmount: "5",
        noiseScale: "30",
        noiseSpeed: "0.5",
        noiseSeed: "12",
        noiseEase: "400",
      }),
    ).toEqual([
      {
        type: "noise",
        preset: "wobble",
        target: "both",
        on: ["hover", "about"],
        amount: 5,
        scale: 30,
        speed: 0.5,
        seed: 12,
        ease: 400,
      },
    ]);
  });

  it("reads a random seed", () => {
    expect(read({ noise: "", noiseSeed: "random" })).toEqual([{ type: "noise", seed: "random" }]);
  });

  it("drops values that are not valid, rather than guessing", () => {
    expect(read({ noise: "sparkly", noiseTarget: "everywhere", noiseAmount: "lots", noiseOn: " , " })).toEqual([
      { type: "noise" },
    ]);
  });

  it("a full spec attribute can carry several effects", () => {
    const effects = [
      { type: "noise", preset: "jitter", on: "hover" },
      { type: "noise", target: "cells", speed: 0 },
    ];
    expect(specFromAttributes({ spec: JSON.stringify({ items: [], width: 1, height: 1, effects }) }, []).effects).toEqual(
      effects,
    );
  });
});

describe("effects in the builder", () => {
  it("noise() makes a plain noise effect", () => {
    expect(noise()).toEqual({ type: "noise" });
    expect(noise({ preset: "jitter", on: "hover", target: "text" })).toEqual({
      type: "noise",
      preset: "jitter",
      on: "hover",
      target: "text",
    });
  });

  it("effects stack in the order added, and the builder stays immutable", () => {
    const base = cellNav(["A", "B"]);
    const one = base.effect(noise({ preset: "jitter", on: "hover" }));
    const two = one.effect(noise({ preset: "wobble", target: "cells" }));
    expect(base.spec().effects).toBeUndefined();
    expect(one.spec().effects).toHaveLength(1);
    expect(two.spec().effects?.map((e) => e.preset)).toEqual(["jitter", "wobble"]);
  });

  it("is only data, so it round-trips as JSON", () => {
    const spec = cellNav(["A"]).effect(noise({ preset: "wobble", on: ["hover", "a"] })).spec();
    expect(JSON.parse(JSON.stringify(spec)).effects).toEqual(spec.effects);
  });
});

describe("effects as JSON in the tag", () => {
  it("reads a list of any effect type, including one registered later", () => {
    expect(read({ effects: '[{"type":"shake","on":"hover"},{"type":"noise","speed":2}]' })).toEqual([
      { type: "shake", on: "hover" },
      { type: "noise", speed: 2 },
    ]);
  });

  it("goes after the noise attribute's effect", () => {
    expect(read({ noise: "jitter", effects: '[{"type":"shake"}]' })).toEqual([
      { type: "noise", preset: "jitter" },
      { type: "shake" },
    ]);
  });

  it("an empty value means no effects", () => {
    expect(read({ effects: "" })).toBeUndefined();
    expect(read({ effects: "[]" })).toBeUndefined();
  });

  it.each(["not json", '{"type":"noise"}', '[{"on":"hover"}]', "[1,2]", "[null]"])(
    "rejects %s with a message that shows the right shape",
    (bad) => {
      expect(() => read({ effects: bad })).toThrow(/JSON list of effects/);
    },
  );
});

describe("area-preserving noise in the tag and builder", () => {
  it("reads noise-preserve", () => {
    // the earlier name for noise-mode="shear"
    expect(read({ noise: "", noisePreserve: "area" })).toEqual([{ type: "noise", mode: "shear" }]);
    expect(read({ noise: "wobble", noisePreserve: " Area " })).toEqual([
      { type: "noise", preset: "wobble", mode: "shear" },
    ]);
  });

  it("ignores any other value", () => {
    expect(read({ noise: "", noisePreserve: "volume" })).toEqual([{ type: "noise" }]);
    expect(read({ noise: "", noisePreserve: "" })).toEqual([{ type: "noise" }]);
  });

  it("is set by the builder", () => {
    expect(cellNav(["A"]).effect(noise({ preserve: "area" })).spec().effects).toEqual([
      { type: "noise", preserve: "area" },
    ]);
  });
});

describe("noise-mode in the tag and builder", () => {
  it("reads shear and swell, in any case", () => {
    expect(read({ noise: "", noiseMode: "shear" })).toEqual([{ type: "noise", mode: "shear" }]);
    expect(read({ noise: "", noiseMode: " Swell " })).toEqual([{ type: "noise", mode: "swell" }]);
  });

  it("ignores any other value, leaving the default", () => {
    expect(read({ noise: "", noiseMode: "free" })).toEqual([{ type: "noise" }]);
    expect(read({ noise: "", noiseMode: "twist" })).toEqual([{ type: "noise" }]);
  });

  it("works with a preset and the other options", () => {
    expect(read({ noise: "jitter", noiseMode: "swell", noiseSize: "2" })).toEqual([
      { type: "noise", preset: "jitter", mode: "swell", size: 2 },
    ]);
  });

  it("an explicit mode wins over the older noise-preserve", () => {
    expect(read({ noise: "", noiseMode: "swell", noisePreserve: "area" })).toEqual([{ type: "noise", mode: "swell" }]);
  });

  it("is set by the builder", () => {
    expect(cellNav(["A"]).effect(noise({ mode: "swell" })).spec().effects).toEqual([{ type: "noise", mode: "swell" }]);
  });
});

describe("noise size in the tag and builder", () => {
  it("reads noise-size", () => {
    expect(read({ noise: "", noiseSize: "2.5" })).toEqual([{ type: "noise", size: 2.5 }]);
  });
  it("ignores a size that is not a number", () => {
    expect(read({ noise: "", noiseSize: "huge" })).toEqual([{ type: "noise" }]);
  });
  it("is set by the builder", () => {
    expect(cellNav(["A"]).effect(noise({ size: 2 })).spec().effects).toEqual([{ type: "noise", size: 2 }]);
  });
});

describe("ids made from labels", () => {
  it("never end up empty or with stray hyphens", () => {
    const ids = specFromAttributes({ items: "Hello World!,!!!,  Spaced  ,A-B" }, []).items.map((i) => i.id);
    expect(ids).toEqual(["hello-world", "item", "spaced", "a-b"]);
    expect(cellNav(["!!!", "Hi!"]).spec().items.map((i) => i.id)).toEqual(["item", "hi"]);
  });
});
