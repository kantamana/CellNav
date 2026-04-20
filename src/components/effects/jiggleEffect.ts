import type { P5CanvasInstance } from "@p5-wrapper/react";
import type { Point } from "../polygon";

export const jiggleEffect = (p: P5CanvasInstance, pt: Point, t: number) => {
  const noiseY = p.noise(pt.x * 0.1, t) * 6;
  const noiseX = p.noise(pt.y * 0.1, t) * 6;

  return {
    x: pt.x + noiseX,
    y: pt.y + noiseY,
  };
};