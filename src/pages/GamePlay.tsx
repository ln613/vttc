import { onMount, onCleanup, createSignal, Show, type JSX } from 'solid-js'
import { useSearchParams } from '@solidjs/router'
import {
  gamePlayState,
  gamePlayActions,
} from '../stores/gamePlayStore'
import type { Player } from '../../shared/types/Player'
import SingleSelectTags from '../components/SingleSelectTags'
import Button from '../components/Button'

const GamePlay = () => {
  const [searchParams] = useSearchParams()

  onMount(() => {
    gamePlayActions.initializeFromUrl(searchParams)
  })

  onCleanup(() => {
    gamePlayActions.reset()
  })

  return (
    <div style={containerStyle}>
      <div style={contentStyle}>
        <Header />
        <ScoreBoxes />
      </div>
      <Show when={gamePlayState.showInitDialog && !gamePlayState.loading}>
        <InitDialog />
      </Show>
    </div>
  )
}

const createIsWideScreen = () => {
  const [isWide, setIsWide] = createSignal(window.innerWidth > 640)

  onMount(() => {
    const handleResize = () => {
      setIsWide(window.innerWidth > 640)
    }

    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  return isWide
}

const Header = () => {
  const isWideScreen = createIsWideScreen()
  return (
    <Show when={isWideScreen()} fallback={<NarrowHeader />}>
      <WideHeader />
    </Show>
  )
}

const WideHeader = () => {
  const event = () => gamePlayState.data
  const stageName = () => gamePlayActions.getStageName()
  const currentGameIndex = () => gamePlayState.currentGameIndex
  const numberOfGames = () => gamePlayActions.getNumberOfGames()

  return (
    <Show when={event()}>
      <div style={wideHeaderStyle}>
        <div style={stageNameStyle}>{stageName()}</div>
        <div style={eventNameWideStyle}>{event()!.eventName}</div>
        <div style={gameInfoStyle}>
          Game {currentGameIndex() + 1} / {numberOfGames()}
        </div>
      </div>
    </Show>
  )
}

const NarrowHeader = () => {
  const event = () => gamePlayState.data
  const stageName = () => gamePlayActions.getStageName()
  const currentGameIndex = () => gamePlayState.currentGameIndex
  const numberOfGames = () => gamePlayActions.getNumberOfGames()

  return (
    <Show when={event()}>
      <div style={narrowHeaderContainerStyle}>
        <div style={eventNameNarrowStyle}>{event()!.eventName}</div>
        <div style={stageGameRowStyle}>
          <div style={stageNameStyle}>{stageName()}</div>
          <div style={gameInfoStyle}>
            Game {currentGameIndex() + 1} / {numberOfGames()}
          </div>
        </div>
      </div>
    </Show>
  )
}

const ScoreBoxes = () => {
  const leftSide = () => gamePlayState.leftSide
  const rightSide = () => (leftSide() === 1 ? 2 : 1)

  return (
    <div style={scoreBoxesContainerStyle}>
      <ScoreBox side={leftSide()} isLeft={true} />
      <ScoreBox side={rightSide()} isLeft={false} />
    </div>
  )
}

interface ScoreBoxProps {
  side: 1 | 2
  isLeft: boolean
}

const ScoreBox = (props: ScoreBoxProps) => {
  const servingSide = () => gamePlayState.servingSide
  const score = () => (props.side === 1 ? gamePlayState.score1 : gamePlayState.score2)
  const gamesWon = () => {
    const match = gamePlayActions.getCurrentMatch()
    if (!match) return 0
    return props.side === 1 ? match.gamesWon1 : match.gamesWon2
  }
  const timeout = () => (props.side === 1 ? gamePlayState.timeout1 : gamePlayState.timeout2)
  const players = () =>
    props.side === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players()
  const isServing = () => servingSide() === props.side

  let pointBoxRef: HTMLDivElement | undefined
  const [fontSize, setFontSize] = createSignal(120)

  onMount(() => {
    const calculateFontSize = () => {
      if (!pointBoxRef) return

      const boxWidth = pointBoxRef.offsetWidth
      const boxHeight = pointBoxRef.offsetHeight
      const padding = 32

      const availableWidth = boxWidth - padding * 2
      const availableHeight = boxHeight - padding * 2

      const minDimension = Math.min(availableWidth, availableHeight)
      const newFontSize = Math.max(minDimension, 40)

      setFontSize(newFontSize)
    }

    calculateFontSize()
    window.addEventListener('resize', calculateFontSize)
    onCleanup(() => window.removeEventListener('resize', calculateFontSize))
  })

  const handleAddPoint = () => {
    gamePlayActions.addPointToSide(props.side)
  }

  const handleDeductPoint = () => {
    gamePlayActions.deductPointFromSide(props.side)
  }

  const handleToggleTimeout = () => {
    gamePlayActions.toggleTimeout(props.side)
  }

  return (
    <div style={scoreBoxWrapperStyle}>
      <ParticipantNames players={players()} />
      <div style={scoreAreaContainerStyle}>
        <button style={getPlusButtonStyle(isServing())} onClick={handleAddPoint}>
          +
        </button>
        <div
          ref={pointBoxRef}
          style={getPointBoxStyle(isServing())}
          onClick={handleAddPoint}
        >
          <div style={getScoreDisplayStyle(fontSize())}>{score()}</div>
        </div>
        <GamesWonBadge gamesWon={gamesWon()} isLeft={props.isLeft} />
        <TimeoutBadge timeout={timeout()} isLeft={props.isLeft} onToggle={handleToggleTimeout} />
      </div>
      <button style={getMinusButtonStyle(isServing())} onClick={handleDeductPoint}>
        −
      </button>
    </div>
  )
}

interface GamesWonBadgeProps {
  gamesWon: number
  isLeft: boolean
}

const GamesWonBadge = (props: GamesWonBadgeProps) => (
  <div style={getGamesWonBadgeStyle(props.isLeft)}>
    {props.gamesWon}
  </div>
)

interface TimeoutBadgeProps {
  timeout: boolean
  isLeft: boolean
  onToggle: () => void
}

const TimeoutBadge = (props: TimeoutBadgeProps) => (
  <div
    style={getTimeoutBadgeStyle(props.isLeft, props.timeout)}
    onClick={(e) => {
      e.stopPropagation()
      props.onToggle()
    }}
  >
    T
  </div>
)

interface ParticipantNamesProps {
  players: Player[]
}

const ParticipantNames = (props: ParticipantNamesProps) => {
  const displayName = () => formatPlayerNames(props.players)
  return <div style={participantNamesStyle}>{displayName()}</div>
}

const formatPlayerNames = (players: Player[]): string => {
  if (!players || players.length === 0) return 'Player'
  return players.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

// Init Dialog Component
const InitDialog = () => {
  const initialServingSide = () => gamePlayState.initialServingSide
  const leftSide = () => gamePlayState.leftSide
  const participant1Name = () => gamePlayActions.getParticipantName(1)
  const participant2Name = () => gamePlayActions.getParticipantName(2)

  const options = () => [participant1Name(), participant2Name()]

  const handleServingChange = (selected: string) => {
    const side = selected === participant1Name() ? 1 : 2
    gamePlayActions.setInitialServingSide(side as 1 | 2)
  }

  const handleLeftSideChange = (selected: string) => {
    const side = selected === participant1Name() ? 1 : 2
    gamePlayActions.setLeftSide(side as 1 | 2)
  }

  const handleOk = () => {
    gamePlayActions.confirmInitDialog()
  }

  const selectedServing = () => initialServingSide() === 1 ? participant1Name() : participant2Name()
  const selectedLeft = () => leftSide() === 1 ? participant1Name() : participant2Name()

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogContentStyle}>
        <div style={dialogFieldStyle}>
          <SingleSelectTags
            label="Who serves first"
            options={options()}
            selectedValue={selectedServing()}
            onChange={handleServingChange}
            vertical
          />
        </div>
        <div style={dialogFieldStyle}>
          <SingleSelectTags
            label="Who is on left"
            options={options()}
            selectedValue={selectedLeft()}
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
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#1a1a2e',
  display: 'flex',
  'flex-direction': 'column',
  'user-select': 'none',
}

const contentStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'flex-direction': 'column',
  padding: '16px',
}

const wideHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '16px',
}

const eventNameWideStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#fff',
  'text-align': 'center',
  flex: 1,
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  margin: '0 16px',
}

const narrowHeaderContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'margin-bottom': '16px',
}

const eventNameNarrowStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#fff',
  'text-align': 'left',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  'margin-bottom': '8px',
}

const stageGameRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
}

const stageNameStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'left',
}

const gameInfoStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'right',
}

const scoreBoxesContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flex: 1,
}

const scoreBoxWrapperStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'stretch',
  'min-width': 0,
}

const scoreAreaContainerStyle: JSX.CSSProperties = {
  position: 'relative',
  flex: 1,
  display: 'flex',
  'flex-direction': 'column',
  'min-height': 0,
}

const getGamesWonBadgeStyle = (isLeft: boolean): JSX.CSSProperties => ({
  position: 'absolute',
  top: 0,
  [isLeft ? 'right' : 'left']: 0,
  'background-color': 'rgba(255, 255, 255, 0.9)',
  color: '#333',
  'font-size': '48px',
  'font-weight': 700,
  'min-width': '64px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'border-radius': isLeft ? '0 0 0 8px' : '0 0 8px 0',
  'z-index': 10,
})

const getTimeoutBadgeStyle = (isLeft: boolean, timeout: boolean): JSX.CSSProperties => ({
  position: 'absolute',
  top: 0,
  [isLeft ? 'left' : 'right']: 0,
  'background-color': timeout ? '#333' : 'rgba(255, 255, 255, 0.9)',
  color: timeout ? '#fff' : '#000',
  'font-size': '48px',
  'font-weight': 700,
  'min-width': '64px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'border-radius': isLeft ? '0 0 8px 0' : '0 0 0 8px',
  'z-index': 10,
  cursor: 'pointer',
})

const participantNamesStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'center',
  'word-break': 'break-word',
  'margin-bottom': '8px',
  width: '100%',
}

const getPlusButtonStyle = (isServing: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '12px 12px 0 0',
  border: 'none',
  'background-color': isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  'font-size': '32px',
  'font-weight': 700,
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
})

const getPointBoxStyle = (isServing: boolean): JSX.CSSProperties => ({
  width: '100%',
  flex: 1,
  'background-color': isServing ? '#c0392b' : '#2980b9',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  cursor: 'pointer',
  overflow: 'hidden',
  'min-height': 0,
})

const getScoreDisplayStyle = (fontSize: number): JSX.CSSProperties => ({
  'font-size': `${fontSize}px`,
  'font-weight': 700,
  color: '#fff',
  'line-height': 1,
})

const getMinusButtonStyle = (isServing: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '0 0 12px 12px',
  border: 'none',
  'background-color': isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  'font-size': '32px',
  'font-weight': 700,
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
})

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

const dialogContentStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  'min-width': '300px',
  'max-width': '90vw',
}

const dialogFieldStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
}

const dialogButtonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  'margin-top': '24px',
}

export default GamePlay
