export const jiggleEffect = (p, pt, t) => {

      const noiseY = p.noise(pt.x * 0.1, t) * 3
      const noiseX = p.noise(pt.y * 0.1, t) * 3

  return {
    x: pt.x + noiseX,
    y: pt.y + noiseY,
  };
};