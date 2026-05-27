import { Show, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { Header } from '../components/Header'
import { playerState, playerActions } from '../stores/playerStore'
import { authState } from '../stores/authStore'
import type { Player } from '../../shared/types/Player'

const Players = () => {
  onMount(() => {
    playerActions.fetchPlayers()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <TitleRow />
        <PlayersContent />
      </div>
    </div>
  )
}

const TitleRow = () => (
  <div style={titleRowStyle}>
    <h1 style={titleStyle}>Players</h1>
    <input
      type="text"
      placeholder="Search players..."
      value={playerState.search}
      onInput={(e) => playerActions.setSearch(e.currentTarget.value)}
      style={searchBoxStyle}
    />
  </div>
)

const PlayersContent = () => (
  <Show when={!playerState.loading} fallback={<div>Loading...</div>}>
    <Show
      when={!playerState.error}
      fallback={<div>{playerState.error}</div>}
    >
      <PlayerTable />
    </Show>
  </Show>
)

const PlayerTable = () => {
  const isAdminOrAbove = () => authState.isAdmin || authState.isSuperAdmin

  return (
    <div style={tableContainerStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>First Name</th>
            <th style={thStyle}>Last Name</th>
            <th style={thStyle}>Gender</th>
            <th style={thStyle}>Rating</th>
            <Show when={isAdminOrAbove()}>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>Phone</th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={playerActions.filteredPlayers()}>
            {(player) => <PlayerRow player={player} showAdmin={isAdminOrAbove()} />}
          </For>
        </tbody>
      </table>
    </div>
  )
}

interface PlayerRowProps {
  player: Player
  showAdmin: boolean
}

const formatGender = (sex?: string): string => {
  if (!sex) return ''
  return sex === 'male' ? 'M' : 'F'
}

const PlayerRow = (props: PlayerRowProps) => (
  <tr style={trStyle}>
    <td style={tdStyle}>{props.player.firstName}</td>
    <td style={tdStyle}>{props.player.lastName}</td>
    <td style={tdStyle}>{formatGender(props.player.sex)}</td>
    <td style={tdStyle}>{props.player.rating}</td>
    <Show when={props.showAdmin}>
      <td style={tdStyle}>{props.player.email || ''}</td>
      <td style={tdStyle}>{props.player.phone || ''}</td>
    </Show>
  </tr>
)

// Styles
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  margin: '0 auto',
  padding: '16px 20px 20px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '20px',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  margin: '0',
}

const searchBoxStyle: JSX.CSSProperties = {
  padding: '8px 12px',
  'font-size': '14px',
  border: '1px solid #ddd',
  'border-radius': '6px',
  outline: 'none',
  width: '220px',
}

const tableContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '10px',
  'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.06)',
  border: '1px solid #e8e8e8',
  overflow: 'hidden',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
}

const thStyle: JSX.CSSProperties = {
  'text-align': 'left',
  padding: '12px 16px',
  'font-size': '13px',
  'font-weight': 600,
  color: '#fff',
  'background-color': '#2185d0',
}

const tdStyle: JSX.CSSProperties = {
  'text-align': 'left',
  padding: '10px 16px',
  'font-size': '14px',
  color: '#333',
  'border-bottom': '1px solid #f0f0f0',
}

const trStyle: JSX.CSSProperties = {
  transition: 'background-color 0.15s ease',
}

export default Players
