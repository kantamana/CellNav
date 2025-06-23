import React, { useMemo } from "react";

type Point = { x: number; y: number };
type Polygon = Point[];

interface VoronoiProps {
  width: number;
  height: number;
  pointsCount?: number;
}

const randomColor = () =>
  `hsl(${Math.floor(Math.random() * 360)}, 70%, 70%)`;

// Helper to clip polygon by half-plane
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
      // Line segment intersects half-plane boundary
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

// Compute Voronoi cell polygon for point `p` given others and bounding box
function computeVoronoiCell(
  p: Point,
  others: Point[],
  bbox: Polygon
): Polygon {
  let poly = bbox;

  for (const o of others) {
    if (o === p) continue;
    // perpendicular bisector line ax + by + c = 0
    let a = 2 * (p.x - o.x);
    let b = 2 * (p.y - o.y);
    let c = o.x**2 + o.y**2 - p.x**2 - p.y**2;
    
    // Flip if p lies on the "wrong" side
    if (a * p.x + b * p.y + c < 0) {
      a = -a;
      b = -b;
      c = -c;
    }
    // Clip polygon by half-plane ax + by + c >= 0 (the side closer to p)
    poly = clipPolygon(poly, a, b, c);
  }
  return poly;
}

const Voronoi: React.FC<VoronoiProps> = ({
  width,
  height,
  pointsCount = 10,
}) => {
  // Generate random points
  const points = useMemo(() => {
    return Array.from({ length: pointsCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      color: randomColor(),
    }));
  }, [pointsCount, width, height]);

  // Bounding box polygon (rectangle)
  const bbox: Polygon = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];

  // Compute polygons for each cell
  const polygons = points.map(({ x, y }) =>
    computeVoronoiCell({ x, y }, points.map(({ x, y }) => ({ x, y })), bbox)
  );


  // Convert polygon points to SVG path string
  const polygonToPath = (poly: Polygon) =>
    poly.length === 0
      ? ""
      : `M${poly.map(({ x, y }) => `${x},${y}`).join("L")}Z`;

  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {polygons.map((poly, i) => (
        <path
          key={i}
          d={polygonToPath(poly)}
          fill={points[i].color}
          stroke="#000"
          strokeWidth={1}
        />
      ))}
      {/* Draw points */}
      {/* {points.map(({ x, y }, i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={5}
          fill="#000"
          stroke="#fff"
          strokeWidth={1}
        />
      ))} */}
    </svg>
  );
};

export default Voronoi;
