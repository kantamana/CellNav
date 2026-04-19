// import Voronoi from './components/Voronoi';
// import Demo from "./components/Demo";
// import './App.css'
// import TextWarp from './components/TextWarp';
// import type { Point } from "./components/mvc";
// import  PolygonText  from "p5";
// import P5Sketch from './components/P5Sketch';
import TextPath from "./components/TextPath";
import TextContours from "./components/TextContours";
import Voronoi from "./components/Voronoi";

function App() {
  //   const square: Point[] = [
  //   { x: 50, y: 50 },
  //   { x: 250, y: 50 },
  //   { x: 250, y: 250 },
  //   { x: 50, y: 250 },
  // ];

  return (
    <>
      {/* <Voronoi width={700} height={500}></Voronoi> */}
      {/* <TextWarp text="A" polygon={square} fontSize={150} />  */}
      {/* <PolygonText text="HELLO" polygon={polygon} width={400} height={400} />; */}
      {/* <Demo></Demo> */}
      <TextContours />
      <Voronoi width={800} height={400} />
    </>
  );
}

export default App;
