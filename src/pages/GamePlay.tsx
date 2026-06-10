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
import { liveScoreActions, liveScoreState } from '../stores/liveScoreStore'
import { customConfirm } from '../stores/confirmDialogStore'
import { authState } from '../stores/authStore'
import {
  getTeamSubMatchTitle,
  TEAM_SUB_MATCH_LABELS,
  deriveTeamMatchType,
} from './EventDetail'
import { subscribeToMatchReset, type EventSubscription } from '../utils/pusher'
import type { Player } from '../../shared/types/Player'
import Button from '../components/Button'
import MatchConfirmDialog from '../components/MatchConfirmDialog'
import serveIconUrl from '../assets/serve.png'
import tableIconUrl from '../assets/table.png'

const GamePlay = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  let containerRef: HTMLDivElement | undefined
  let resetSub: EventSubscription | null = null
  let subscribedEventId: string | null = null
  let autoStartedMatchId: string | null = null

  onMount(() => {
    gamePlayActions.initializeFromUrl(searchParams)
    // Load live-score state so the landscape info box can resolve the
    // current table number for this match. fetchLiveScore (no flag)
    // doesn't trigger server-side auto-generation.
    void liveScoreActions.fetchLiveScore()
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

  // Tablet mode: page is pinned to a table; the live-score store is
  // the source of truth for what's currently on it. Three cases:
  //   1) No matchId loaded + a match is now on the table → load it.
  //   2) A match is loaded but the table no longer holds it (the
  //      match was postponed / cancelled / reassigned elsewhere) →
  //      drop it; on the next tick this same effect loads whatever
  //      replaced it (or shows the no-match screen).
  //   3) Match on the table matches the one loaded → nothing to do.
  createEffect(() => {
    if (gamePlayState.tableNumber == null) return
    const tableNumber = gamePlayState.tableNumber
    const t = liveScoreState.tables.find((x) => x.tableNumber === tableNumber)
    const m = t?.match
    const currentMatchId = gamePlayState.matchId
    const tableMatchId = m?.matchId

    if (currentMatchId && tableMatchId !== currentMatchId) {
      void gamePlayActions.clearMatchForTable()
      return
    }
    if (currentMatchId) return
    if (!m) return
    const params: Record<string, string> = {
      tableNumber: String(tableNumber),
      eventId: m.eventId,
      matchId: m.matchId,
      stage: m.stageType,
    }
    if (m.groupIndex != null) params.groupIndex = String(m.groupIndex)
    void gamePlayActions.initializeFromUrl(params)
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
  // Tablet sessions keep their `tableNumber` query param so a later
  // sub-match completion can fall back to the "no match" screen on
  // the same table.
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
    // Tablet doesn't need a per-event hop here — the live-score
    // effect below detects the parent → sub-match swap on this
    // table generally and drives the transition.
    if (authState.isTablet) return
    if (nextSub) {
      const next: Record<string, string> = {
        eventId,
        stage: gamePlayState.stage,
        groupIndex: String(gamePlayState.groupIndex),
        matchId: nextSub._id,
      }
      if (gamePlayState.tableNumber != null) {
        next.tableNumber = String(gamePlayState.tableNumber)
      }
      navigate(
        `/game-play?${new URLSearchParams(next).toString()}`,
        { replace: true },
      )
      // Drive the actual page state too — navigate() updates the URL
      // but doesn't re-run onMount, so initializeFromUrl wouldn't
      // pick up the new matchId on its own.
      void gamePlayActions.initializeFromUrl(next)
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

  const isLandscape = createIsLandscape()

  return (
    <div ref={containerRef} style={containerStyle}>
      <Show
        when={!gamePlayState.loading}
        fallback={<LoadingSpinner />}
      >
        <Show
          when={!gamePlayState.matchId && gamePlayState.tableNumber != null}
          fallback={
            <Show
              when={gamePlayState.showInitDialog && !sessionBlocked()}
              fallback={
                <div
                  style={{
                    ...contentStyle,
                    // Landscape has no header — drop the top breathing
                    // room so the score boxes truly run edge-to-edge.
                    ...(isLandscape() ? { padding: '0' } : {}),
                    ...(sessionBlocked() ? blockedStyle : {}),
                  }}
                >
                  <Show when={!isLandscape()}>
                    <Header onExit={handleExit} />
                  </Show>
                  <ScoreBoxes landscape={isLandscape()} onExit={handleExit} />
                </div>
              }
            >
              <InitScreen />
            </Show>
          }
        >
          <NoMatchAssignedScreen />
        </Show>
      </Show>
      <Show
        when={
          gamePlayActions.isTeamMatch() &&
          !gamePlayActions.bothSidesAssigned() &&
          !gamePlayState.loading &&
          !sessionBlocked() &&
          // Tablet is just the score-keeper — it doesn't participate
          // in the "press Start / set order" handshake, so the team
          // setup dialog (which would show "Waiting to start…" for
          // both sides) is hidden. The page just shows the regular
          // state behind it until the players finish their setup and
          // the auto-hop effect moves to the first sub-match.
          !authState.isTablet
        }
      >
        <TeamSetupDialog />
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

const createIsLandscape = () => {
  const [isLandscape, setIsLandscape] = createSignal(
    window.innerWidth > window.innerHeight,
  )

  onMount(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight)
    }

    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  return isLandscape
}

// Shown on the GamePlay page (tablet flow) when the user picked a
// table that doesn't currently have a match assigned. Just a big
// table number centered against the dark page background.
const NoMatchAssignedScreen = () => (
  <div style={noMatchScreenStyle}>
    <div style={noMatchTableNumberStyle}>{gamePlayState.tableNumber}</div>
  </div>
)

const noMatchScreenStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const noMatchTableNumberStyle: JSX.CSSProperties = {
  'font-size': 'clamp(120px, 50vh, 360px)',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1,
}

const LoadingSpinner = () => (
  <div style={loadingContainerStyle}>
    <div style={spinnerStyle} />
    <style>{spinnerKeyframes}</style>
  </div>
)

const spinnerKeyframes = `
@keyframes gp-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`

const loadingContainerStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const spinnerStyle: JSX.CSSProperties = {
  width: '56px',
  height: '56px',
  border: '5px solid rgba(255, 255, 255, 0.15)',
  'border-top-color': '#f1c40f',
  'border-radius': '50%',
  animation: 'gp-spin 0.9s linear infinite',
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

  const handleResetGame = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (
      await customConfirm('Are you sure you want to reset the current game?', {
        confirmColor: '#e74c3c',
      })
    ) {
      gamePlayActions.resetCurrentGame()
    } else {
      gamePlayActions.closeMenu()
    }
  }

  const handleResetMatch = async (e?: MouseEvent) => {
    e?.stopPropagation()
    e?.preventDefault()
    if (matchSubmitted()) return
    if (
      await customConfirm('Are you sure you want to reset the whole match?', {
        confirmColor: '#e74c3c',
      })
    ) {
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

interface ScoreBoxesProps {
  landscape: boolean
  onExit: () => void
}

const ScoreBoxes = (props: ScoreBoxesProps) => {
  const leftSide = () => gamePlayState.leftSide
  const rightSide = () => (leftSide() === 1 ? 2 : 1)
  const winningSide = () => gamePlayActions.getGameWinningSide()
  const isMatchFinished = () => gamePlayActions.isMatchFinished()

  return (
    <div style={scoreBoxesOuterStyle}>
      <div style={scoreBoxesContainerStyle}>
        <ScoreBox side={leftSide()} isLeft={true} />
        <Show when={props.landscape}>
          <LandscapeInfoBox onExit={props.onExit} />
        </Show>
        <ScoreBox side={rightSide()} isLeft={false} />
      </div>
      <Show when={winningSide()}>
        <GameEndButton isMatchFinished={isMatchFinished()} />
      </Show>
    </div>
  )
}

const LandscapeInfoBox = (_props: { onExit: () => void }) => {
  const event = () => gamePlayState.data
  const match = () => gamePlayActions.getCurrentMatch()
  const stageName = () => gamePlayActions.getStageName()
  const numberOfGames = () => gamePlayActions.getNumberOfGames()
  const currentGameIndex = () => gamePlayState.currentGameIndex
  const tableNumber = () => {
    const m = match()
    if (!m) return undefined
    if (m.lockedTableNumber) return m.lockedTableNumber
    return liveScoreActions.getTableForMatch(m._id)
  }
  const subMatchLabel = (): string | undefined => {
    const m = match()
    if (!m || !m.parentMatchId) return undefined
    const ev = event()
    if (!ev) return undefined
    for (const stage of ev.eventStages || []) {
      const lists =
        stage.type === 'group'
          ? stage.groups.map((g) => g.matches)
          : stage.type === 'knockout'
            ? stage.rounds.map((r) =>
                r.matches.map((km) => km.match).filter((x): x is NonNullable<typeof x> => !!x),
              )
            : []
      for (const list of lists) {
        for (const top of list) {
          if (!top.subMatches) continue
          const idx = top.subMatches.findIndex((s) => s._id === m._id)
          if (idx === -1) continue
          // stageName above already includes "Team Match {n}" — drop
          // the leading "Team Match N - " here so it isn't duplicated.
          const full = getTeamSubMatchTitle(top, idx)
          const dash = full.indexOf(' - ')
          return dash === -1 ? full : full.slice(dash + 3)
        }
      }
    }
    return undefined
  }
  // Completed games come from the client-side gameHistory (which is
  // pushed to immediately when a game ends and survives until the
  // match is reset). The current game row is sourced from
  // gamePlayState.score1/score2 so it updates live on every "+"/"-"
  // tap — the saved match.games[currentGameIndex] only reflects the
  // committed final score.
  const visibleGames = (): {
    score1: number
    score2: number
    winningSide?: 1 | 2
  }[] => {
    const finished = gamePlayState.gameHistory.map((g) => ({
      score1: g.score1,
      score2: g.score2,
      winningSide: g.winningSide,
    }))
    const current = {
      score1: gamePlayState.score1,
      score2: gamePlayState.score2,
      winningSide: undefined,
    }
    return [...finished, current]
  }

  // Side to highlight in a row: the confirmed winner for finished
  // games, or the leading side for the in-progress game (undefined
  // when tied).
  const highlightSide = (g: {
    score1: number
    score2: number
    winningSide?: 1 | 2
  }): 1 | 2 | undefined => {
    if (g.winningSide) return g.winningSide
    if (g.score1 > g.score2) return 1
    if (g.score2 > g.score1) return 2
    return undefined
  }
  // The umpire's left is the phone screen's right (mirrored view —
  // matches scoreBoxesContainerStyle's row-reverse). Map gamePlayState
  // .leftSide (umpire's left) to the visually-right column accordingly.
  const leftRightScores = (game: { score1: number; score2: number }) => {
    const leftSideOnScreen = gamePlayState.leftSide === 1 ? 2 : 1
    const left = leftSideOnScreen === 1 ? game.score1 : game.score2
    const right = leftSideOnScreen === 1 ? game.score2 : game.score1
    return { left, right }
  }

  return (
    <Show when={event()}>
      <div style={landscapeInfoBoxStyle}>
        <Show when={tableNumber()}>
          <div style={landscapeTableNumberStyle}>{tableNumber()}</div>
        </Show>
        <div style={landscapeEventNameStyle}>{event()!.eventName}</div>
        <div style={landscapeStageNameStyle}>{stageName()}</div>
        <Show when={subMatchLabel()}>
          <div style={landscapeSubMatchStyle}>{subMatchLabel()}</div>
        </Show>
        <div style={landscapeGameInfoStyle}>
          Game {currentGameIndex() + 1} / {numberOfGames()}
        </div>
        <Show when={visibleGames().length > 0}>
          <div style={landscapeGameScoresStyle}>
            <For each={visibleGames()}>
              {(g) => {
                // Wrap in accessors so leftSide changes (switch-side)
                // flow through to the previous-game rows in the
                // info box — plain `const lr = …` captured the
                // value at row-creation time and stayed stale.
                const lr = () => leftRightScores(g)
                const hSide = () => highlightSide(g)
                const leftSideOnScreen = () =>
                  gamePlayState.leftSide === 1 ? 2 : 1
                const leftHighlight = () => hSide() === leftSideOnScreen()
                const rightHighlight = () => hSide() != null && !leftHighlight()
                return (
                  <div style={landscapeGameScoreRowStyle}>
                    <span style={getLandscapeScoreNumStyle(leftHighlight())}>
                      {lr().left}
                    </span>
                    <span>:</span>
                    <span style={getLandscapeScoreNumStyle(rightHighlight())}>
                      {lr().right}
                    </span>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </div>
    </Show>
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
      // Reserve roughly three lines + top padding for the participant
      // names that now live inside the point box.
      const namesReserve = 80

      const availableWidth = boxWidth - padding * 2
      const availableHeight = boxHeight - padding * 2 - namesReserve

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
          <ParticipantNames side={props.side} />
          <div style={pointBoxScoreWrapStyle}>
            <div style={getScoreDisplayStyle(fontSize(), isWinner())}>
              {score()}
            </div>
          </div>
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
  const lines = () => gamePlayActions.getParticipantNameLines(props.side)
  const isLandscape = createIsLandscape()
  // Extra breathing room above the names in portrait so they don't
  // crowd the "+" button. Landscape keeps the tighter spacing.
  const containerStyle = (): JSX.CSSProperties =>
    isLandscape()
      ? participantNamesStyle
      : { ...participantNamesStyle, 'padding-top': '24px' }
  return (
    <div style={containerStyle()}>
      <div style={participantNamesInnerStyle}>
        <For each={lines()}>
          {(name) => <div>{name}</div>}
        </For>
      </div>
    </div>
  )
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
    const eventId = gamePlayState.eventId
    await gamePlayActions.confirmFinishMatch()
    eventDetailActions.invalidateData()
    // Tablet stays on the table — the live-score effect detects the
    // finished match coming off the table and handles the transition
    // generally (clear → no-match-assigned → load next).
    if (authState.isTablet) return
    navigate(`/event/${eventId}`)
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

// Full-page Init Screen — replaces the score boxes until the umpire
// picks who serves first and who's on their left. Icons start in
// gray-scale and turn color when selected; Start is gated on both
// picks being made.
const InitScreen = () => {
  const [serveChoice, setServeChoice] = createSignal<1 | 2 | null>(null)
  const [leftChoice, setLeftChoice] = createSignal<1 | 2 | null>(null)
  const isLandscape = createIsLandscape()

  const event = () => gamePlayState.data
  // Plain stage name — the team sub-match qualifier moved out to the
  // participants line per spec.
  const stageName = () => gamePlayActions.getStageName()
  const participant1Name = () => gamePlayActions.getParticipantName(1)
  const participant2Name = () => gamePlayActions.getParticipantName(2)

  // Participants line shown below the stage name:
  //   - singles:               "{name1} vs {name2}"
  //   - doubles:               "{name1A}/{name1B} vs {name2A}/{name2B}"
  //   - team parent:           same as doubles, but the team rosters
  //   - team sub-match:        "Team Match {n} - {A} vs {X}"
  // getParticipantName already joins doubles names with " / ", so we
  // reuse it for singles/doubles/team-parent and only switch to
  // getTeamSubMatchTitle for team sub-matches.
  const participants = (): string => {
    const m = gamePlayActions.getCurrentMatch()
    if (m && m.parentMatchId) {
      const title = teamSubMatchTitle()
      if (title) return title
    }
    return `${participant1Name()} vs ${participant2Name()}`
  }

  const teamSubMatchTitle = (): string | undefined => {
    const m = gamePlayActions.getCurrentMatch()
    if (!m || !m.parentMatchId) return undefined
    const ev = event()
    if (!ev) return undefined
    for (const stage of ev.eventStages || []) {
      const lists =
        stage.type === 'group'
          ? stage.groups.map((g) => g.matches)
          : stage.type === 'knockout'
            ? stage.rounds.map((r) =>
                r.matches
                  .map((km) => km.match)
                  .filter((x): x is NonNullable<typeof x> => !!x),
              )
            : []
      for (const list of lists) {
        for (const top of list) {
          if (!top.subMatches) continue
          const idx = top.subMatches.findIndex((s) => s._id === m._id)
          if (idx === -1) continue
          return getTeamSubMatchTitle(top, idx)
        }
      }
    }
    return undefined
  }

  const handleServeClick = (side: 1 | 2) => () => setServeChoice(side)
  const handleLeftClick = (side: 1 | 2) => () => {
    setLeftChoice(side)
    // Live-preview: update the global leftSide so when Start is
    // pressed the score boxes already show the right orientation.
    gamePlayActions.setLeftSide(side)
  }

  const canStart = () => serveChoice() != null && leftChoice() != null

  const handleStart = () => {
    if (!canStart()) return
    gamePlayActions.setInitialServingSide(serveChoice()!)
    gamePlayActions.setLeftSide(leftChoice()!)
    gamePlayActions.confirmInitDialog()
  }

  return (
    <div style={initScreenStyle}>
      <div style={initHeaderStyle}>
        <div style={initEventNameStyle}>{event()?.eventName}</div>
        <div style={initStageNameStyle}>{stageName()}</div>
        <div style={initParticipantsStyle}>{participants()}</div>
      </div>
      <Show
        when={gamePlayActions.isTeamMatch()}
        fallback={
          <RegularInitBody
            serveChoice={serveChoice()}
            leftChoice={leftChoice()}
            onServeClick={handleServeClick}
            onLeftClick={handleLeftClick}
            participant1Name={participant1Name()}
            participant2Name={participant2Name()}
            canStart={canStart()}
            onStart={handleStart}
            landscape={isLandscape()}
          />
        }
      >
        <TeamInitBody landscape={isLandscape()} />
      </Show>
    </div>
  )
}

const RegularInitBody = (props: {
  serveChoice: 1 | 2 | null
  leftChoice: 1 | 2 | null
  onServeClick: (side: 1 | 2) => () => void
  onLeftClick: (side: 1 | 2) => () => void
  participant1Name: string
  participant2Name: string
  canStart: boolean
  onStart: () => void
  landscape: boolean
}) => (
  <>
    <div style={initColumnsStyle}>
      <div style={initColumnStyle}>
        <div style={initColPlaceholderStyle} />
        <div style={initRowLabelStyle}>{props.participant1Name}</div>
        <div style={initRowLabelStyle}>{props.participant2Name}</div>
      </div>
      <div style={initColumnStyle}>
        <div style={initColHeaderStyle}>Serve First</div>
        <InitIcon
          src={serveIconUrl}
          active={props.serveChoice === 1}
          onClick={props.onServeClick(1)}
          alt="Serve first"
        />
        <InitIcon
          src={serveIconUrl}
          active={props.serveChoice === 2}
          onClick={props.onServeClick(2)}
          alt="Serve first"
        />
      </div>
      <div style={initColumnStyle}>
        <div style={initColHeaderStyle}>Umpire's Left</div>
        <InitIcon
          src={tableIconUrl}
          active={props.leftChoice === 1}
          onClick={props.onLeftClick(1)}
          alt="Umpire's left"
        />
        <InitIcon
          src={tableIconUrl}
          active={props.leftChoice === 2}
          onClick={props.onLeftClick(2)}
          alt="Umpire's left"
        />
      </div>
    </div>
    <div style={initButtonSpacerStyle} />
    <button
      style={initStartButtonStyle(props.canStart, props.landscape)}
      disabled={!props.canStart}
      onClick={props.onStart}
    >
      Start
    </button>
  </>
)

// Team-parent init setup. Top: format list (lineup). Below: order
// section, one row per slot showing the home player slot, the A
// label, the X label, and the away player slot. Tapping "Select…"
// opens a player picker for that side; picking a player drops them
// into the slot and clears them from any other slot they were in.
// "Set Order" at the bottom commits both side orders to the DB.
const HOME_LABELS = ['A', 'B', 'C', 'D'] as const
const AWAY_LABELS = ['X', 'Y', 'Z', 'W'] as const

interface PickerState {
  side: 'home' | 'away'
  slotIndex: number
}

const TeamInitBody = (props: { landscape: boolean }) => {
  const match = () => gamePlayActions.getCurrentMatch()
  const homeSideNum = (): 1 | 2 => (match()?.homeSide === 2 ? 2 : 1)
  const awaySideNum = (): 1 | 2 => (homeSideNum() === 1 ? 2 : 1)
  const homePlayers = (): Player[] =>
    homeSideNum() === 1 ? match()?.side1 || [] : match()?.side2 || []
  const awayPlayers = (): Player[] =>
    awaySideNum() === 1 ? match()?.side1 || [] : match()?.side2 || []
  const nop = () => homePlayers().length
  const teamType = (): keyof typeof TEAM_SUB_MATCH_LABELS | undefined => {
    const m = match()
    if (!m) return undefined
    return (
      (m.teamMatchType as keyof typeof TEAM_SUB_MATCH_LABELS | undefined) ||
      deriveTeamMatchType(m)
    )
  }
  const lineup = () => {
    const t = teamType()
    return t ? TEAM_SUB_MATCH_LABELS[t] || [] : []
  }

  // homeSlots[i] / awaySlots[i] hold the playerId in slot i (label
  // HOME_LABELS[i] / AWAY_LABELS[i]). Empty string = unassigned.
  const [homeSlots, setHomeSlots] = createSignal<string[]>([])
  const [awaySlots, setAwaySlots] = createSignal<string[]>([])
  const [picker, setPicker] = createSignal<PickerState | null>(null)

  createEffect(() => {
    setHomeSlots(new Array<string>(nop()).fill(''))
    setAwaySlots(new Array<string>(nop()).fill(''))
  })

  const labelFor = (side: 'home' | 'away', i: number) =>
    side === 'home' ? HOME_LABELS[i] : AWAY_LABELS[i]

  const playerById = (
    players: Player[],
    id: string,
  ): Player | undefined => players.find((p) => p._id === id)

  const slotLabel = (side: 'home' | 'away', i: number): string => {
    const slots = side === 'home' ? homeSlots() : awaySlots()
    const players = side === 'home' ? homePlayers() : awayPlayers()
    const id = slots[i]
    if (!id) return 'Select…'
    const p = playerById(players, id)
    return p ? `${p.firstName} ${p.lastName}` : 'Select…'
  }

  // Pick a player into the open slot. If they were already in
  // another slot on that side, swap (put the previous occupant
  // of this slot into the slot the picked player came from), so
  // the order remains a permutation. After the pick, if exactly
  // one slot remains empty AND exactly one player is unassigned,
  // auto-fill it — so picking A on a 2-player team auto-fills B,
  // and finishing the second pick on a 3-player team auto-fills C.
  const handlePick = (playerId: string) => {
    const p = picker()
    if (!p) return
    const getSlots = p.side === 'home' ? homeSlots : awaySlots
    const setSlots = p.side === 'home' ? setHomeSlots : setAwaySlots
    const players = p.side === 'home' ? homePlayers() : awayPlayers()
    const cur = [...getSlots()]
    const prevOccupant = cur[p.slotIndex]
    const existingIdx = cur.indexOf(playerId)
    cur[p.slotIndex] = playerId
    if (existingIdx >= 0 && existingIdx !== p.slotIndex) {
      cur[existingIdx] = prevOccupant
    }
    const emptyIndices = cur
      .map((id, i) => (id ? -1 : i))
      .filter((i) => i >= 0)
    const assigned = new Set(cur.filter(Boolean))
    const unassigned = players.filter((pl) => !assigned.has(pl._id))
    if (emptyIndices.length === 1 && unassigned.length === 1) {
      cur[emptyIndices[0]] = unassigned[0]._id
    }
    setSlots(cur)
    setPicker(null)
  }

  const allFilled = () =>
    homeSlots().every(Boolean) && awaySlots().every(Boolean)

  const handleSetOrder = async () => {
    if (!allFilled()) return
    await gamePlayActions.saveTeamSideAssignment(homeSideNum(), homeSlots())
    await gamePlayActions.saveTeamSideAssignment(awaySideNum(), awaySlots())
  }

  return (
    <>
      {/* Format on the left (vertically centered) + Order section on
          the right. */}
      <div style={teamInitMainStyle}>
        <div style={teamInitFormatBlockStyle}>
          <For each={lineup()}>
            {(e) => (
              <div style={teamInitFormatRowStyle}>
                {e.home} vs {e.away}
              </div>
            )}
          </For>
        </div>

        <div style={teamInitOrderBlockStyle}>
          <For each={Array.from({ length: nop() }, (_, i) => i)}>
            {(i) => (
              <div style={teamInitOrderRowStyle}>
                <button
                  type="button"
                  style={teamInitSlotStyle(!!homeSlots()[i])}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setPicker({ side: 'home', slotIndex: i })
                  }}
                >
                  {slotLabel('home', i)}
                </button>
                <div style={teamInitLabelChipStyle}>{labelFor('home', i)}</div>
                <div style={teamInitLabelChipStyle}>{labelFor('away', i)}</div>
                <button
                  type="button"
                  style={teamInitSlotStyle(!!awaySlots()[i])}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    setPicker({ side: 'away', slotIndex: i })
                  }}
                >
                  {slotLabel('away', i)}
                </button>
              </div>
            )}
          </For>
        </div>
      </div>

      <div style={initButtonSpacerStyle} />
      <button
        style={initStartButtonStyle(allFilled(), props.landscape)}
        disabled={!allFilled()}
        onClick={() => void handleSetOrder()}
      >
        Set Order
      </button>

      <Show when={picker()}>
        {(p) => (
          <TeamPlayerPickerDialog
            players={
              p().side === 'home' ? homePlayers() : awayPlayers()
            }
            label={labelFor(p().side, p().slotIndex)}
            onPick={handlePick}
            onClose={() => setPicker(null)}
          />
        )}
      </Show>
    </>
  )
}

const TeamPlayerPickerDialog = (props: {
  players: Player[]
  label: string
  onPick: (id: string) => void
  onClose: () => void
}) => (
  <div
    style={teamInitPickerOverlayStyle}
    onClick={(e) => {
      e.stopPropagation()
      e.preventDefault()
      props.onClose()
    }}
  >
    <div
      style={teamInitPickerDialogStyle}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={teamInitPickerTitleStyle}>Select Player {props.label}</div>
      <div style={teamInitPickerListStyle}>
        <For each={props.players}>
          {(p) => (
            <button
              type="button"
              style={teamInitPickerItemStyle}
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                props.onPick(p._id)
              }}
            >
              {p.firstName} {p.lastName}
            </button>
          )}
        </For>
      </div>
    </div>
  </div>
)

const InitIcon = (props: {
  src: string
  active: boolean
  alt: string
  onClick: () => void
}) => (
  <button
    style={initIconButtonStyle(props.active)}
    onClick={props.onClick}
    aria-pressed={props.active}
  >
    <img src={props.src} alt={props.alt} style={initIconImgStyle(props.active)} />
  </button>
)

// ==================== Team Init styles ====================

const teamInitMainStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'align-items': 'center',
  gap: '24px',
  flex: 1,
}

const teamInitFormatBlockStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  'justify-content': 'center',
  gap: '6px',
  'flex-shrink': 0,
}

const teamInitFormatRowStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: 'rgba(255,255,255,0.85)',
}

const teamInitOrderBlockStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
  flex: 1,
  'min-width': 0,
}

const teamInitOrderRowStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': '1fr 44px 44px 1fr',
  'align-items': 'center',
  gap: '12px',
}

const teamInitSlotStyle = (filled: boolean): JSX.CSSProperties => ({
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'min-height': '48px',
  padding: '8px 12px',
  'font-size': '15px',
  'font-weight': 600,
  color: filled ? '#fff' : 'rgba(255,255,255,0.6)',
  background: filled ? 'rgba(255,255,255,0.08)' : 'transparent',
  border: '2px dashed rgba(255,255,255,0.35)',
  'border-radius': '10px',
  cursor: 'pointer',
  'word-break': 'break-word',
  'text-align': 'center',
})

const teamInitLabelChipStyle: JSX.CSSProperties = {
  width: '44px',
  height: '44px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'font-size': '20px',
  'font-weight': 800,
  color: '#1a1a2e',
  'background-color': '#f1c40f',
  'border-radius': '8px',
  'user-select': 'none',
}

const teamInitPickerOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.55)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '2000',
  padding: '16px',
}

const teamInitPickerDialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px 24px',
  width: '100%',
  'max-width': 'min(420px, 90vw)',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const teamInitPickerTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
  'margin-bottom': '4px',
}

const teamInitPickerListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'max-height': '60vh',
  'overflow-y': 'auto',
}

const teamInitPickerItemStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  padding: '12px 14px',
  'font-size': '15px',
  'font-weight': 600,
  color: '#333',
  background: '#f8f9fa',
  border: '1px solid #ddd',
  'border-radius': '8px',
  cursor: 'pointer',
  'text-align': 'left',
}

// Styles
// ==================== Init Screen styles ====================

const initScreenStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'flex-direction': 'column',
  padding: '24px',
  color: '#fff',
}

const initHeaderStyle: JSX.CSSProperties = {
  'text-align': 'left',
}

const initEventNameStyle: JSX.CSSProperties = {
  'font-size': '22px',
  'font-weight': 700,
  color: '#fff',
}

const initStageNameStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: 'rgba(255,255,255,0.7)',
  'margin-top': '4px',
}

const initParticipantsStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: 'rgba(255,255,255,0.9)',
  'margin-top': '4px',
}

// Outer row holding the three vertical columns. Centered both
// horizontally (justify-content) and vertically (align-items, since
// flex-direction: row puts the cross axis on the vertical side).
const initColumnsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '32px',
  flex: 1,
}

// Each column stacks top-to-bottom with consistent row spacing.
const initColumnStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '20px',
}

// Placeholder cell at the top of column 1 so the participant names
// line up vertically with the icons in columns 2 and 3.
const initColPlaceholderStyle: JSX.CSSProperties = {
  height: '20px',
}

const initColHeaderStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 600,
  color: 'rgba(255,255,255,0.8)',
  height: '20px',
  display: 'flex',
  'align-items': 'center',
}

const initRowLabelStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#fff',
  display: 'flex',
  'align-items': 'center',
  'min-height': '80px', // matches icon button height so rows align
}

const initIconButtonStyle = (active: boolean): JSX.CSSProperties => ({
  background: 'transparent',
  border: 'none',
  padding: '8px',
  cursor: 'pointer',
  'border-radius': '12px',
  outline: active ? '3px solid #f1c40f' : '3px solid transparent',
  transition: 'outline-color 0.15s ease',
})

const initIconImgStyle = (active: boolean): JSX.CSSProperties => ({
  width: '64px',
  height: '64px',
  filter: active ? 'none' : 'grayscale(1)',
  opacity: active ? 1 : 0.55,
  transition: 'filter 0.15s ease, opacity 0.15s ease',
})

const initButtonSpacerStyle: JSX.CSSProperties = {
  flex: '0 0 24px',
  width: '100%',
}

const initStartButtonStyle = (
  enabled: boolean,
  landscape = false,
): JSX.CSSProperties => ({
  // Landscape: extend the button past the InitScreen's 24px wrapper
  // padding so it spans the whole screen edge-to-edge. width: 100%
  // alone would only fill the parent's content area; adding 48px
  // compensates for the two side paddings.
  width: landscape ? 'calc(100% + 48px)' : '100%',
  padding: '16px',
  'font-size': '20px',
  'font-weight': 700,
  color: '#fff',
  border: 'none',
  'border-radius': landscape ? '0' : '12px',
  margin: landscape ? '0 -24px -24px' : '0',
  background: enabled ? '#27ae60' : '#555',
  cursor: enabled ? 'pointer' : 'not-allowed',
})

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
  // No side/bottom padding so the score boxes can run flush to the
  // screen edges; the header still gets a touch of top padding so it
  // doesn't sit on the status bar.
  padding: '8px 0 0',
  'min-height': 0,
}

const wideHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  padding: '0 16px',
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
  padding: '0 16px',
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

// Transparent backdrop — sits between the two score boxes. Keeps the
// live-score table palette for the text (yellow table number, white
// text on the dark page background) but no card/box around it.
const landscapeInfoBoxStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '6px',
  flex: '0 0 auto',
  'min-width': '160px',
  padding: '12px 16px',
  'text-align': 'center',
  'background-color': 'transparent',
}

const landscapeTableNumberStyle: JSX.CSSProperties = {
  'font-size': '96px',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1,
}

const landscapeEventNameStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 600,
  color: '#fff',
}

const landscapeStageNameStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 500,
  color: 'rgba(255,255,255,0.8)',
}

const landscapeSubMatchStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 500,
  color: 'rgba(255,255,255,0.8)',
}

const landscapeGameInfoStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#fff',
}

const landscapeGameScoresStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '4px',
  'margin-top': '10px',
}

const landscapeGameScoreRowStyle: JSX.CSSProperties = {
  'font-size': '18px',
  color: 'rgba(255,255,255,0.85)',
  'font-variant-numeric': 'tabular-nums',
}

const getLandscapeScoreNumStyle = (highlight: boolean): JSX.CSSProperties => ({
  color: highlight ? '#f1c40f' : 'inherit',
  'font-weight': highlight ? 700 : 'inherit',
})

const scoreBoxesContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row-reverse',
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

// Outer wrapper just owns the top padding; the inner block has a
// fixed height so the score below stays at the same Y on both sides.
const participantNamesStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'center',
  'word-break': 'break-word',
  width: '100%',
  padding: '10px 8px 0',
  display: 'flex',
  'justify-content': 'center',
  'line-height': 1.3,
  'box-sizing': 'border-box',
  'flex': '0 0 auto',
}

// Fixed-height name area, bottom-anchored, overflow clipped — same
// height on both sides regardless of player count or wrapping, which
// keeps the big score number vertically aligned across the two boxes.
const participantNamesInnerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '2px',
  width: '100%',
  height: '3.9em',
  overflow: 'hidden',
}

const getPlusButtonStyle = (isServing: boolean, isGameOver: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '0',
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
  'flex-direction': 'column',
  'align-items': 'stretch',
  cursor: isGameOver ? 'default' : 'pointer',
  overflow: 'hidden',
  'min-height': 0,
})

const pointBoxScoreWrapStyle: JSX.CSSProperties = {
  flex: 1,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'min-height': 0,
  width: '100%',
}

const getScoreDisplayStyle = (fontSize: number, isWinner: boolean): JSX.CSSProperties => ({
  'font-size': `${fontSize}px`,
  'font-weight': 700,
  color: isWinner ? '#ffd700' : '#fff',
  'line-height': 1,
})

const getMinusButtonStyle = (isServing: boolean, isDisabled: boolean): JSX.CSSProperties => ({
  width: '100%',
  height: '60px',
  'border-radius': '0',
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
  'border-radius': '0',
  border: 'none',
  'background-color': '#27ae60',
  color: '#fff',
  'font-size': '24px',
  'font-weight': 700,
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
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
