import { describe, expect, it } from "vitest";
import { splitText, type Font } from "../src";

// Every character is one unit wide when the font cannot measure.
const plain = {} as unknown as Font;
const split = (text: string, lengths: number[]) => splitText(plain, text, lengths).map((c) => c.text);

describe("sharing a label over pieces", () => {
  it("gives longer pieces more letters, in reading order", () => {
    const out = splitText(plain, "ABCDEFGH", [3, 1]);
    expect(out.map((o) => o.text).join("")).toBe("ABCDEFGH");
    expect(out).toHaveLength(2);
    expect(out[0]!.text.length).toBeGreaterThan(out[1]!.text.length);
    expect(out.map((o) => o.piece)).toEqual([0, 1]);
  });

  it("splits evenly across equal pieces", () => {
    expect(split("LOVE", [5, 5])).toEqual(["LO", "VE"]);
    expect(split("PLUS", [1, 1, 1, 1])).toEqual(["P", "L", "U", "S"]);
  });

  it("keeps the whole word in one piece when there is only one", () => {
    expect(split("HELLO", [4])).toEqual(["HELLO"]);
    expect(split("HELLO WORLD", [4])).toEqual(["HELLO WORLD"]);
  });

  it("every piece gets at least one letter, in order, with nothing lost", () => {
    for (const text of ["ABCDEFGHIJ", "A B C D E", "HELLO WORLD", "I AM", "XY"]) {
      for (const lengths of [[1, 1], [1, 1, 1], [9, 1], [1, 9, 1], [2, 5, 1, 3]]) {
        const out = splitText(plain, text, lengths);
        expect(out.length).toBeGreaterThan(0);
        expect(out.every((c) => c.text.length > 0)).toBe(true);
        expect(out.map((c) => c.text).join("").replace(/\s/g, "")).toBe(text.replace(/\s/g, ""));
        const pieces = out.map((c) => c.piece);
        expect([...pieces].sort((a, b) => a - b)).toEqual(pieces); // in reading order
        expect(new Set(pieces).size).toBe(pieces.length);
      }
    }
  });

  it("uses only the longest pieces when there are fewer letters than pieces", () => {
    const out = splitText(plain, "AB", [1, 5, 1, 4]);
    expect(out.map((o) => o.piece)).toEqual([1, 3]);
    expect(out.map((o) => o.text)).toEqual(["A", "B"]);
  });

  it("keeps a single letter in the longest piece, and ignores blanks", () => {
    expect(splitText(plain, "A", [1, 6, 2])).toEqual([{ text: "A", piece: 1 }]);
    expect(splitText(plain, "", [1, 2])).toEqual([]);
    expect(splitText(plain, "   ", [1, 2])).toEqual([]);
  });

  describe("prefers a break at a space", () => {
    it("breaks between two words rather than inside one", () => {
      expect(split("HELLO WORLD", [1, 1])).toEqual(["HELLO", "WORLD"]);
    });

    it("moves a cut to a space that is close to where it would fall", () => {
      // The even split would land inside "THERE"; the space after it is close enough.
      expect(split("HI THERE FRIEND", [1, 1])).toEqual(["HI THERE", "FRIEND"]);
    });

    it("picks the space nearest the ideal cut when there are several", () => {
      expect(split("A B C D E F", [1, 1])).toEqual(["A B C", "D E F"]);
    });

    it("does cut inside a word when no space is near enough", () => {
      // The only space is far from the middle, so the middle of the long word is cut instead.
      const out = split("ABCDEFGHIJ KL", [1, 1]);
      expect(out).toHaveLength(2);
      expect(out[0]!.length).toBeLessThan(10);
      expect(out.join(" ")).not.toBe("ABCDEFGHIJ KL");
    });

    it("breaks at spaces for several pieces too", () => {
      expect(split("ONE TWO THREE", [1, 1, 1])).toEqual(["ONE", "TWO", "THREE"]);
    });

    it("a word with no spaces is cut by the shares alone", () => {
      expect(split("ABCDEFGH", [1, 1])).toEqual(["ABCD", "EFGH"]);
    });

    it("a longer first piece takes more words", () => {
      expect(split("ONE TWO THREE FOUR", [3, 1])).toEqual(["ONE TWO THREE", "FOUR"]);
    });

    it("a space at the very start or end is not a break", () => {
      const out = splitText(plain, "  AB CD  ", [1, 1]).map((c) => c.text);
      expect(out).toEqual(["AB", "CD"]);
    });
  });

  it("measures letters by the font when it can, so wide letters take more room", () => {
    const wide = { getAdvanceWidth: (s: string) => (s === "W" ? 5 : 1) } as unknown as Font;
    // Counting characters the even split is "WA" | "BC"; W alone is already over half the width.
    expect(split("WABC", [1, 1])).toEqual(["WA", "BC"]);
    expect(splitText(wide, "WABC", [1, 1]).map((c) => c.text)).toEqual(["W", "ABC"]);
  });
});
