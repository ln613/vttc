import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import Home from './pages/Home'
import TournamentEdit from './pages/TournamentEdit'
import EventEdit from './pages/EventEdit'
import EventParticipantEdit from './pages/EventParticipantEdit'
import EventManage from './pages/EventManage'
import GamePlay from './pages/GamePlay'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tournament/new" element={<TournamentEdit />} />
        <Route path="/tournament/:id/edit" element={<TournamentEdit isEdit />} />
        <Route path="/event/new" element={<EventEdit />} />
        <Route path="/event/:id/edit" element={<EventEdit isEdit />} />
        <Route path="/event/participants" element={<EventParticipantEdit />} />
        <Route path="/event/manage" element={<EventManage />} />
        <Route path="/game-play" element={<GamePlay />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
