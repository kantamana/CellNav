export type Point = { x: number; y: number };

export const polygon: Point[] = Array.from({ length: 10 }, (_, i) => {
  const angle = (i * 2 * Math.PI) / 10;
  return {
    x: 300 + 100 * Math.cos(angle),
    y: 150 + 100 * Math.sin(angle),
  };
});