import { Show, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { Header } from '../components/Header'
import { playerState, playerActions } from '../stores/playerStore'
import { authState } from '../stores/authStore'

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
  const isAdmin = () => authState.isAdmin || authState.isSuperAdmin

  return (
    <Show when={isAdmin()} fallback={<PublicPlayerTable />}>
      <AdminPlayerTable />
    </Show>
  )
}

const PublicPlayerTable = () => (
  <div style={publicTableContainerStyle}>
    <table style={publicTableFixedStyle}>
      <colgroup>
        <col style={{ width: '35%' }} />
        <col style={{ width: '35%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr>
          <th style={publicThStyle}>First Name</th>
          <th style={publicThStyle}>Last Name</th>
          <th style={publicThStyle}>Sex</th>
          <th style={publicThStyle}>Rating</th>
        </tr>
      </thead>
      <tbody>
        <For each={playerActions.filteredPlayers()}>
          {(player) => (
            <tr style={trStyle}>
              <td style={publicTdStyle}>{player.firstName}</td>
              <td style={publicTdStyle}>{player.lastName}</td>
              <td style={publicTdStyle}>{formatSex(player.sex)}</td>
              <td style={publicTdStyle}>{player.rating}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)

const AdminPlayerTable = () => (
  <div style={adminTableContainerStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={adminThStyle}>First Name</th>
          <th style={adminThStyle}>Last Name</th>
          <th style={adminThStyle}>Sex</th>
          <th style={adminThStyle}>Rating</th>
          <th style={adminThStyle}>Email</th>
          <th style={adminThStyle}>Phone</th>
        </tr>
      </thead>
      <tbody>
        <For each={playerActions.filteredPlayers()}>
          {(player) => (
            <tr style={trStyle}>
              <td style={adminTdStyle}>{player.firstName}</td>
              <td style={adminTdStyle}>{player.lastName}</td>
              <td style={adminTdStyle}>{formatSex(player.sex)}</td>
              <td style={adminTdStyle}>{player.rating}</td>
              <td style={adminTdStyle}>{player.email || ''}</td>
              <td style={adminTdStyle}>{player.phone || ''}</td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  </div>
)

const formatSex = (sex?: string): string => {
  if (!sex) return ''
  return sex
}

// Styles
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
  'overflow-x': 'hidden',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '16px 12px 12px',
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
  'min-width': '0',
  flex: '1',
  'max-width': '220px',
}

const baseTableContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '10px',
  'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.06)',
  border: '1px solid #e8e8e8',
}

const publicTableContainerStyle: JSX.CSSProperties = {
  ...baseTableContainerStyle,
  'overflow-x': 'auto',
}

const adminTableContainerStyle: JSX.CSSProperties = {
  ...baseTableContainerStyle,
  'overflow-x': 'auto',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
}

const publicTableFixedStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'table-layout': 'fixed',
}

const baseThStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '13px',
  'font-weight': 600,
  color: '#fff',
  'background-color': '#2185d0',
}

const publicThStyle: JSX.CSSProperties = {
  ...baseThStyle,
  padding: '4px 0px 4px 8px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const adminThStyle: JSX.CSSProperties = {
  ...baseThStyle,
  padding: '12px 16px',
  'white-space': 'nowrap',
}

const baseTdStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '14px',
  color: '#333',
  'border-bottom': '1px solid #f0f0f0',
}

const publicTdStyle: JSX.CSSProperties = {
  ...baseTdStyle,
  padding: '4px 0px 4px 8px',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const adminTdStyle: JSX.CSSProperties = {
  ...baseTdStyle,
  padding: '10px 16px',
  'white-space': 'nowrap',
}

const trStyle: JSX.CSSProperties = {
  transition: 'background-color 0.15s ease',
}

export default Players
