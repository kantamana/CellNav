import Voronoi from './components/Voronoi';
import Demo from "./components/Demo";
import './App.css'

function App() {

  return (
    <>
      <Voronoi width={700} height={500}></Voronoi>
      <Demo></Demo>
    </>
  )
}

export default App
