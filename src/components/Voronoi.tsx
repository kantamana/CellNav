import { P5Canvas } from "@p5-wrapper/react";
import type { P5CanvasInstance } from "@p5-wrapper/react";
import fontUrl from "../assets/fonts/Impact.ttf?url";
import { warpEffect, jiggleEffect } from "./effects";

type Point = { x: number; y: number; color?: string };
type Polygon = Point[];

interface VoronoiProps {
  width: number;
  height: number;
  pointsCount?: number;
}

const randomColor = () =>
  `hsl(${Math.floor(Math.random() * 360)}, 50%, 60%)`;

function clipPolygon(polygon: Polygon, a: number, b: number, c: number): Polygon {
  const inside = (p: Point) => a * p.x + b * p.y + c >= 0;
  const newPoly: Polygon = [];
  for (let i = 0; i < polygon.length; i++) {
    const curr = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const currInside = inside(curr);
    const nextInside = inside(next);

    if (currInside) newPoly.push(curr);
    if (currInside !== nextInside) {
      const t =
        (-(a * curr.x + b * curr.y + c)) /
        (a * (next.x - curr.x) + b * (next.y - curr.y));
      newPoly.push({
        x: curr.x + t * (next.x - curr.x),
        y: curr.y + t * (next.y - curr.y),
      });
    }
  }
  return newPoly;
}

function computeVoronoiCell(p: Point, others: Point[], bbox: Polygon): Polygon {
  let poly = bbox;
  for (const o of others) {
    if (o === p) continue;
    let a = 2 * (p.x - o.x);
    let b = 2 * (p.y - o.y);
    let c = o.x ** 2 + o.y ** 2 - p.x ** 2 - p.y ** 2;
    if (a * p.x + b * p.y + c < 0) {
      a = -a;
      b = -b;
      c = -c;
    }
    poly = clipPolygon(poly, a, b, c);
  }
  return poly;
}

function textBounds(contours: any[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const contour of contours) {
    for (const pt of contour) {
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }
  }

  return { minX, maxX, minY, maxY };
}

function insetPolygon(polygon: Polygon, margin: number): Polygon {
  if (polygon.length === 0) return polygon;

  // Calculate centroid
  let cx = 0,
    cy = 0;
  for (const pt of polygon) {
    cx += pt.x;
    cy += pt.y;
  }
  cx /= polygon.length;
  cy /= polygon.length;

  // Move each vertex towards centroid by margin
  return polygon.map((pt) => {
    const dx = cx - pt.x;
    const dy = cy - pt.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return pt;
    const scale = Math.max(0, (dist - margin) / dist);
    return {
      x: cx - dx * scale,
      y: cy - dy * scale,
    };
  });
}

const Voronoi = ({ width, height, pointsCount = 19 }: VoronoiProps) => {
  const sketch = (p: P5CanvasInstance) => {
    let font: any;
    let points: (Point & { vx: number; vy: number })[] = [];
    let time = 0;
    let cellData: {
      poly: Polygon;
      contours: any[];
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
      label: string;
      color: string;
    }[] = [];

    const smallWords = [
      "sun",
      "sky",
      "sea",
      "wave",
      "leaf",
      "code",
      "sand",
      "earth",
      "art",
      "pulse",
      "flow",
      "cell",
      "water",
      "fire",
      "dirt",
      "foam",
      "air",
      "grass",
      "wind",
    ];

    p.setup = async () => {
      p.createCanvas(width, height);
      font = await p.loadFont(fontUrl);

      points = Array.from({ length: pointsCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        color: randomColor(),
        vx: (Math.random() - 0.5) ,
        vy: (Math.random() - 0.5) ,
      }));
    };

    p.draw = () => {
      p.background(255);
      if (!font) return;

      time += 0.1;

      // Update points
      const bbox: Polygon = [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
      ];

      for (const pt of points) {
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Bounce off edges
        if (pt.x < 0 || pt.x > width) pt.vx *= -1;
        if (pt.y < 0 || pt.y > height) pt.vy *= -1;

        pt.x = Math.max(0, Math.min(width, pt.x));
        pt.y = Math.max(0, Math.min(height, pt.y));
      }

      // Recalculate Voronoi cells
      const polygons = points.map((pt) => computeVoronoiCell(pt, points, bbox));

      cellData = polygons.map((poly, index) => {
        const label = smallWords[index % smallWords.length].toUpperCase();
        const contours = font.textToContours(label, 0, 0, 140, {
          sampleFactor: 2,
        });
        const { minX, maxX, minY, maxY } = textBounds(contours);
        return {
          poly,
          contours,
          minX,
          maxX,
          minY,
          maxY,
          label,
          color: points[index].color ?? "#ffffff",
        };
      });

      // Draw cells
      for (const cell of cellData) {
        const { contours, minX, maxX, minY, maxY, color } = cell;
        const insetPoly = insetPolygon(cell.poly, 3);
        const effect = warpEffect(insetPoly, minX, maxX, minY, maxY);

        p.fill(color);
        p.noStroke();
        p.beginShape();
        for (const contour of contours) {
          p.beginContour();
          for (const point of contour) {
            const v = effect(p, point, 0);
            const jiggled = jiggleEffect(p, v, time);
            p.vertex(v.x + (jiggled.x - v.x), v.y + (jiggled.y - v.y));
          }
          p.endContour();
        }
        p.endShape(p.CLOSE);
      }
    };
  };

  return <P5Canvas sketch={sketch} />;
};

export default Voronoi;
