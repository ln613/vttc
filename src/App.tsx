import { Router, Route } from '@solidjs/router'
import type { JSX } from 'solid-js'
import './App.css'
import TournamentEdit from './pages/TournamentEdit'
import EventEdit from './pages/EventEdit'
import EventParticipantEdit from './pages/EventParticipantEdit'
import EventList from './pages/EventList'
import EventDetail from './pages/EventDetail'
import Schedule from './pages/Schedule'
import Players from './pages/Players'
import GamePlay from './pages/GamePlay'
import LiveScore from './pages/LiveScore'
import Account from './pages/Account'
import ConfirmDialog from './components/ConfirmDialog'

const RootLayout = (props: { children?: JSX.Element }) => (
  <>
    {props.children}
    <ConfirmDialog />
  </>
)

const App = () => (
  <Router root={RootLayout}>
    <Route path="/" component={EventList} />
    <Route path="/events" component={EventList} />
    <Route path="/players" component={Players} />
    <Route path="/schedule" component={Schedule} />
    <Route path="/account" component={Account} />
    <Route path="/account/:playerId" component={Account} />
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
