import React from "react";
import { SVGPathData } from "svg-pathdata";

interface Point {
  x: number;
  y: number;
}

interface FittedTextProps {
  wordPath: string; // SVG path
  polygon: [Point, Point, Point, Point]; // 4-sided polygon
}

// 1) Compute bounding box for a path
function getPathBBox(path: string) {
  const commands = new SVGPathData(path).toAbs().commands;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

  for (const cmd of commands) {
    ["x", "x1", "x2"].forEach((kx) => {
      const keyX = kx as "x" | "x1" | "x2";
      if (cmd[keyX] !== undefined) {
        minX = Math.min(minX, cmd[keyX]!);
        maxX = Math.max(maxX, cmd[keyX]!);
      }
    });
    ["y", "y1", "y2"].forEach((ky) => {
      const keyY = ky as "y" | "y1" | "y2";
      if (cmd[keyY] !== undefined) {
        minY = Math.min(minY, cmd[keyY]!);
        maxY = Math.max(maxY, cmd[keyY]!);
      }
    });
  }

  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

// 2) Normalize path into box width x height (default 100x20)
function normalizePath(path: string, boxWidth = 100, boxHeight = 20): string {
  const bbox = getPathBBox(path);
  const scaleX = boxWidth / bbox.width;
  const scaleY = boxHeight / bbox.height;
  const scale = Math.min(scaleX, scaleY);

  const commands = new SVGPathData(path).toAbs().commands;
  const normalized = commands.map(cmd => {
    const clone = { ...cmd };
    ["x", "x1", "x2"].forEach((kx) => {
      const keyX = kx as "x" | "x1" | "x2";
      if (clone[keyX] !== undefined) {
        clone[keyX] = (clone[keyX]! - bbox.minX) * scale;
      }
    });
    ["y", "y1", "y2"].forEach((ky) => {
      const keyY = ky as "y" | "y1" | "y2";
      if (clone[keyY] !== undefined) {
        clone[keyY] = (clone[keyY]! - bbox.minY) * scale;
      }
    });
    return clone;
  });

  return SVGPathData.encode(normalized);
}

// Bilinear warp from unit square to quad
function bilinearWarp(x: number, y: number, quad: [Point, Point, Point, Point]): Point {
  const [p0, p1, p2, p3] = quad;
  const oneMinusX = 1 - x;
  const oneMinusY = 1 - y;
  return {
    x:
      oneMinusX * oneMinusY * p0.x +
      x * oneMinusY * p1.x +
      x * y * p2.x +
      oneMinusX * y * p3.x,
    y:
      oneMinusX * oneMinusY * p0.y +
      x * oneMinusY * p1.y +
      x * y * p2.y +
      oneMinusX * y * p3.y,
  };
}

function warpPath(
  path: string,
  quad: [Point, Point, Point, Point],
  width = 100,
  height = 20
): string {
  const commands = new SVGPathData(path).toAbs().commands;

  const warped = commands.map((cmd) => {
    const clone = { ...cmd };

    if ("x" in clone && "y" in clone) {
      const nx = clone.x! / width;
      const ny = clone.y! / height;
      const warped = bilinearWarp(nx, ny, quad);
      clone.x = warped.x;
      clone.y = warped.y;
    }

    if ("x1" in clone && "y1" in clone) {
      const nx = clone.x1! / width;
      const ny = clone.y1! / height;
      const warped = bilinearWarp(nx, ny, quad);
      clone.x1 = warped.x;
      clone.y1 = warped.y;
    }

    if ("x2" in clone && "y2" in clone) {
      const nx = clone.x2! / width;
      const ny = clone.y2! / height;
      const warped = bilinearWarp(nx, ny, quad);
      clone.x2 = warped.x;
      clone.y2 = warped.y;
    }

    return clone;
  });

  return SVGPathData.encode(warped);
}

interface FittedTextProps {
  wordPath: string;
  polygon: [Point, Point, Point, Point];
}

const FittedText: React.FC<FittedTextProps> = ({ wordPath, polygon }) => {
  const normalizedPath = normalizePath(wordPath);
  const warpedPath = warpPath(normalizedPath, polygon);

  return (
    <svg width={500} height={500} style={{ background: "#f9f9f9" }}>
      {/* Show polygon */}
      <path
        d={`M${polygon.map((p) => `${p.x},${p.y}`).join("L")}Z`}
        fill="#eee"
        stroke="#333"
      />

      {/* Warped text */}
      <path d={warpedPath} fill="black" />
    </svg>
  );
};

// Dummy example path, large shape:
const dummyPath = "M0 45.26L0 9.47L25.88 9.47L25.88 13.70L4.74 13.70L4.74 24.66L24.54 24.66L24.54 28.86L4.74 28.86L4.74 41.04L26.71 41.04L26.71 45.26L0 45.26ZM29.76 45.26L39.23 31.79L30.47 19.34L35.96 19.34L39.94 25.42Q41.06 27.15 41.75 28.32Q42.82 26.71 43.73 25.46L48.10 19.34L53.34 19.34L44.38 31.54L54.03 45.26L48.63 45.26L43.31 37.21L41.89 35.03L35.08 45.26L29.76 45.26ZM74.61 42.07Q72.17 44.14 69.91 45.00Q67.65 45.85 65.06 45.85Q60.79 45.85 58.50 43.76Q56.20 41.67 56.20 38.43Q56.20 36.52 57.07 34.95Q57.93 33.37 59.34 32.42Q60.74 31.47 62.50 30.98Q63.79 30.64 66.41 30.32Q71.73 29.69 74.24 28.81Q74.27 27.91 74.27 27.66Q74.27 24.98 73.02 23.88Q71.34 22.39 68.02 22.39Q64.92 22.39 63.44 23.47Q61.96 24.56 61.25 27.32L56.96 26.73Q57.54 23.97 58.89 22.28Q60.23 20.58 62.77 19.67Q65.31 18.75 68.65 18.75Q71.97 18.75 74.05 19.53Q76.12 20.31 77.10 21.50Q78.08 22.68 78.47 24.49Q78.69 25.61 78.69 28.54L78.69 34.40Q78.69 40.53 78.97 42.15Q79.25 43.77 80.08 45.26L75.49 45.26Q74.80 43.90 74.61 42.07M74.24 32.25Q71.85 33.23 67.07 33.91Q64.36 34.30 63.23 34.79Q62.11 35.28 61.50 36.22Q60.89 37.16 60.89 38.31Q60.89 40.06 62.22 41.24Q63.55 42.41 66.11 42.41Q68.65 42.41 70.63 41.30Q72.61 40.19 73.54 38.26Q74.24 36.77 74.24 33.86L74.24 32.25ZM85.50 45.26L85.50 19.34L89.43 19.34L89.43 22.97Q90.65 21.07 92.68 19.91Q94.70 18.75 97.29 18.75Q100.17 18.75 102.01 19.95Q103.86 21.14 104.61 23.29Q107.69 18.75 112.62 18.75Q116.48 18.75 118.55 20.89Q120.63 23.02 120.63 27.47L120.63 45.26L116.26 45.26L116.26 28.93Q116.26 26.29 115.83 25.13Q115.41 23.97 114.28 23.27Q113.16 22.56 111.65 22.56Q108.91 22.56 107.10 24.38Q105.30 26.20 105.30 30.20L105.30 45.26L100.90 45.26L100.90 28.42Q100.90 25.49 99.83 24.02Q98.75 22.56 96.31 22.56Q94.46 22.56 92.88 23.54Q91.31 24.51 90.60 26.39Q89.89 28.27 89.89 31.81L89.89 45.26L85.50 45.26ZM127.15 55.20L127.15 19.34L131.15 19.34L131.15 22.71Q132.57 20.73 134.35 19.74Q136.13 18.75 138.67 18.75Q141.99 18.75 144.53 20.46Q147.07 22.17 148.36 25.28Q149.66 28.39 149.66 32.10Q149.66 36.08 148.23 39.27Q146.80 42.46 144.08 44.15Q141.36 45.85 138.35 45.85Q136.16 45.85 134.41 44.92Q132.67 43.99 131.54 42.58L131.54 55.20L127.15 55.20M131.13 32.45Q131.13 37.45 133.15 39.84Q135.18 42.24 138.06 42.24Q140.99 42.24 143.08 39.76Q145.17 37.28 145.17 32.08Q145.17 27.12 143.13 24.66Q141.09 22.19 138.26 22.19Q135.45 22.19 133.29 24.82Q131.13 27.44 131.13 32.45ZM154.86 45.26L154.86 9.47L159.25 9.47L159.25 45.26L154.86 45.26ZM183.81 36.91L188.35 37.48Q187.28 41.46 184.38 43.65Q181.47 45.85 176.95 45.85Q171.26 45.85 167.93 42.35Q164.60 38.84 164.60 32.52Q164.60 25.98 167.97 22.36Q171.34 18.75 176.71 18.75Q181.91 18.75 185.21 22.29Q188.50 25.83 188.50 32.25Q188.50 32.64 188.48 33.42L169.14 33.42Q169.38 37.70 171.56 39.97Q173.73 42.24 176.98 42.24Q179.39 42.24 181.10 40.97Q182.81 39.70 183.81 36.91M169.38 29.81L183.86 29.81Q183.57 26.54 182.20 24.90Q180.10 22.36 176.76 22.36Q173.73 22.36 171.67 24.39Q169.60 26.42 169.38 29.81Z";
const polygon: [Point, Point, Point, Point] = [
  { x: 100, y: 100 },
  { x: 300, y: 120 },
  { x: 280, y: 300 },
  { x: 120, y: 280 },
];

export default function Demo() {
  return <FittedText wordPath={dummyPath} polygon={polygon} />;
}
