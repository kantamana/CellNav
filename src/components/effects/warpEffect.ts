import type { P5CanvasInstance } from "@p5-wrapper/react";
import type { Point } from "../polygon";

/**
 * Computes barycentric coordinates of point p in triangle a,b,c
 * Returns {u,v,w} where p = u*a + v*b + w*c and u+v+w=1
 * Used for interpolating positions within triangles during warping
 */
function getBarycentric(p: Point, a: Point, b: Point, c: Point) {
  const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  if (Math.abs(area) < 1e-6) return { u: 0, v: 0, w: 0 }; // degenerate triangle
  const area1 = (b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y);
  const area2 = (c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y);
  const area3 = (a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y);
  return { u: area1 / area, v: area2 / area, w: area3 / area };
}

/**
 * Creates a warp effect that maps points from their original bounding box to fit inside a convex polygon
 * Uses radial triangulation and barycentric coordinates for smooth deformation
 * 
 * The algorithm:
 * 1. Normalizes original points to [0,1]x[0,1] based on bounding box
 * 2. Triangulates both source (unit square) and target (polygon) radially from center
 * 3. For each point, finds which triangle it falls into and computes barycentric coords
 * 4. Interpolates position in corresponding target triangle
 * 5. Projects any points outside the polygon back to the boundary
 */
export const warpEffect = (
  polygon: Point[],
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
) => {
  const n = polygon.length;
  
  // Calculate polygon center (centroid)
  const cx = polygon.reduce((sum, p) => sum + p.x, 0) / n;
  const cy = polygon.reduce((sum, p) => sum + p.y, 0) / n;
  
  // For circular polygons, calculate radius from center to any vertex
  const radius = Math.sqrt((polygon[0].x - cx) ** 2 + (polygon[0].y - cy) ** 2);
  
  // Get angles of polygon vertices relative to center
  const thetas = polygon.map((p) => Math.atan2(p.y - cy, p.x - cx));
  
  // Sort indices by angle for proper angular ordering
  const indices = thetas.map((_, i) => i).sort((a, b) => thetas[a] - thetas[b]);

  // Source space: unit square [0,1]x[0,1] with center at (0.5,0.5)
  const center_s = { x: 0.5, y: 0.5 };
  
  // Create source boundary points by finding intersections of radial lines with unit square
  // These correspond to the polygon vertex angles
  const boundary_s = thetas.map((theta) => {
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    let t = Infinity;
    // Find intersection distance with each boundary: x=0, x=1, y=0, y=1
    if (cos > 0) t = Math.min(t, 0.5 / cos);      // right boundary x=1
    else if (cos < 0) t = Math.min(t, -0.5 / cos); // left boundary x=0
    if (sin > 0) t = Math.min(t, 0.5 / sin);      // top boundary y=1
    else if (sin < 0) t = Math.min(t, -0.5 / sin); // bottom boundary y=0
    return { x: 0.5 + t * cos, y: 0.5 + t * sin };
  });

  return (_p: P5CanvasInstance, pt: Point, _t: number) => {
    // Normalize point to [0,1]x[0,1] based on original bounding box
    const u = (pt.x - minX) / (maxX - minX || 1);
    const v = (pt.y - minY) / (maxY - minY || 1);
    
    // Calculate angle of normalized point relative to source center
    const theta = Math.atan2(v - 0.5, u - 0.5);

    // Find which angular sector this point falls into
    // This determines which triangle (center + two adjacent boundary points) contains the point
    let i = 0;
    for (let j = 0; j < n; j++) {
      const next = (j + 1) % n;
      if (theta >= thetas[indices[j]] && theta < thetas[indices[next]]) {
        i = j;
        break;
      }
    }
    // Handle wrap-around for angles outside the sorted range
    if (theta < thetas[indices[0]]) i = n - 1;

    // Get the source triangle vertices
    const b1 = boundary_s[indices[i]];
    const b2 = boundary_s[indices[(i + 1) % n]];
    
    // Compute barycentric coordinates of (u,v) in the source triangle
    const bary = getBarycentric({ x: u, y: v }, center_s, b1, b2);

    // Get corresponding target triangle vertices
    const center_t = { x: cx, y: cy };
    const p1 = polygon[indices[i]];
    const p2 = polygon[indices[(i + 1) % n]];

    // Interpolate position in target triangle using barycentric coordinates
    let x = bary.u * center_t.x + bary.v * p1.x + bary.w * p2.x;
    let y = bary.u * center_t.y + bary.v * p1.y + bary.w * p2.y;

    // Ensure the point stays within the polygon boundary
    // If warped point is outside the circle, project it back to the boundary
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist > radius) {
      x = cx + (x - cx) * radius / dist;
      y = cy + (y - cy) * radius / dist;
    }

    return { x, y };
  };
};