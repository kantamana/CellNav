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

  const squareBoundaryCage = (n: number): ContourPoint[] => {
    if (n <= 4) {
      const corners: ContourPoint[] = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ];
      return corners.slice(0, n);
    }

    const extra = n - 4;
    const base = Math.floor(extra / 4);
    const remainder = extra % 4;
    const edgeCounts = [base, base, base, base];
    for (let i = 0; i < remainder; i++) {
      edgeCounts[i] += 1;
    }

    const corners: ContourPoint[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];

    const result: ContourPoint[] = [];
    for (let edge = 0; edge < 4; edge++) {
      const start = corners[edge];
      const end = corners[(edge + 1) % 4];
      result.push(start);

      const count = edgeCounts[edge];
      for (let j = 0; j < count; j++) {
        const t = (j + 1) / (count + 1);
        result.push({
          x: start.x + (end.x - start.x) * t,
          y: start.y + (end.y - start.y) * t,
        });
      }
    }

    return result;
  };

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

    const sourcePolygon = squareBoundaryCage(polygon.length);
    const debugSize = 120;
    const debugX = 460;
    const debugY = 20;

    // Draw the target polygon outline and numbered vertices
    const cx = polygon.reduce((sum, pt) => sum + pt.x, 0) / polygon.length;
    const cy = polygon.reduce((sum, pt) => sum + pt.y, 0) / polygon.length;

    p.push();
    p.noFill();
    p.stroke(255, 120);
    p.strokeWeight(2);
    p.beginShape();
    for (const point of polygon) {
      p.vertex(point.x, point.y);
    }
    p.endShape(p.CLOSE);

    p.fill(255);
    p.noStroke();
    p.textSize(12);
    p.textAlign(p.CENTER, p.CENTER);
    for (let i = 0; i < polygon.length; i++) {
      const point = polygon[i];
      const dx = point.x - cx;
      const dy = point.y - cy;
      const mag = Math.hypot(dx, dy) || 1;
      const labelX = point.x + (dx / mag) * 12;
      const labelY = point.y + (dy / mag) * 12;
      p.circle(point.x, point.y, 6);
      p.fill(0);
      p.text(`${i}`, labelX, labelY);
      p.fill(255);
    }
    p.pop();

    // Draw the source square cage separately as a debug legend
    p.push();
    p.stroke(0, 200, 255);
    p.strokeWeight(1.5);
    p.noFill();
    p.rect(debugX, debugY, debugSize, debugSize);
    p.beginShape();
    for (const pt of sourcePolygon) {
      p.vertex(debugX + pt.x * debugSize, debugY + pt.y * debugSize);
    }
    p.endShape(p.CLOSE);

    p.fill(0, 200, 255);
    p.noStroke();
    p.textSize(10);
    for (let i = 0; i < sourcePolygon.length; i++) {
      const pt = sourcePolygon[i];
      const x = debugX + pt.x * debugSize;
      const y = debugY + pt.y * debugSize;
      p.circle(x, y, 5);
      p.fill(255);
      p.text(`${i}`, x, y - 10);
      p.fill(0, 200, 255);
    }
    p.fill(255, 255, 255, 160);
    p.textSize(11);
    p.textAlign(p.LEFT, p.TOP);
    p.text("source square cage", debugX, debugY + debugSize + 6);
    p.pop();
  };
};

export default function P5SketchWrapper() {
  return <P5Canvas sketch={sketch} />;
}