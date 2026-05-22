import { Router, Route } from '@solidjs/router'
import './App.css'
import TournamentEdit from './pages/TournamentEdit'
import EventEdit from './pages/EventEdit'
import EventParticipantEdit from './pages/EventParticipantEdit'
import EventList from './pages/EventList'
import EventDetail from './pages/EventDetail'
import GamePlay from './pages/GamePlay'
import LiveScore from './pages/LiveScore'

const App = () => (
  <Router>
    <Route path="/" component={EventList} />
    <Route path="/events" component={EventList} />
    <Route path="/tournament/new" component={TournamentEdit} />
    <Route path="/tournament/:id/edit" component={() => <TournamentEdit isEdit />} />
    <Route path="/event/new" component={EventEdit} />
    <Route path="/event/:id/edit" component={() => <EventEdit isEdit />} />
    <Route path="/event/participants" component={EventParticipantEdit} />
    <Route path="/event/:id" component={EventDetail} />
    <Route path="/game-play" component={GamePlay} />
    <Route path="/live-score" component={LiveScore} />
  </Router>
)

export default App
