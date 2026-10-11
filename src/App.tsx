import { HashRouter, Route, Navigate } from '@solidjs/router'
import { Show, onMount, type Component, type JSX } from 'solid-js'
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
import Umpires from './pages/Umpires'
import Revenue from './pages/Revenue'
import RevenueCalculator from './pages/RevenueCalculator'
import History from './pages/History'
import Booking from './pages/Booking'
import Modules from './pages/Modules'
import SiteHome from './pages/site/SiteHome'
import SiteCoaches from './pages/site/SiteCoaches'
import SitePricing from './pages/site/SitePricing'
import SiteAbout from './pages/site/SiteAbout'
import Rewards from './pages/Rewards'
import Redemptions from './pages/Redemptions'
import Gifts from './pages/Gifts'
import { pointsModel } from './i18n/wallet'
import { hasSite } from './site/siteContent'
import ConfirmDialog from './components/ConfirmDialog'
import { ModuleGate, Home } from './components/ModuleGate'
import { modulesActions } from './stores/modulesStore'
import type { ModuleKey } from '../shared/rules/modules'
import UserNotifications from './components/UserNotifications'
import NotificationToasts from './components/NotificationToasts'

// Notifications are disabled for now — set VITE_NOTIFICATIONS_ENABLED=1
// (and NOTIFICATIONS_ENABLED=true on the server) to turn them back on.
const notificationsEnabled =
  import.meta.env.VITE_NOTIFICATIONS_ENABLED === '1'

const RootLayout = (props: { children?: JSX.Element }) => {
  onMount(() => void modulesActions.load())
  return <Layout>{props.children}</Layout>
}

const Layout = (props: { children?: JSX.Element }) => (
  <>
    {props.children}
    <ConfirmDialog />
    <Show when={notificationsEnabled}>
      <UserNotifications />
      <NotificationToasts />
    </Show>
  </>
)

// A page that belongs to a module (specs/rules/modules.md) is only there
// while the module is on.
const gated =
  (module: ModuleKey, Page: Component): Component =>
  () => (
    <ModuleGate module={module}>
      <Page />
    </ModuleGate>
  )

// The website's pages exist only for a club that has one.
const siteOnly =
  (Page: Component): Component =>
  () => (
    <Show when={hasSite()} fallback={<Navigate href="/" />}>
      <Page />
    </Show>
  )

// Rewards and gifts exist only for a club on the points model
// (specs/rules/wallet.md), and with the Credit module.
const pointsOnly =
  (Page: Component): Component =>
  () => (
    <Show when={pointsModel} fallback={<Navigate href="/" />}>
      <Page />
    </Show>
  )

const TournamentEditPage = () => <TournamentEdit isEdit />
const EventEditPage = () => <EventEdit isEdit />

// A club with its own website opens on it; otherwise the event list, or
// whatever its modules make home.
const HomePage = () => (
  <Show
    when={hasSite()}
    fallback={
      <Home>
        <EventList />
      </Home>
    }
  >
    <SiteHome />
  </Show>
)

const App = () => (
  <HashRouter root={RootLayout}>
    <Route path="/" component={HomePage} />
    <Route path="/events" component={gated('events', EventList)} />
    <Route path="/players" component={gated('players', Players)} />
    <Route path="/schedule" component={gated('schedule', Schedule)} />
    <Route path="/account" component={Account} />
    <Route path="/account/:playerId" component={Account} />
    <Route path="/tournament/new" component={gated('events', TournamentEdit)} />
    <Route path="/tournament/:id/edit" component={gated('events', TournamentEditPage)} />
    <Route path="/event/new" component={gated('events', EventEdit)} />
    <Route path="/event/:id/edit" component={gated('events', EventEditPage)} />
    <Route path="/event/participants" component={gated('events', EventParticipantEdit)} />
    <Route path="/event/:id" component={gated('events', EventDetail)} />
    <Route path="/game-play" component={gated('gamePlay', GamePlay)} />
    <Route path="/live-score" component={gated('liveScore', LiveScore)} />
    <Route path="/settings" component={Settings} />
    <Route path="/modules" component={Modules} />
    <Route path="/umpires" component={gated('gamePlay', Umpires)} />
    <Route path="/revenue" component={gated('events', Revenue)} />
    <Route path="/revenue-calculator" component={gated('events', RevenueCalculator)} />
    <Route path="/history/:playerId" component={gated('players', History)} />
    <Route path="/booking" component={gated('calendar', Booking)} />
    <Route path="/coaches" component={siteOnly(SiteCoaches)} />
    <Route path="/pricing" component={siteOnly(SitePricing)} />
    <Route path="/about" component={siteOnly(SiteAbout)} />
    <Route path="/rewards" component={gated('credit', pointsOnly(Rewards))} />
    <Route path="/redemptions" component={gated('credit', pointsOnly(Redemptions))} />
    <Route path="/gifts" component={gated('credit', pointsOnly(Gifts))} />
  </HashRouter>
)

export default App
