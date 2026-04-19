import { P5Canvas } from "@p5-wrapper/react";
import type { P5CanvasInstance} from "@p5-wrapper/react";

const sketch = (p: P5CanvasInstance) => {
  let x = 100;
  let y = 100;

  p.setup = () => {
    p.createCanvas(200, 200);
    p.background(51);
  };

  p.draw = () => {
    p.fill(255, 0, 200, 25);
    p.noStroke();
    p.ellipse(x, y, 48, 48);

    x += p.random(-10, 10);
    y += p.random(-10, 10);
  };
};

const P5SketchWrapper: React.FC = () => {
  return <P5Canvas sketch={sketch} />;
};

export default P5SketchWrapper;