import './App.css'
import Button from './components/Button'
import { Header } from './components/Header'
import { PlayerList } from './components/PlayerList'

function App() {
  return (
    <div>
      <Header />
      <h1>VTTC</h1>
      <Button color="#3498db">Hello</Button>
      <Button color="#27ae60">Save</Button>
      <Button color="#f39c12">Submit</Button>
      <Button color="#e74c3c">Cancel</Button>
      <PlayerList />
    </div>
  )
}

export default App
