import { Switch, Match, type JSX } from 'solid-js'
import { A, Navigate } from '@solidjs/router'
import { Header } from './Header'
import { modulesState, modulesActions } from '../stores/modulesStore'
import type { ModuleKey } from '../../shared/rules/modules'

// A page that belongs to a module (specs/rules/modules.md): shown while the
// module is on, otherwise a short note and the way home. Until the switches
// are known it shows nothing rather than guess.
export const ModuleGate = (props: {
  module: ModuleKey
  children: JSX.Element
}) => (
  <Switch>
    <Match when={modulesActions.on(props.module)}>{props.children}</Match>
    <Match when={modulesState.known}>
      <ModuleOff />
    </Match>
  </Switch>
)

// "/" — the event list, or wherever this club's home is without it.
export const Home = (props: { children: JSX.Element }) => (
  <Switch>
    <Match when={modulesActions.on('events')}>{props.children}</Match>
    <Match when={modulesState.known}>
      <Navigate href={modulesActions.homePath()} />
    </Match>
  </Switch>
)

const ModuleOff = () => (
  <div style={containerStyle}>
    <Header />
    <div style={contentStyle}>
      <h1 style={titleStyle}>Not available</h1>
      <p style={textStyle}>This part of the site is turned off at this club.</p>
      <A href={modulesActions.homePath()} style={linkStyle}>
        Go to the home page
      </A>
    </div>
  </div>
)

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px',
  width: '100%',
  'max-width': '760px',
  margin: '0 auto',
  'box-sizing': 'border-box',
  'text-align': 'left',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '2rem',
  'font-weight': 700,
  margin: '0 0 8px',
  color: '#333',
}

const textStyle: JSX.CSSProperties = { 'font-size': '15px', color: '#666' }

const linkStyle: JSX.CSSProperties = { color: '#2185d0', 'font-size': '15px' }
