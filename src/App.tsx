import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import TournamentEdit from './pages/TournamentEdit'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournament/new" element={<TournamentEdit />} />
        <Route path="/tournament/:id/edit" element={<TournamentEdit isEdit />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
