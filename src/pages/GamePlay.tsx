import {
  onMount,
  onCleanup,
  createEffect,
  createSignal,
  Show,
  For,
  type JSX,
} from 'solid-js'
import { useSearchParams, useNavigate } from '@solidjs/router'
import {
  gamePlayState,
  gamePlayActions,
} from '../stores/gamePlayStore'
import { eventDetailActions } from '../stores/eventDetailStore'
import { authState } from '../stores/authStore'
import { subscribeToMatchReset, type EventSubscription } from '../utils/pusher'
import type { Player } from '../../shared/types/Player'
import SingleSelectTags from '../components/SingleSelectTags'
import Button from '../components/Button'
import MatchConfirmDialog from '../components/MatchConfirmDialog'

const GamePlay = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  let containerRef: HTMLDivElement | undefined
  let resetSub: EventSubscription | null = null
  let subscribedEventId: string | null = null
  let autoStartedMatchId: string | null = null

  onMount(() => {
    gamePlayActions.initializeFromUrl(searchParams)
    if (containerRef) {
      preventDoubleTapZoom(containerRef)
    }
  })

  createEffect(() => {
    const eventId = gamePlayState.eventId
    if (eventId && eventId !== subscribedEventId) {
      resetSub?.unsubscribe()
      resetSub = subscribeToMatchReset(eventId, (matchId) => {
        gamePlayActions.notifyMatchReset(matchId)
      })
      subscribedEventId = eventId
    }
  })

  // Auto-press Start for the user's own side on entry so the player who
  // clicked Start in Schedule/EventDetail doesn't have to click again
  // before the order-of-play picker opens.
  createEffect(() => {
    if (authState.isAdmin) return
    if (!gamePlayActions.isTeamMatch()) return
    const matchId = gamePlayState.matchId
    if (!matchId || autoStartedMatchId === matchId) return
    const side = gamePlayActions.getUserSideInMatch()
    if (!side) return
    const m = gamePlayActions.getCurrentMatch()
    if (!m) return
    const alreadyStarted = side === 1 ? m.side1Started : m.side2Started
    if (alreadyStarted) {
      autoStartedMatchId = matchId
      return
    }
    autoStartedMatchId = matchId
    void gamePlayActions.startTeamSide(side)
  })

  // Once both team-match orders are saved, sub-matches exist. Hop the
  // page to the next live sub-match so the players can keep playing.
  createEffect(() => {
    if (!gamePlayActions.isTeamMatch()) return
    if (!gamePlayActions.bothSidesAssigned()) return
    const parent = gamePlayActions.getCurrentMatch()
    if (!parent || !Array.isArray(parent.subMatches)) return
    const nextSub = parent.subMatches.find(
      (s) =>
        !s.cancelledAt &&
        !(s.winningSide != null && s.confirmed === true),
    )
    const eventId = gamePlayState.eventId
    if (!eventId) return
    if (nextSub) {
      navigate(
        `/game-play?eventId=${eventId}&stage=${gamePlayState.stage}&groupIndex=${gamePlayState.groupIndex}&matchId=${nextSub._id}`,
        { replace: true },
      )
    } else {
      // No live sub-match left (team match finalised); leave the page.
      goBackOrSchedule(navigate)
    }
  })

  onCleanup(() => {
    resetSub?.unsubscribe()
    resetSub = null
    subscribedEventId = null
    gamePlayActions.reset()
  })

  const handleExit = async () => {
    gamePlayActions.closeMenu()
    await gamePlayActions.exitAndFlush()
    goBackOrSchedule(navigate)
  }

  const handleResetExit = () => {
    goBackOrSchedule(navigate)
  }

  const sessionBlocked = () =>
    gamePlayState.sessionTakenOver ||
    !!gamePlayState.sessionError ||
    gamePlayState.matchReset

  return (
    <div ref={containerRef} style={containerStyle}>
      <div style={{ ...contentStyle, ...(sessionBlocked() ? blockedStyle : {}) }}>
        <Header onExit={handleExit} />
        <ScoreBoxes />
      </div>
      <Show
        when={
          gamePlayActions.isTeamMatch() &&
          !gamePlayActions.bothSidesAssigned() &&
          !gamePlayState.loading &&
          !sessionBlocked()
        }
      >
        <TeamSetupDialog />
      </Show>
      <Show
        when={
          !gamePlayActions.isTeamMatch() &&
          gamePlayState.showInitDialog &&
          !gamePlayState.loading &&
          !sessionBlocked()
        }
      >
        <InitDialog />
      </Show>
      <Show when={gamePlayState.showFinishDialog && !sessionBlocked()}>
        <FinishConfirmDialog />
      </Show>
      <Show when={sessionBlocked()}>
        <SessionBlockedOverlay onExit={handleResetExit} />
      </Show>
    </div>
  )
}

const goBackOrSchedule = (navigate: ReturnType<typeof useNavigate>) => {
  if (window.history.length > 1) {
    navigate(-1)
  } else {
    navigate('/schedule')
  }
}

const SessionBlockedOverlay = (props: { onExit: () => void }) => {
  const message = () => {
    if (gamePlayState.matchReset) return 'The match has been reset.'
    if (gamePlayState.sessionTakenOver) return 'An admin has taken over this match.'
    return gamePlayState.sessionError ?? 'This match is unavailable.'
  }
  return (
    <div style={overlayStyle}>
      <div style={overlayCardStyle}>
        <div style={overlayMessageStyle}>{message()}</div>
        <button style={overlayButtonStyle} onClick={props.onExit}>
          Go Back
        </button>
      </div>
    </div>
  )
}

const blockedStyle: JSX.CSSProperties = {
  'pointer-events': 'none',
  opacity: 0.4,
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.6)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 2000,
  padding: '16px',
}

const overlayCardStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '360px',
  'text-align': 'center',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.25)',
}

const overlayMessageStyle: JSX.CSSProperties = {
  'font-size': '15px',
  color: '#333',
  'margin-bottom': '20px',
}

const overlayButtonStyle: JSX.CSSProperties = {
  padding: '10px 24px',
  'font-size': '14px',
  'font-weight': 600,
  border: 'none',
  'border-radius': '8px',
  'background-color': '#e74c3c',
  color: '#fff',
  cursor: 'pointer',
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
      <ParticipantNames side={props.side} />
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
  side: 1 | 2
}

const ParticipantNames = (props: ParticipantNamesProps) => {
  const displayName = () => gamePlayActions.getParticipantName(props.side)
  return <div style={participantNamesStyle}>{displayName()}</div>
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
    // Invalidate cached event data so the ranking table refreshes on navigation back
    eventDetailActions.invalidateData()
    navigate(`/event/${gamePlayState.eventId}`)
  }

  return (
    <MatchConfirmDialog
      preview={preview()}
      participant1Name={participant1Name()}
      participant2Name={participant2Name()}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  )
}

// Unified team-match setup dialog. Each side independently moves
// through "press Start" → "pick order" → "order locked in". The user
// only sees the form for their own side (admins see both).
const TeamSetupDialog = () => {
  const match = () => gamePlayActions.getCurrentMatch()
  const userSide = () => gamePlayActions.getUserSideInMatch()
  const homeSide = () => match()?.homeSide

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogContentStyle}>
        <div style={teamStartTitleStyle}>Team Match Setup</div>
        <TeamSideSetupPanel
          side={1}
          isHome={homeSide() === 1}
          userSide={userSide()}
        />
        <TeamSideSetupPanel
          side={2}
          isHome={homeSide() === 2}
          userSide={userSide()}
        />
        <Show
          when={
            gamePlayActions.hasSideAssignment(1) &&
            gamePlayActions.hasSideAssignment(2)
          }
        >
          <div style={teamStartReadyStyle}>
            Both orders saved. Sub-matches will be generated next.
          </div>
        </Show>
      </div>
    </div>
  )
}

const TeamSideSetupPanel = (props: {
  side: 1 | 2
  isHome: boolean
  userSide: 1 | 2 | undefined
}) => {
  const match = () => gamePlayActions.getCurrentMatch()
  const isAdmin = () => authState.isAdmin
  const started = () =>
    props.side === 1
      ? !!match()?.side1Started
      : !!match()?.side2Started
  const assigned = () => gamePlayActions.hasSideAssignment(props.side)
  const canAct = () => isAdmin() || props.userSide === props.side
  const label = () =>
    `${gamePlayActions.getParticipantName(props.side)} (${props.isHome ? 'Home' : 'Away'})`
  const players = () =>
    (props.side === 1 ? match()?.side1 : match()?.side2) || []

  const handleStart = () => {
    void gamePlayActions.startTeamSide(props.side)
  }

  return (
    <div style={teamSetupPanelStyle}>
      <div style={teamSetupPanelLabelStyle}>{label()}</div>
      <Show when={assigned()}>
        <div style={teamSetupStatusOkStyle}>Order locked in ✓</div>
      </Show>
      <Show when={!assigned() && started() && canAct()}>
        <TeamOrderForm
          side={props.side}
          players={players()}
          isHome={props.isHome}
        />
      </Show>
      <Show when={!assigned() && started() && !canAct()}>
        <div style={teamSetupStatusMutedStyle}>
          Started — waiting for their order…
        </div>
      </Show>
      <Show when={!started() && canAct()}>
        <Button onClick={handleStart}>Set Order</Button>
      </Show>
      <Show when={!started() && !canAct()}>
        <div style={teamSetupStatusMutedStyle}>Waiting to start…</div>
      </Show>
    </div>
  )
}

const TeamOrderForm = (props: {
  side: 1 | 2
  players: Player[]
  isHome: boolean
}) => {
  const slotLabels = () => (props.isHome ? ['A', 'B', 'C', 'D'] : ['X', 'Y', 'Z', 'W'])
  const picksCount = () => Math.max(0, props.players.length - 1)
  const [picks, setPicks] = createSignal<string[]>(
    Array.from({ length: picksCount() }, () => ''),
  )

  const optionsForSlot = (slotIndex: number) => {
    const chosen = new Set(
      picks().filter((_, i) => i !== slotIndex && picks()[i]),
    )
    return props.players
      .filter((p) => !chosen.has(p._id))
      .map((p) => ({
        value: p._id,
        label: `${p.firstName} ${p.lastName}`,
      }))
  }

  const handlePick = (slotIndex: number, playerId: string) => {
    const next = [...picks()]
    next[slotIndex] = playerId
    setPicks(next)
  }

  const remainingPlayer = (): Player | undefined => {
    const chosen = new Set(picks().filter(Boolean))
    return props.players.find((p) => !chosen.has(p._id))
  }

  const allPicked = () => picks().every(Boolean)

  const handleSave = () => {
    void gamePlayActions.saveTeamSideAssignment(props.side, picks())
  }

  const remainingLabel = () => {
    if (!allPicked()) return '(auto)'
    const r = remainingPlayer()
    return r ? `${r.firstName} ${r.lastName} (auto)` : '(auto)'
  }

  return (
    <div style={teamOrderFormStyle}>
      <For each={Array.from({ length: picksCount() }, (_, i) => i)}>
        {(slotIndex) => (
          <div style={teamOrderSlotStyle}>
            <span style={teamOrderSlotLabelStyle}>
              {slotLabels()[slotIndex]}
            </span>
            <select
              style={teamOrderSelectStyle}
              value={picks()[slotIndex]}
              onChange={(e) =>
                handlePick(slotIndex, (e.target as HTMLSelectElement).value)
              }
            >
              <option value="" disabled>
                -- Select --
              </option>
              <For each={optionsForSlot(slotIndex)}>
                {(opt) => <option value={opt.value}>{opt.label}</option>}
              </For>
            </select>
          </div>
        )}
      </For>
      <div style={teamOrderSlotStyle}>
        <span style={teamOrderSlotLabelStyle}>
          {slotLabels()[picksCount()]}
        </span>
        <span style={teamOrderAutoStyle}>{remainingLabel()}</span>
      </div>
      <div style={dialogButtonContainerStyle}>
        <Button onClick={handleSave} disabled={!allPicked()}>
          Save Order
        </Button>
      </div>
    </div>
  )
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
  'flex-direction': 'row-reverse',
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
  // Reserve up to three lines and bottom-anchor the name so the next
  // element (the score box) starts at the same vertical position on
  // both sides regardless of how the names wrap.
  'min-height': '3.9em',
  display: 'flex',
  'align-items': 'flex-end',
  'justify-content': 'center',
  'line-height': 1.3,
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

const teamStartTitleStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#2c3e50',
  'margin-bottom': '8px',
  'text-align': 'center',
}

const teamStartHintStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  'margin-bottom': '16px',
  'text-align': 'center',
}

const teamSetupPanelStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  padding: '12px 0',
  'border-bottom': '1px solid #eee',
}

const teamSetupPanelLabelStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#2c3e50',
}

const teamSetupStatusOkStyle: JSX.CSSProperties = {
  color: '#27ae60',
  'font-weight': 600,
  'font-size': '14px',
}

const teamSetupStatusMutedStyle: JSX.CSSProperties = {
  color: '#888',
  'font-size': '13px',
  'font-style': 'italic',
}

const teamOrderWaitingStyle: JSX.CSSProperties = {
  'margin-top': '12px',
  padding: '10px',
  'background-color': '#f5f5f5',
  'border-radius': '6px',
  color: '#666',
  'text-align': 'center',
  'font-size': '13px',
}

const teamOrderFormStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
  padding: '12px',
  border: '1px solid #ddd',
  'border-radius': '8px',
}

const teamOrderHeadingStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#2c3e50',
  'margin-bottom': '12px',
}

const teamOrderSlotStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
  'margin-bottom': '8px',
}

const teamOrderSlotLabelStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'font-weight': 700,
  color: '#3498db',
  'min-width': '24px',
}

const teamOrderSelectStyle: JSX.CSSProperties = {
  flex: 1,
  padding: '8px 12px',
  'font-size': '14px',
  border: '1px solid #ccc',
  'border-radius': '6px',
}

const teamOrderAutoStyle: JSX.CSSProperties = {
  flex: 1,
  'font-size': '14px',
  color: '#888',
  'font-style': 'italic',
}

const teamStartReadyStyle: JSX.CSSProperties = {
  'margin-top': '16px',
  padding: '12px',
  'background-color': '#f0faf4',
  'border-radius': '8px',
  color: '#27ae60',
  'text-align': 'center',
  'font-weight': 600,
  'font-size': '14px',
}

export default GamePlay
