import { P5Canvas } from "@p5-wrapper/react";
import type { P5CanvasInstance } from "@p5-wrapper/react";

import fontUrl from "../assets/fonts/Courier New Bold.ttf?url";
import { jiggleEffect } from "./effects";


type ContourPoint = { x: number; y: number };
type Contour = ContourPoint[];

const TEXT = "HELLO";
const SCALE = 10;

const sketch = (p: P5CanvasInstance) => {
  let font: any; // p5.Font type depends on typings setup
  let contours: any[] = [];

  p.setup = async () => {
    p.createCanvas(600, 300);

    font = await p.loadFont(fontUrl);

    contours = font.textToContours(TEXT, 10, 10, {
      sampleFactor: 2,
    });
  };

  p.draw = () => {
    p.background(20);
    p.fill("#ffbe0b")
    p.stroke(255);

    const t = p.millis() * 0.002;

    p.beginShape();

    for (const contour of contours) {
      p.beginContour();

      for (const point of contour) {
        const v = jiggleEffect(p, point, t);
        p.vertex(v.x * SCALE, v.y * SCALE);
      }

      p.endContour();
    }

    p.endShape();
  };
};

export default function P5SketchWrapper() {
  return <P5Canvas sketch={sketch} />;
}