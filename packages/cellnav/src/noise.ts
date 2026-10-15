import { mulberry32 } from "./voronoi";

export type Noise3 = (x: number, y: number, z: number) => number;

const GRADIENTS: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + t * (b - a);

/**
 * Seeded 3D Perlin noise (Ken Perlin's improved version). The same seed always
 * gives the same field. Unlike p5's noise(), which returns 0 to 1, the result
 * is centred on 0, so adding it to a position makes things wobble around their
 * place instead of drifting one way. Output stays within about -1 to 1.
 */
export function createNoise(seed: number): Noise3 {
  const rand = mulberry32(seed);
  const perm = new Uint8Array(512);
  const base = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255]!;

  // Perlin noise is exactly 0 on the integer lattice; a seeded offset keeps a
  // caller's round numbers (0, 1, 2...) off it.
  const ox = rand() * 256;
  const oy = rand() * 256;
  const oz = rand() * 256;

  const grad = (hash: number, x: number, y: number, z: number) => {
    const g = GRADIENTS[hash % 12]!;
    return g[0] * x + g[1] * y + g[2] * z;
  };

  return (px, py, pz) => {
    const x = px + ox;
    const y = py + oy;
    const z = pz + oz;
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);

    const A = perm[X]! + Y;
    const AA = perm[A]! + Z;
    const AB = perm[A + 1]! + Z;
    const B = perm[X + 1]! + Y;
    const BA = perm[B]! + Z;
    const BB = perm[B + 1]! + Z;

    return lerp(
      lerp(
        lerp(grad(perm[AA]!, fx, fy, fz), grad(perm[BA]!, fx - 1, fy, fz), u),
        lerp(grad(perm[AB]!, fx, fy - 1, fz), grad(perm[BB]!, fx - 1, fy - 1, fz), u),
        v,
      ),
      lerp(
        lerp(grad(perm[AA + 1]!, fx, fy, fz - 1), grad(perm[BA + 1]!, fx - 1, fy, fz - 1), u),
        lerp(grad(perm[AB + 1]!, fx, fy - 1, fz - 1), grad(perm[BB + 1]!, fx - 1, fy - 1, fz - 1), u),
        v,
      ),
      w,
    );
  };
}
