import { Show, For, onMount, type JSX } from 'solid-js'
import { useParams } from '@solidjs/router'
import { Header } from '../components/Header'
import {
  historyState,
  historyActions,
  type HistoryRow,
  type HistorySide,
  type HistoryGame,
} from '../stores/historyStore'

// "{name} ({before} + 5 = {after})" for the winner (gain),
// "{name} ({before} - 0 = {after})" for the loser (loss, incl. zero).
const sideText = (s: HistorySide, isWinner: boolean): string => {
  const sign = isWinner ? '+' : '-'
  return `${s.name} (${s.before} ${sign} ${Math.abs(s.change)} = ${s.after})`
}

// The losing points of each game; bold the games the match winner won.
const gameLoserPoints = (g: HistoryGame): number =>
  g.winningSide === 1 ? g.score2 : g.score1

const History = () => {
  const params = useParams()
  onMount(() => {
    if (params.playerId) void historyActions.fetch(params.playerId)
  })

  const title = () => {
    const p = historyState.player
    if (!p) return 'History'
    const rating = p.rating != null ? ` (${p.rating})` : ''
    return `History - ${p.name}${rating}`
  }

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>{title()}</h1>
        <Show when={historyState.error}>
          <div style={errorStyle}>{historyState.error}</div>
        </Show>
        <Show
          when={!historyState.loading}
          fallback={<div style={mutedStyle}>Loading...</div>}
        >
          <Show
            when={historyState.rows.length > 0}
            fallback={<div style={mutedStyle}>No rated matches yet.</div>}
          >
            <HistoryTable />
          </Show>
        </Show>
      </div>
    </div>
  )
}

const HistoryTable = () => (
  <div style={tableWrapStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Date</th>
          <th style={thStyle}>Event</th>
          <th style={thStyle}>Winner</th>
          <th style={thStyle}>Result</th>
          <th style={thStyle}>Loser</th>
        </tr>
      </thead>
      <tbody>
        <For each={historyState.rows}>{(row) => <Row row={row} />}</For>
      </tbody>
    </table>
  </div>
)

const Row = (props: { row: HistoryRow }) => (
  <tr>
    <td style={tdNoWrapStyle}>{(props.row.date || '').slice(0, 10)}</td>
    <td style={tdStyle}>{props.row.event}</td>
    <td style={{ ...tdStyle, 'font-weight': 700 }}>{sideText(props.row.winner, true)}</td>
    <td style={tdNoWrapStyle}>
      <For each={props.row.games}>
        {(g, i) => (
          <>
            <Show when={i() > 0}>{', '}</Show>
            <span
              style={
                g.winningSide === props.row.winningSide
                  ? { 'font-weight': 700 }
                  : {}
              }
            >
              {gameLoserPoints(g)}
            </span>
          </>
        )}
      </For>
    </td>
    <td style={tdStyle}>{sideText(props.row.loser, false)}</td>
  </tr>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}
const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  width: '100%',
  margin: '0 auto',
  padding: '16px 12px 12px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '16px',
}
const titleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '26px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'left',
}
const tableWrapStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  overflow: 'auto',
}
const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'font-size': '12px',
}
const thStyle: JSX.CSSProperties = {
  'text-align': 'left',
  padding: '5px 8px',
  background: '#f0f3f7',
  color: '#2c3e50',
  'font-weight': 700,
  'border-bottom': '1px solid #e1e4e8',
  'white-space': 'nowrap',
}
const tdStyle: JSX.CSSProperties = {
  padding: '5px 8px',
  color: '#333',
  'border-bottom': '1px solid #eef1f4',
  'text-align': 'left',
  'vertical-align': 'middle',
}
const tdNoWrapStyle: JSX.CSSProperties = {
  ...tdStyle,
  'white-space': 'nowrap',
}
const errorStyle: JSX.CSSProperties = {
  padding: '10px 14px',
  background: '#fdecea',
  color: '#c0392b',
  'border-radius': '8px',
  'font-size': '13px',
}
const mutedStyle: JSX.CSSProperties = {
  color: '#7f8c8d',
  'font-size': '14px',
}

export default History
