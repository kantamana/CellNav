export type Noise3 = (x: number, y: number, z: number) => number;
/**
 * Seeded 3D Perlin noise (Ken Perlin's improved version). The same seed always
 * gives the same field. Unlike p5's noise(), which returns 0 to 1, the result
 * is centred on 0, so adding it to a position makes things wobble around their
 * place instead of drifting one way. Output stays within about -1 to 1.
 */
export declare function createNoise(seed: number): Noise3;
