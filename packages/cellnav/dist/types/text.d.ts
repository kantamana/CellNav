import opentype from "opentype.js";
import type { Point } from "./geometry";
export type Font = opentype.Font;
export declare function loadFont(url: string): Promise<Font>;
export interface OutlineOptions {
    /**
     * The size in px of the shape the text will be bent to fill. With it, points
     * are added until no stretch of outline is longer than `segmentPx` once it is
     * drawn, so curves do not turn into polygons however large the word is.
     * Without it, a fixed, coarser sampling is used.
     */
    width?: number;
    height?: number;
    /** Longest stretch of finished outline, in px. Default 2.5. */
    segmentPx?: number;
    /** 0 to 1: how far rounded letters are squared up into their corners. Default 0 here; the cell pipeline passes its own default (1). */
    cornerFill?: number;
}
/**
 * Text as closed contours inside the unit square (stretched to fill it). The
 * outline is flattened finely enough for the size it will be drawn at: p5 adds
 * vertices the same way (`sampleFactor`), and for the same reason, because a
 * warp stretches every straight piece and any corner between pieces shows.
 */
export declare function textContours(font: Font, text: string, opts?: OutlineOptions): Point[][];
/**
 * Shares a label out over several pieces that are read in order, like line
 * breaks. `lengths` is how long each piece is along the reading direction; a
 * longer piece takes more of the text. Each cut goes where the shares say, but
 * prefers a space close by to a spot in the middle of a word. Every piece gets
 * at least one letter, so if there are fewer letters than pieces only the
 * longest pieces are used.
 */
export declare function splitText(font: Font, text: string, lengths: number[]): {
    text: string;
    piece: number;
}[];
