import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useGamePlaySelector,
  gamePlayActions,
} from '../stores/gamePlayStore'
import type { Player } from '../../shared/types/Player'

const GamePlay = () => {
  useInitializeFromUrl()

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <Header />
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

const useIsWideScreen = () => {
  const [isWide, setIsWide] = useState(window.innerWidth > 640)

  useEffect(() => {
    const handleResize = () => {
      setIsWide(window.innerWidth > 640)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isWide
}

const Header = () => {
  const isWideScreen = useIsWideScreen()
  return isWideScreen ? <WideHeader /> : <NarrowHeader />
}

const WideHeader = () => {
  const event = useGamePlaySelector((s) => s.data)
  const stageName = gamePlayActions.getStageName()
  const currentGameIndex = useGamePlaySelector((s) => s.currentGameIndex)
  const numberOfGames = gamePlayActions.getNumberOfGames()

  if (!event) return null

  return (
    <div style={wideHeaderStyle}>
      <div style={stageNameStyle}>{stageName}</div>
      <div style={eventNameWideStyle}>{event.eventName}</div>
      <div style={gameInfoStyle}>
        Game {currentGameIndex + 1} / {numberOfGames}
      </div>
    </div>
  )
}

const NarrowHeader = () => {
  const event = useGamePlaySelector((s) => s.data)
  const stageName = gamePlayActions.getStageName()
  const currentGameIndex = useGamePlaySelector((s) => s.currentGameIndex)
  const numberOfGames = gamePlayActions.getNumberOfGames()

  if (!event) return null

  return (
    <div style={narrowHeaderContainerStyle}>
      <div style={eventNameNarrowStyle}>{event.eventName}</div>
      <div style={stageGameRowStyle}>
        <div style={stageNameStyle}>{stageName}</div>
        <div style={gameInfoStyle}>
          Game {currentGameIndex + 1} / {numberOfGames}
        </div>
      </div>
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
  const pointBoxRef = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState(120)

  useEffect(() => {
    const calculateFontSize = () => {
      if (!pointBoxRef.current) return

      const boxWidth = pointBoxRef.current.offsetWidth
      const boxHeight = pointBoxRef.current.offsetHeight
      const padding = 32

      const availableWidth = boxWidth - padding * 2
      const availableHeight = boxHeight - padding * 2

      const minDimension = Math.min(availableWidth, availableHeight)
      const newFontSize = Math.max(minDimension, 40)

      setFontSize(newFontSize)
    }

    calculateFontSize()
    window.addEventListener('resize', calculateFontSize)
    return () => window.removeEventListener('resize', calculateFontSize)
  }, [score])

  const handleAddPoint = () => {
    gamePlayActions.addPointToSide(side)
  }

  const handleDeductPoint = () => {
    gamePlayActions.deductPointFromSide(side)
  }

  return (
    <div style={scoreBoxWrapperStyle}>
      <ParticipantNames players={players} />
      <button style={getPlusButtonStyle(isServing)} onClick={handleAddPoint}>
        +
      </button>
      <div
        ref={pointBoxRef}
        style={getPointBoxStyle(isServing)}
        onClick={handleAddPoint}
      >
        <div style={getScoreDisplayStyle(fontSize)}>{score}</div>
      </div>
      <button style={getMinusButtonStyle(isServing)} onClick={handleDeductPoint}>
        −
      </button>
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

const wideHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '16px',
}

const eventNameWideStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#fff',
  textAlign: 'center',
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  margin: '0 16px',
}

const narrowHeaderContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '16px',
}

const eventNameNarrowStyle: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#fff',
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginBottom: '8px',
}

const stageGameRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}

const stageNameStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#fff',
  textAlign: 'left',
}

const gameInfoStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#fff',
  textAlign: 'right',
}

const scoreBoxesContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flex: 1,
}

const scoreBoxWrapperStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  minWidth: 0,
}

const participantNamesStyle: React.CSSProperties = {
  fontSize: '16px',
  fontWeight: 600,
  color: '#fff',
  textAlign: 'center',
  wordBreak: 'break-word',
  marginBottom: '8px',
  width: '100%',
}

const getPlusButtonStyle = (isServing: boolean): React.CSSProperties => ({
  width: '100%',
  height: '60px',
  borderRadius: '12px 12px 0 0',
  border: 'none',
  backgroundColor: isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  fontSize: '32px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

const getPointBoxStyle = (isServing: boolean): React.CSSProperties => ({
  width: '100%',
  flex: 1,
  backgroundColor: isServing ? '#c0392b' : '#2980b9',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  overflow: 'hidden',
  minHeight: 0,
})

const getScoreDisplayStyle = (fontSize: number): React.CSSProperties => ({
  fontSize: `${fontSize}px`,
  fontWeight: 700,
  color: '#fff',
  lineHeight: 1,
})

const getMinusButtonStyle = (isServing: boolean): React.CSSProperties => ({
  width: '100%',
  height: '60px',
  borderRadius: '0 0 12px 12px',
  border: 'none',
  backgroundColor: isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  fontSize: '32px',
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

export default GamePlay
