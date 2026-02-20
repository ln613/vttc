import { Router, Route } from '@solidjs/router'
import './App.css'
import Home from './pages/Home'
import TournamentEdit from './pages/TournamentEdit'
import EventEdit from './pages/EventEdit'
import EventParticipantEdit from './pages/EventParticipantEdit'
import EventManage from './pages/EventManage'
import GamePlay from './pages/GamePlay'

const App = () => (
  <Router>
    <Route path="/" component={Home} />
    <Route path="/tournament/new" component={TournamentEdit} />
    <Route path="/tournament/:id/edit" component={() => <TournamentEdit isEdit />} />
    <Route path="/event/new" component={EventEdit} />
    <Route path="/event/:id/edit" component={() => <EventEdit isEdit />} />
    <Route path="/event/participants" component={EventParticipantEdit} />
    <Route path="/event/manage" component={EventManage} />
    <Route path="/game-play" component={GamePlay} />
  </Router>
)

export default App
