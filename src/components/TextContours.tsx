import { P5Canvas } from "@p5-wrapper/react";
import type { P5CanvasInstance } from "@p5-wrapper/react";

import fontUrl from "../assets/fonts/Courier New Bold.ttf?url";
import { warpEffect } from "./effects";
import { polygon } from "./polygon";


type ContourPoint = { x: number; y: number };

const TEXT = "HELLO";

const sketch = (p: P5CanvasInstance) => {
  let font: any; // p5.Font type depends on typings setup
  let contours: any[] = [];
  let minX = 0, maxX = 0, minY = 0, maxY = 0;

  p.setup = async () => {
    p.createCanvas(600, 300);

    font = await p.loadFont(fontUrl);

    contours = font.textToContours(TEXT, 10, 10, {
      sampleFactor: 3,
    });

    // compute bounds
    let allPoints: ContourPoint[] = [];
    for (const contour of contours) {
      allPoints.push(...contour);
    }
    minX = Math.min(...allPoints.map(pt => pt.x));
    maxX = Math.max(...allPoints.map(pt => pt.x));
    minY = Math.min(...allPoints.map(pt => pt.y));
    maxY = Math.max(...allPoints.map(pt => pt.y));
  };

  p.draw = () => {
    p.background(20);
    p.fill("#ffbe0b")
    p.stroke(255);

    const t = p.millis() * 0.002;

    const effect = warpEffect(polygon, minX, maxX, minY, maxY);

    p.beginShape();

    for (const contour of contours) {
      p.beginContour();

      for (const point of contour) {
        const v = effect(p, point, t);
        p.vertex(v.x, v.y);
      }

      p.endContour();
    }

    p.endShape();

    // Draw the polygon outline
    p.noFill();
    p.stroke(255, 100); // semi-transparent white
    p.strokeWeight(2);
    p.beginShape();
    for (const point of polygon) {
      p.vertex(point.x, point.y);
    }
    p.endShape(p.CLOSE);
  };
};

export default function P5SketchWrapper() {
  return <P5Canvas sketch={sketch} />;
}