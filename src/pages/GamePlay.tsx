import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  useGamePlaySelector,
  gamePlayActions,
} from '../stores/gamePlayStore'
import type { Player } from '../../shared/types/Player'
import SingleSelectTags from '../components/SingleSelectTags'
import Button from '../components/Button'

const GamePlay = () => {
  useInitializeFromUrl()

  const showInitDialog = useGamePlaySelector((s) => s.showInitDialog)
  const loading = useGamePlaySelector((s) => s.loading)

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <Header />
        <ScoreBoxes />
      </div>
      {showInitDialog && !loading && <InitDialog />}
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
  const leftSide = useGamePlaySelector((s) => s.leftSide)
  const rightSide = leftSide === 1 ? 2 : 1

  return (
    <div style={scoreBoxesContainerStyle}>
      <ScoreBox side={leftSide} isLeft={true} />
      <ScoreBox side={rightSide} isLeft={false} />
    </div>
  )
}

interface ScoreBoxProps {
  side: 1 | 2
  isLeft: boolean
}

const ScoreBox = ({ side, isLeft }: ScoreBoxProps) => {
  const servingSide = useGamePlaySelector((s) => s.servingSide)
  const score = useScore(side)
  const gamesWon = useGamesWon(side)
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
      <div style={scoreAreaContainerStyle}>
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
        <GamesWonBadge gamesWon={gamesWon} isLeft={isLeft} />
      </div>
      <button style={getMinusButtonStyle(isServing)} onClick={handleDeductPoint}>
        −
      </button>
    </div>
  )
}

interface GamesWonBadgeProps {
  gamesWon: number
  isLeft: boolean
}

const GamesWonBadge = ({ gamesWon, isLeft }: GamesWonBadgeProps) => {
  return (
    <div style={getGamesWonBadgeStyle(isLeft)}>
      {gamesWon}
    </div>
  )
}

const useScore = (side: 1 | 2): number => {
  const score1 = useGamePlaySelector((s) => s.score1)
  const score2 = useGamePlaySelector((s) => s.score2)
  return side === 1 ? score1 : score2
}

const useGamesWon = (side: 1 | 2): number => {
  const match = gamePlayActions.getCurrentMatch()
  if (!match) return 0
  return side === 1 ? match.gamesWon1 : match.gamesWon2
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

// Init Dialog Component
const InitDialog = () => {
  const initialServingSide = useGamePlaySelector((s) => s.initialServingSide)
  const leftSide = useGamePlaySelector((s) => s.leftSide)
  const participant1Name = gamePlayActions.getParticipantName(1)
  const participant2Name = gamePlayActions.getParticipantName(2)

  const options = [participant1Name, participant2Name]

  const handleServingChange = (selected: string) => {
    const side = selected === participant1Name ? 1 : 2
    gamePlayActions.setInitialServingSide(side as 1 | 2)
  }

  const handleLeftSideChange = (selected: string) => {
    const side = selected === participant1Name ? 1 : 2
    gamePlayActions.setLeftSide(side as 1 | 2)
  }

  const handleOk = () => {
    gamePlayActions.confirmInitDialog()
  }

  const selectedServing = initialServingSide === 1 ? participant1Name : participant2Name
  const selectedLeft = leftSide === 1 ? participant1Name : participant2Name

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogContentStyle}>
        <div style={dialogFieldStyle}>
          <SingleSelectTags
            label="Who serves first"
            options={options}
            selectedValue={selectedServing}
            onChange={handleServingChange}
            vertical
          />
        </div>
        <div style={dialogFieldStyle}>
          <SingleSelectTags
            label="Who is on left"
            options={options}
            selectedValue={selectedLeft}
            onChange={handleLeftSideChange}
            vertical
          />
        </div>
        <div style={dialogButtonContainerStyle}>
          <Button onClick={handleOk}>OK</Button>
        </div>
      </div>
    </div>
  )
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

const scoreAreaContainerStyle: React.CSSProperties = {
  position: 'relative',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
}

const getGamesWonBadgeStyle = (isLeft: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 0,
  [isLeft ? 'right' : 'left']: 0,
  backgroundColor: 'rgba(255, 255, 255, 0.9)',
  color: '#333',
  fontSize: '48px',
  fontWeight: 700,
  minWidth: '64px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: isLeft ? '0 0 0 8px' : '0 0 8px 0',
  zIndex: 10,
})

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

const dialogOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
}

const dialogContentStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '12px',
  padding: '24px',
  minWidth: '300px',
  maxWidth: '90vw',
}

const dialogFieldStyle: React.CSSProperties = {
  marginBottom: '16px',
}

const dialogButtonContainerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  marginTop: '24px',
}

export default GamePlay
