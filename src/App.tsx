import { HashRouter, Route } from '@solidjs/router'
import { Show, type JSX } from 'solid-js'
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
import Settings from './pages/Settings'
import Revenue from './pages/Revenue'
import RevenueCalculator from './pages/RevenueCalculator'
import History from './pages/History'
import ConfirmDialog from './components/ConfirmDialog'
import UserNotifications from './components/UserNotifications'
import NotificationToasts from './components/NotificationToasts'

// Notifications are disabled for now — set VITE_NOTIFICATIONS_ENABLED=1
// (and NOTIFICATIONS_ENABLED=true on the server) to turn them back on.
const notificationsEnabled =
  import.meta.env.VITE_NOTIFICATIONS_ENABLED === '1'

const RootLayout = (props: { children?: JSX.Element }) => (
  <>
    {props.children}
    <ConfirmDialog />
    <Show when={notificationsEnabled}>
      <UserNotifications />
      <NotificationToasts />
    </Show>
  </>
)

const App = () => (
  <HashRouter root={RootLayout}>
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
    <Route path="/settings" component={Settings} />
    <Route path="/revenue" component={Revenue} />
    <Route path="/revenue-calculator" component={RevenueCalculator} />
    <Route path="/history/:playerId" component={History} />
  </HashRouter>
)

export default App
