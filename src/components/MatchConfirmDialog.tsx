import { For, type JSX } from 'solid-js'
import Button from './Button'

export interface GameResult {
  score1: number
  score2: number
  winningSide?: 1 | 2
}

export interface MatchPreview {
  gamesWon1: number
  gamesWon2: number
  games: GameResult[]
}

interface MatchConfirmDialogProps {
  preview: MatchPreview
  participant1Name: string
  participant2Name: string
  onCancel: () => void
  onConfirm: () => void
}

const MatchConfirmDialog = (props: MatchConfirmDialogProps) => (
  <div style={dialogOverlayStyle}>
    <div style={finishDialogContentStyle}>
      <div style={finishDialogMessageStyle}>
        Show the match result to both sides and confirm the result with them
      </div>
      <MatchResultPreview
        preview={props.preview}
        participant1Name={props.participant1Name}
        participant2Name={props.participant2Name}
      />
      <div style={finishDialogButtonsStyle}>
        <Button onClick={props.onCancel} color="#e74c3c">Cancel</Button>
        <Button onClick={props.onConfirm} color="#27ae60">Confirm</Button>
      </div>
    </div>
  </div>
)

interface MatchResultPreviewProps {
  preview: MatchPreview
  participant1Name: string
  participant2Name: string
}

const MatchResultPreview = (props: MatchResultPreviewProps) => {
  const side1IsWinner = () => props.preview.gamesWon1 > props.preview.gamesWon2
  const side2IsWinner = () => props.preview.gamesWon2 > props.preview.gamesWon1

  return (
    <div style={matchResultContainerStyle}>
      <div style={matchResultHeaderStyle}>
        <div style={matchResultNameStyle}>{props.participant1Name}</div>
        <div style={matchResultScoreStyle}>
          <span style={getMatchScoreNumberStyle(side1IsWinner())}>
            {props.preview.gamesWon1}
          </span>
          <span> - </span>
          <span style={getMatchScoreNumberStyle(side2IsWinner())}>
            {props.preview.gamesWon2}
          </span>
        </div>
        <div style={matchResultNameStyle}>{props.participant2Name}</div>
      </div>
    <div style={gameResultsListStyle}>
      <For each={props.preview.games}>
        {(game, index) => (
          <div style={gameResultRowStyle}>
            <div style={gameResultLabelStyle}>Game {index() + 1}</div>
            <div style={getGameScoreStyle(game.winningSide === 1)}>
              {game.score1}
            </div>
            <div style={gameResultSeparatorStyle}>-</div>
            <div style={getGameScoreStyle(game.winningSide === 2)}>
              {game.score2}
            </div>
          </div>
        )}
      </For>
      </div>
    </div>
  )
}

// Styles
const dialogOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
}

const finishDialogContentStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '24px',
  'min-width': '320px',
  'max-width': '90vw',
}

const finishDialogMessageStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#333',
  'text-align': 'center',
  'margin-bottom': '20px',
  'line-height': 1.5,
}

const finishDialogButtonsStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  gap: '16px',
  'margin-top': '24px',
}

const matchResultContainerStyle: JSX.CSSProperties = {
  'background-color': '#f5f5f5',
  'border-radius': '8px',
  padding: '16px',
}

const matchResultHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  'margin-bottom': '12px',
  'padding-bottom': '12px',
  'border-bottom': '2px solid #ddd',
}

const matchResultNameStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 600,
  color: '#333',
  flex: 1,
  'text-align': 'center',
  'word-break': 'break-word',
}

const matchResultScoreStyle: JSX.CSSProperties = {
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  'min-width': '80px',
  'text-align': 'center',
}

const gameResultsListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const gameResultRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '8px',
}

const gameResultLabelStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#888',
  'min-width': '60px',
  'text-align': 'right',
}

const getGameScoreStyle = (isWinner: boolean): JSX.CSSProperties => ({
  'font-size': '16px',
  'font-weight': isWinner ? 700 : 400,
  color: isWinner ? '#27ae60' : '#666',
  'min-width': '24px',
  'text-align': 'center',
})

const gameResultSeparatorStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#999',
}

const getMatchScoreNumberStyle = (isWinner: boolean): JSX.CSSProperties => ({
  color: isWinner ? '#e74c3c' : '#333',
})

export default MatchConfirmDialog
