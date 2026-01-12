import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/Header'
import {
  useGamePlaySelector,
  gamePlayActions,
} from '../stores/gamePlayStore'
import type { Player } from '../../shared/types/Player'

const GamePlay = () => {
  useInitializeFromUrl()
  const isDesktop = useIsDesktop()

  return (
    <div style={containerStyle}>
      {isDesktop && <Header />}
      <div style={contentStyle}>
        <EventInfo />
        <GameInfo />
        <ScoreBoxes />
      </div>
    </div>
  )
}

const useInitializeFromUrl = () => {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    gamePlayActions.initializeFromUrl(searchParams)
    return () => {
      gamePlayActions.reset()
    }
  }, [searchParams])
}

const useIsDesktop = (): boolean => {
  return window.innerWidth >= 768
}

const EventInfo = () => {
  const event = useGamePlaySelector((s) => s.data)
  const stageName = gamePlayActions.getStageName()

  if (!event) return null

  return (
    <div style={eventInfoStyle}>
      <div style={eventNameStyle}>{event.eventName}</div>
      <div style={stageNameStyle}>{stageName}</div>
    </div>
  )
}

const GameInfo = () => {
  const currentGameIndex = useGamePlaySelector((s) => s.currentGameIndex)
  const numberOfGames = gamePlayActions.getNumberOfGames()

  return (
    <div style={gameInfoStyle}>
      Game {currentGameIndex + 1} / {numberOfGames}
    </div>
  )
}

const ScoreBoxes = () => {
  return (
    <div style={scoreBoxesContainerStyle}>
      <ScoreBox side={1} />
      <ScoreBox side={2} />
    </div>
  )
}

interface ScoreBoxProps {
  side: 1 | 2
}

const ScoreBox = ({ side }: ScoreBoxProps) => {
  const servingSide = useGamePlaySelector((s) => s.servingSide)
  const score = useScore(side)
  const players = usePlayersForSide(side)
  const isServing = servingSide === side

  const handleBoxClick = () => {
    gamePlayActions.addPointToSide(side)
  }

  const handleMinusClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    gamePlayActions.deductPointFromSide(side)
  }

  return (
    <div
      style={getScoreBoxStyle(isServing)}
      onClick={handleBoxClick}
    >
      <ParticipantNames players={players} />
      <div style={scoreDisplayStyle}>{score}</div>
      <div style={buttonContainerStyle}>
        <button style={plusButtonStyle}>+</button>
        <button style={minusButtonStyle} onClick={handleMinusClick}>
          −
        </button>
      </div>
    </div>
  )
}

const useScore = (side: 1 | 2): number => {
  const score1 = useGamePlaySelector((s) => s.score1)
  const score2 = useGamePlaySelector((s) => s.score2)
  return side === 1 ? score1 : score2
}

const usePlayersForSide = (side: 1 | 2): Player[] => {
  return side === 1
    ? gamePlayActions.getSide1Players()
    : gamePlayActions.getSide2Players()
}

interface ParticipantNamesProps {
  players: Player[]
}

const ParticipantNames = ({ players }: ParticipantNamesProps) => {
  const displayName = formatPlayerNames(players)
  return <div style={participantNamesStyle}>{displayName}</div>
}

const formatPlayerNames = (players: Player[]): string => {
  if (!players || players.length === 0) return 'Player'
  return players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#1a1a2e',
  display: 'flex',
  flexDirection: 'column',
}

const contentStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: '16px',
}

const eventInfoStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: '16px',
}

const eventNameStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#fff',
  marginBottom: '4px',
}

const stageNameStyle: React.CSSProperties = {
  fontSize: '16px',
  color: '#ccc',
}

const gameInfoStyle: React.CSSProperties = {
  textAlign: 'center',
  fontSize: '18px',
  fontWeight: 600,
  color: '#fff',
  marginBottom: '24px',
}

const scoreBoxesContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flex: 1,
}

const getScoreBoxStyle = (isServing: boolean): React.CSSProperties => ({
  flex: 1,
  backgroundColor: isServing ? '#c0392b' : '#2980b9',
  borderRadius: '12px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '24px 16px',
  cursor: 'pointer',
  transition: 'background-color 0.3s ease',
  minHeight: '400px',
})

const participantNamesStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#fff',
  textAlign: 'center',
  wordBreak: 'break-word',
}

const scoreDisplayStyle: React.CSSProperties = {
  fontSize: '120px',
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1,
}

const buttonContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '16px',
}

const plusButtonStyle: React.CSSProperties = {
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'rgba(255, 255, 255, 0.2)',
  color: '#fff',
  fontSize: '32px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const minusButtonStyle: React.CSSProperties = {
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  border: 'none',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  color: '#fff',
  fontSize: '32px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

export default GamePlay
