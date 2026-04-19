import { P5Canvas } from "@p5-wrapper/react";
import type { P5CanvasInstance } from "@p5-wrapper/react";

import fontUrl from "../assets/fonts/Courier New Bold.ttf?url";

const sketch = (p: P5CanvasInstance) => {
  let font: any;
  let paths: any[] = [];

  p.setup = async () => {
    p.createCanvas(600, 300);

    font = await p.loadFont(fontUrl);

    paths = font.textToPaths("HELLO", 10, 10, 200);
  };

  p.draw = () => {
    p.background(20);
    p.fill(255);
    const scale = 10;

    //const t = p.millis() * 0.002;

    for (const path of paths) {
      p.beginShape();
      for (const cmd of path.commands) {
        if (cmd.type === "M" || cmd.type === "L") {
          p.vertex(cmd.x * scale, cmd.y * scale);
        }
      }
      p.endShape(p.CLOSE);
      // 🌊 wave warp
      //const wave = p.sin(path.x * 0.05 + t) * 10;
      // const noiseY = p.noise(path.x * 0.1, t) * 30;
      // const noiseX = p.noise(path.y * 0.1, t) * 30;
      // const followX = (p.mouseX - path.x) * 0.5;
      // const followY = (p.mouseY - path.y) * 0.5;

      // p.circle(path.x * scale, path.y * scale , 3);
      //unstable
      //p.circle(path.x * scale + noiseX, path.y * scale + noiseY , 3);
      //water
      //p.circle(path.x * scale + noiseY, path.y * scale + noiseX , 3);
      //follow
      // p.circle(
      //   path.x * scale + followX + noiseX,
      //   path.y * scale + followY + noiseY,
      //   3,
      // );
    }
  };
};

export default function P5SketchWrapper() {
  return <P5Canvas sketch={sketch} />;
}
