import { onMount, onCleanup, createSignal, Show, For, type JSX } from 'solid-js'
import { useSearchParams, useNavigate } from '@solidjs/router'
import {
  gamePlayState,
  gamePlayActions,
} from '../stores/gamePlayStore'
import type { Player } from '../../shared/types/Player'
import SingleSelectTags from '../components/SingleSelectTags'
import Button from '../components/Button'

const GamePlay = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  let containerRef: HTMLDivElement | undefined

  onMount(() => {
    gamePlayActions.initializeFromUrl(searchParams)
    if (containerRef) {
      preventDoubleTapZoom(containerRef)
    }
  })

  onCleanup(() => {
    gamePlayActions.reset()
  })

  const handleExit = () => {
    gamePlayActions.closeMenu()
    navigate(-1)
  }

  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={contentStyle}>
        <Header onExit={handleExit} />
        <ScoreBoxes />
      </div>
      <Show when={gamePlayState.showInitDialog && !gamePlayState.loading}>
        <InitDialog />
      </Show>
      <Show when={gamePlayState.showFinishDialog}>
        <FinishConfirmDialog />
      </Show>
    </div>
  )
}

const preventDoubleTapZoom = (element: HTMLElement) => {
  let lastTouchEnd = 0

  const handleTouchEnd = (e: TouchEvent) => {
    const now = Date.now()
    if (now - lastTouchEnd <= 300) {
      e.preventDefault()
    }
    lastTouchEnd = now
  }

  const handleDblClick = (e: Event) => {
    e.preventDefault()
  }

  element.addEventListener('touchend', handleTouchEnd, { passive: false })
  element.addEventListener('dblclick', handleDblClick)

  onCleanup(() => {
    element.removeEventListener('touchend', handleTouchEnd)
    element.removeEventListener('dblclick', handleDblClick)
  })
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

// Hamburger Menu Components

const HamburgerIcon = () => (
  <button style={hamburgerButtonStyle} onClick={() => gamePlayActions.toggleMenu()}>
    <div style={hamburgerLineStyle} />
    <div style={hamburgerLineStyle} />
    <div style={hamburgerLineStyle} />
  </button>
)

interface HamburgerMenuProps {
  onExit: () => void
}

const HamburgerMenu = (props: HamburgerMenuProps) => {
  const matchSubmitted = () => gamePlayState.matchSubmitted

  const handleResetGame = () => {
    if (confirm('Are you sure you want to reset the current game?')) {
      gamePlayActions.resetCurrentGame()
    } else {
      gamePlayActions.closeMenu()
    }
  }

  const handleResetMatch = () => {
    if (matchSubmitted()) return
    if (confirm('Are you sure you want to reset the whole match?')) {
      gamePlayActions.resetWholeMatch()
    } else {
      gamePlayActions.closeMenu()
    }
  }

  const handleExit = () => {
    props.onExit()
  }

  return (
    <>
      <div style={menuOverlayStyle} onClick={() => gamePlayActions.closeMenu()} />
      <div style={menuDropdownStyle}>
        <button style={menuItemStyle} onClick={handleResetGame}>
          Reset Game
        </button>
        <button
          style={getMenuItemStyle(matchSubmitted())}
          onClick={handleResetMatch}
          disabled={matchSubmitted()}
        >
          Reset Match
        </button>
        <button style={menuItemStyle} onClick={handleExit}>
          Exit
        </button>
      </div>
    </>
  )
}

interface HeaderProps {
  onExit: () => void
}

const Header = (props: HeaderProps) => {
  const isWideScreen = createIsWideScreen()
  return (
    <Show when={isWideScreen()} fallback={<NarrowHeader onExit={props.onExit} />}>
      <WideHeader onExit={props.onExit} />
    </Show>
  )
}

const WideHeader = (props: HeaderProps) => {
  const event = () => gamePlayState.data
  const stageName = () => gamePlayActions.getStageName()
  const currentGameIndex = () => gamePlayState.currentGameIndex
  const numberOfGames = () => gamePlayActions.getNumberOfGames()
  const menuOpen = () => gamePlayState.menuOpen

  return (
    <Show when={event()}>
      <div style={wideHeaderStyle}>
        <div style={hamburgerContainerStyle}>
          <HamburgerIcon />
          <Show when={menuOpen()}>
            <HamburgerMenu onExit={props.onExit} />
          </Show>
        </div>
        <div style={stageNameStyle}>{stageName()}</div>
        <div style={eventNameWideStyle}>{event()!.eventName}</div>
        <div style={gameInfoStyle}>
          Game {currentGameIndex() + 1} / {numberOfGames()}
        </div>
      </div>
    </Show>
  )
}

const NarrowHeader = (props: HeaderProps) => {
  const event = () => gamePlayState.data
  const stageName = () => gamePlayActions.getStageName()
  const currentGameIndex = () => gamePlayState.currentGameIndex
  const numberOfGames = () => gamePlayActions.getNumberOfGames()
  const menuOpen = () => gamePlayState.menuOpen

  return (
    <Show when={event()}>
      <div style={narrowHeaderContainerStyle}>
        <div style={narrowHeaderTopRowStyle}>
          <div style={hamburgerContainerStyle}>
            <HamburgerIcon />
            <Show when={menuOpen()}>
              <HamburgerMenu onExit={props.onExit} />
            </Show>
          </div>
          <div style={eventNameNarrowStyle}>{event()!.eventName}</div>
        </div>
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
  const winningSide = () => gamePlayActions.getGameWinningSide()
  const isMatchFinished = () => gamePlayActions.isMatchFinished()

  return (
    <div style={scoreBoxesOuterStyle}>
      <div style={scoreBoxesContainerStyle}>
        <ScoreBox side={leftSide()} isLeft={true} />
        <ScoreBox side={rightSide()} isLeft={false} />
      </div>
      <Show when={winningSide()}>
        <GameEndButton isMatchFinished={isMatchFinished()} />
      </Show>
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
  const gamesWon = () => gamePlayActions.getGamesWon(props.side)
  const timeout = () => (props.side === 1 ? gamePlayState.timeout1 : gamePlayState.timeout2)
  const players = () =>
    props.side === 1
      ? gamePlayActions.getSide1Players()
      : gamePlayActions.getSide2Players()
  const isServing = () => servingSide() === props.side
  const winningSide = () => gamePlayActions.getGameWinningSide()
  const isWinner = () => winningSide() === props.side
  const isGameOver = () => winningSide() !== undefined

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
    if (isGameOver()) return
    gamePlayActions.addPointToSide(props.side)
  }

  const isLoserSide = () => isGameOver() && !isWinner()

  const handleDeductPoint = () => {
    if (isLoserSide()) return
    gamePlayActions.deductPointFromSide(props.side)
  }

  const handleToggleTimeout = () => {
    gamePlayActions.toggleTimeout(props.side)
  }

  return (
    <div style={scoreBoxWrapperStyle}>
      <ParticipantNames players={players()} />
      <div style={scoreAreaContainerStyle}>
        <button
          style={getPlusButtonStyle(isServing(), isGameOver())}
          onClick={handleAddPoint}
          disabled={isGameOver()}
        >
          +
        </button>
        <div
          ref={pointBoxRef}
          style={getPointBoxStyle(isServing(), isGameOver())}
          onClick={handleAddPoint}
        >
          <div style={getScoreDisplayStyle(fontSize(), isWinner())}>{score()}</div>
        </div>
        <GamesWonBadge gamesWon={gamesWon()} isLeft={props.isLeft} />
        <TimeoutBadge timeout={timeout()} isLeft={props.isLeft} onToggle={handleToggleTimeout} />
      </div>
      <button
        style={getMinusButtonStyle(isServing(), isLoserSide())}
        onClick={handleDeductPoint}
        disabled={isLoserSide()}
      >
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

// Game End Button Component (Next Game / Finish)
interface GameEndButtonProps {
  isMatchFinished: boolean
}

const GameEndButton = (props: GameEndButtonProps) => {
  const handleClick = () => {
    if (props.isMatchFinished) {
      gamePlayActions.finishMatch()
    } else {
      gamePlayActions.nextGame()
    }
  }

  const label = () => (props.isMatchFinished ? 'Finish' : 'Next Game')

  return (
    <button style={gameEndButtonStyle} onClick={handleClick}>
      {label()}
    </button>
  )
}

// Finish Confirm Dialog Component
const FinishConfirmDialog = () => {
  const navigate = useNavigate()
  const preview = () => gamePlayActions.getFinishMatchPreview()
  const participant1Name = () => gamePlayActions.getParticipantName(1)
  const participant2Name = () => gamePlayActions.getParticipantName(2)

  const handleCancel = () => {
    gamePlayActions.cancelFinishMatch()
  }

  const handleConfirm = async () => {
    await gamePlayActions.confirmFinishMatch()
    navigate(`/event/${gamePlayState.eventId}`)
  }

  return (
    <div style={dialogOverlayStyle}>
      <div style={finishDialogContentStyle}>
        <div style={finishDialogMessageStyle}>
          Show the match result to both sides and confirm the result with them
        </div>
        <MatchResultPreview
          preview={preview()}
          participant1Name={participant1Name()}
          participant2Name={participant2Name()}
        />
        <div style={finishDialogButtonsStyle}>
          <Button onClick={handleCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm</Button>
        </div>
      </div>
    </div>
  )
}

interface MatchResultPreviewProps {
  preview: {
    gamesWon1: number
    gamesWon2: number
    games: { score1: number; score2: number; winningSide?: 1 | 2 }[]
  }
  participant1Name: string
  participant2Name: string
}

const MatchResultPreview = (props: MatchResultPreviewProps) => (
  <div style={matchResultContainerStyle}>
    <div style={matchResultHeaderStyle}>
      <div style={matchResultNameStyle}>{props.participant1Name}</div>
      <div style={matchResultScoreStyle}>
        {props.preview.gamesWon1} - {props.preview.gamesWon2}
      </div>
      <div style={matchResultNameStyle}>{props.participant2Name}</div>
    </div>
    <div style={gameResultsListStyle}>
      <For each={props.preview.games}>
        {(game, index) => (
          <div style={gameResultRowStyle}>
            <div style={gameResultLabelStyle}>Game {index() + 1}</div>
            <div
              style={getGameScoreStyle(game.winningSide === 1)}
            >
              {game.score1}
            </div>
            <div style={gameResultSeparatorStyle}>-</div>
            <div
              style={getGameScoreStyle(game.winningSide === 2)}
            >
              {game.score2}
            </div>
          </div>
        )}
      </For>
    </div>
  </div>
)

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
            label="Who is on umpire's left"
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
  height: '100dvh',
  'background-color': '#1a1a2e',
  display: 'flex',
  'flex-direction': 'column',
  'user-select': 'none',
  'touch-action': 'manipulation',
  overflow: 'hidden',
}

const contentStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'flex-direction': 'column',
  padding: '8px 16px 16px',
  'min-height': 0,
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

const narrowHeaderTopRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'margin-bottom': '8px',
}

const eventNameNarrowStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#fff',
  'text-align': 'left',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  flex: 1,
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

// Hamburger menu styles
const hamburgerContainerStyle: JSX.CSSProperties = {
  position: 'relative',
  'margin-right': '12px',
}

const hamburgerButtonStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'justify-content': 'center',
  'align-items': 'center',
  gap: '5px',
  width: '36px',
  height: '36px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
}

const hamburgerLineStyle: JSX.CSSProperties = {
  width: '24px',
  height: '3px',
  'background-color': '#fff',
  'border-radius': '2px',
}

const menuOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'z-index': 99,
}

const menuDropdownStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '40px',
  left: 0,
  'background-color': '#2c2c4a',
  'border-radius': '8px',
  'min-width': '180px',
  'box-shadow': '0 4px 16px rgba(0, 0, 0, 0.4)',
  'z-index': 100,
  overflow: 'hidden',
}

const menuItemStyle: JSX.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '14px 20px',
  background: 'none',
  border: 'none',
  color: '#fff',
  'font-size': '16px',
  'text-align': 'left',
  cursor: 'pointer',
}

const getMenuItemStyle = (disabled: boolean): JSX.CSSProperties => ({
  display: 'block',
  width: '100%',
  padding: '14px 20px',
  background: 'none',
  border: 'none',
  color: disabled ? '#666' : '#fff',
  'font-size': '16px',
  'text-align': 'left',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
})

const scoreBoxesOuterStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  flex: 1,
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
  'min-height': 0,
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

const getPlusButtonStyle = (isServing: boolean, isGameOver: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '12px 12px 0 0',
  border: 'none',
  'background-color': isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  'font-size': '32px',
  'font-weight': 700,
  cursor: isGameOver ? 'default' : 'pointer',
  opacity: isGameOver ? 0.5 : 1,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
})

const getPointBoxStyle = (isServing: boolean, isGameOver: boolean): JSX.CSSProperties => ({
  width: '100%',
  flex: 1,
  'background-color': isServing ? '#c0392b' : '#2980b9',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  cursor: isGameOver ? 'default' : 'pointer',
  overflow: 'hidden',
  'min-height': 0,
})

const getScoreDisplayStyle = (fontSize: number, isWinner: boolean): JSX.CSSProperties => ({
  'font-size': `${fontSize}px`,
  'font-weight': 700,
  color: isWinner ? '#ffd700' : '#fff',
  'line-height': 1,
})

const getMinusButtonStyle = (isServing: boolean, isDisabled: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '0 0 12px 12px',
  border: 'none',
  'background-color': isServing ? '#922b21' : '#1a5276',
  color: '#fff',
  'font-size': '32px',
  'font-weight': 700,
  cursor: isDisabled ? 'default' : 'pointer',
  opacity: isDisabled ? 0.5 : 1,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
})

const gameEndButtonStyle: JSX.CSSProperties = {
  width: '100%',
  height: '60px',
  'border-radius': '12px',
  border: 'none',
  'background-color': '#27ae60',
  color: '#fff',
  'font-size': '24px',
  'font-weight': 700,
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'margin-top': '4px',
}

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

// Finish Confirm Dialog Styles
const finishDialogContentStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
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

export default GamePlay
