import {
  onMount,
  onCleanup,
  createSignal,
  Show,
  For,
  type JSX,
} from 'solid-js'
import { liveScoreState, liveScoreActions } from '../stores/liveScoreStore'
import { authState } from '../stores/authStore'
import ToggleButton from '../components/ToggleButton'
import type { TableAssignment, MatchQueueItem } from '../../shared/types/Table'
import type { Player } from '../../shared/types/Player'
import type { Game, Match } from '../../shared/types/Match'
import { getProvisionalMatchResult } from '../../shared/rules/matchRules'
import {
  getTeamSubMatchTitle,
  getTeamPlayerOrderLabel,
} from './EventDetail'

const LiveScore = () => {
  onMount(() => {
    liveScoreActions.fetchLiveScore()
  })

  onCleanup(() => {
    liveScoreActions.reset()
  })

  return (
    <div style={pageContainerStyle}>
      <Show
        when={!liveScoreState.loading || liveScoreState.tables.length > 0}
        fallback={<LoadingIndicator />}
      >
        <LiveScoreLayout />
      </Show>
    </div>
  )
}

const LoadingIndicator = () => (
  <div style={loadingStyle}>Loading live scores...</div>
)

// ==================== LAYOUT ====================

const LiveScoreLayout = () => {
  const isWide = createIsWideScreen()

  return (
    <Show when={isWide()} fallback={<MobileLayout />}>
      <DesktopLayout />
    </Show>
  )
}

const DesktopLayout = () => (
  <div style={desktopLayoutStyle}>
    <div style={tablesGridDesktopStyle}>
      <TableRow tables={[5, 6, 7, 8]} />
      <TableRow tables={[1, 2, 3, 4]} />
    </div>
    <div class="hide-scrollbar" style={matchQueueDesktopStyle}>
      <MatchQueue />
    </div>
  </div>
)

const MobileLayout = () => {
  const [queueExpanded, setQueueExpanded] = createSignal(false)
  const [canScrollLeft, setCanScrollLeft] = createSignal(false)
  const [canScrollRight, setCanScrollRight] = createSignal(false)
  let scrollRef: HTMLDivElement | undefined
  let touchStartX = 0
  let touchStartY = 0

  const updateScrollState = () => {
    if (!scrollRef) return
    setCanScrollLeft(scrollRef.scrollLeft > 0)
    setCanScrollRight(
      scrollRef.scrollLeft + scrollRef.clientWidth < scrollRef.scrollWidth - 1,
    )
  }

  const isInsideQueueBody = (target: EventTarget | null): boolean =>
    target instanceof Element && !!target.closest('[data-queue-body]')

  const scrollToEdge = (dir: 1 | -1) => {
    if (!scrollRef) return
    scrollRef.scrollTo({
      left: dir === -1 ? 0 : scrollRef.scrollWidth,
      behavior: 'smooth',
    })
  }

  const handleTouchStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    touchStartX = t.clientX
    touchStartY = t.clientY
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const t = e.changedTouches[0]
    if (!t) return
    if (isInsideQueueBody(e.target)) return
    const dy = touchStartY - t.clientY
    const dx = Math.abs(t.clientX - touchStartX)
    const SWIPE_THRESHOLD = 60
    if (Math.abs(dy) < SWIPE_THRESHOLD || dx > Math.abs(dy)) return
    if (dy > 0 && !queueExpanded()) setQueueExpanded(true)
    else if (dy < 0 && queueExpanded()) setQueueExpanded(false)
  }

  onMount(() => {
    updateScrollState()
    window.addEventListener('resize', updateScrollState)
  })

  onCleanup(() => {
    window.removeEventListener('resize', updateScrollState)
  })

  return (
    <div
      style={mobileLayoutStyle}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div style={tablesScrollWrapperStyle}>
        <div
          ref={scrollRef}
          class="hide-scrollbar"
          style={tablesScrollContainerStyle}
          onScroll={updateScrollState}
        >
          <div style={tablesGridMobileStyle}>
            <TableRow tables={[5, 6]} isMobile />
            <TableRow tables={[1, 2]} isMobile />
          </div>
          <div style={tablesGridMobileStyle}>
            <TableRow tables={[7, 8]} isMobile />
            <TableRow tables={[3, 4]} isMobile />
          </div>
        </div>
        <Show when={canScrollLeft()}>
          <div
            style={scrollIndicatorLeftStyle}
            onClick={() => scrollToEdge(-1)}
          >
            ‹
          </div>
        </Show>
        <Show when={canScrollRight()}>
          <div
            style={scrollIndicatorRightStyle}
            onClick={() => scrollToEdge(1)}
          >
            ›
          </div>
        </Show>
      </div>
      <MatchQueueSheet
        expanded={queueExpanded()}
        onToggle={() => setQueueExpanded(!queueExpanded())}
      />
    </div>
  )
}

const MatchQueueSheet = (props: {
  expanded: boolean
  onToggle: () => void
}) => (
  <div style={matchQueueSheetStyle(props.expanded)}>
    <div style={matchQueueSheetHandleStyle} onClick={props.onToggle}>
      <span>Match Queue</span>
      <span style={matchQueueChevronStyle}>
        {props.expanded ? '▾' : '▴'}
      </span>
    </div>
    <div
      class="hide-scrollbar"
      style={matchQueueSheetBodyStyle}
      data-queue-body
    >
      <MatchQueue isMobile />
    </div>
  </div>
)

// ==================== TABLE COMPONENTS ====================

interface TableRowProps {
  tables: number[]
  isMobile?: boolean
}

const TableRow = (props: TableRowProps) => (
  <div style={getTableRowStyle(props.tables.length)}>
    <For each={props.tables}>
      {(tableNum) => {
        const table = () => liveScoreActions.getTable(tableNum)
        return (
          <TableCell
            table={table()}
            tableNumber={tableNum}
            isMobile={props.isMobile}
          />
        )
      }}
    </For>
  </div>
)

interface TableCellProps {
  table?: TableAssignment
  tableNumber: number
  isMobile?: boolean
}

const TableCell = (props: TableCellProps) => {
  const isAssigned = () => props.table?.status === 'assigned'
  const matchItem = () => props.table?.match
  const matchStatus = () => matchItem()?.matchStatus

  return (
    <Show when={isAssigned()} fallback={<AvailableTable tableNumber={props.tableNumber} />}>
      <AssignedTable
        tableNumber={props.tableNumber}
        matchItem={matchItem()!}
        matchStatus={matchStatus()!}
        isMobile={props.isMobile}
      />
    </Show>
  )
}

interface AvailableTableProps {
  tableNumber: number
}

const AvailableTable = (props: AvailableTableProps) => (
  <div style={availableTableStyle}>
    <div style={availableTableNumberStyle}>{props.tableNumber}</div>
  </div>
)

const POSTPONE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '5 Minutes', minutes: 5 },
  { label: '10 Minutes', minutes: 10 },
  { label: '30 Minutes', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
]

const PostponeDialog = (props: {
  onSelect: (minutes: number) => void
  onClose: () => void
}) => (
  <div style={postponeDialogOverlayStyle} onClick={props.onClose}>
    <div style={postponeDialogStyle} onClick={(e) => e.stopPropagation()}>
      <h3 style={postponeDialogTitleStyle}>Postpone Match</h3>
      <div style={postponeButtonsStyle}>
        <For each={POSTPONE_OPTIONS}>
          {(opt) => (
            <button
              type="button"
              style={postponeButtonStyle}
              onClick={() => props.onSelect(opt.minutes)}
            >
              {opt.label}
            </button>
          )}
        </For>
      </div>
      <button
        type="button"
        style={postponeCancelButtonStyle}
        onClick={props.onClose}
      >
        Cancel
      </button>
    </div>
  </div>
)

interface AssignedTableProps {
  tableNumber: number
  matchItem: MatchQueueItem
  matchStatus: string
  isMobile?: boolean
}

const AssignedTable = (props: AssignedTableProps) => {
  const isNotStarted = () => props.matchStatus === 'not_started'
  const isFinishedUnconfirmed = () =>
    props.matchStatus === 'finished_unconfirmed'
  const match = () => props.matchItem.match
  const side1Players = () => match()?.side1 || []
  const side2Players = () => match()?.side2 || []
  const bestOf = () => match()?.config?.numberOfGames
  const isInProgress = () => !isNotStarted()
  const provisional = () => {
    const m = match()
    if (!m) return { gamesWon1: 0, gamesWon2: 0, winningSide: undefined }
    return getProvisionalMatchResult(m)
  }
  const gamesWon1 = () => provisional().gamesWon1
  const gamesWon2 = () => provisional().gamesWon2
  const side1IsWinner = () => provisional().winningSide === 1
  const side2IsWinner = () => provisional().winningSide === 2
  const [showPostpone, setShowPostpone] = createSignal(false)
  const showActionButton = () => !!props.isMobile && authState.isAdmin
  const subMatchLabel = (): string | undefined => {
    const parent = props.matchItem.parent
    const idx = props.matchItem.subMatchIndex
    if (!parent || idx == null) return undefined
    return getTeamSubMatchTitle(parent, idx)
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this match and put it back at the end of the queue?')) {
      return
    }
    await liveScoreActions.cancelMatch(
      props.matchItem.eventId,
      props.matchItem.matchId,
    )
  }

  const handlePostpone = async (minutes: number) => {
    setShowPostpone(false)
    await liveScoreActions.postponeMatch(
      props.matchItem.eventId,
      props.matchItem.matchId,
      minutes,
    )
  }

  return (
    <div
      style={getAssignedTableStyle(
        isNotStarted(),
        isFinishedUnconfirmed(),
      )}
    >
      <div style={tableNumberAssignedStyle}>{props.tableNumber}</div>
      <div style={eventNameTableStyle}>{props.matchItem.eventName}</div>
      <div style={stageNameTableStyle}>{props.matchItem.stageName}</div>
      <Show when={subMatchLabel()}>
        {(label) => <div style={subMatchTableLabelStyle}>{label()}</div>}
      </Show>
      <Show when={bestOf()}>
        <div style={bestOfTableStyle}>Best of {bestOf()}</div>
      </Show>
      <div style={tableSpacer} />
      <TablePlayerDisplay
        players={side1Players()}
        gamesWon={gamesWon1()}
        showScore={isInProgress()}
        isWinner={side1IsWinner()}
        parent={props.matchItem.parent}
      />
      <TableScoreDisplay
        match={match()}
        isNotStarted={isNotStarted()}
      />
      <TablePlayerDisplay
        players={side2Players()}
        gamesWon={gamesWon2()}
        showScore={isInProgress()}
        isWinner={side2IsWinner()}
        parent={props.matchItem.parent}
      />
      <Show when={showActionButton()}>
        <Show
          when={isNotStarted()}
          fallback={
            <button style={tableCancelButtonStyle} onClick={handleCancel}>
              Cancel
            </button>
          }
        >
          <button
            style={tablePostponeButtonStyle}
            onClick={() => setShowPostpone(true)}
          >
            Postpone
          </button>
        </Show>
      </Show>
      <Show when={showPostpone()}>
        <PostponeDialog
          onSelect={handlePostpone}
          onClose={() => setShowPostpone(false)}
        />
      </Show>
    </div>
  )
}

interface TablePlayerDisplayProps {
  players: Player[]
  gamesWon: number
  showScore: boolean
  isWinner?: boolean
  parent?: Match
}

const TablePlayerDisplay = (props: TablePlayerDisplayProps) => {
  const display = () => formatPlayersForTable(props.players, props.parent)
  return (
    <div style={tablePlayerRowStyle}>
      <span
        style={props.isWinner ? tablePlayerWinnerStyle : tablePlayerStyle}
      >
        {display()}
      </span>
      <Show when={props.showScore}>
        <span
          style={
            props.isWinner ? gameScoreBadgeWinnerStyle : gameScoreBadgeStyle
          }
        >
          {props.gamesWon}
        </span>
      </Show>
    </div>
  )
}

const labelSuffix = (parent: Match | undefined, playerId: string | undefined): string => {
  const label = getTeamPlayerOrderLabel(parent, playerId)
  return label ? ` (${label})` : ''
}

const formatPlayersForTable = (players: Player[], parent?: Match): string => {
  if (!players || players.length === 0) return 'TBD'
  if (players.length === 1) {
    const p = players[0]
    return `${p.firstName} ${p.lastName}${labelSuffix(parent, p._id?.toString())}`
  }
  return players
    .map((p) => `${p.firstName}${labelSuffix(parent, p._id?.toString())}`)
    .join(' / ')
}

interface TableScoreDisplayProps {
  match?: MatchQueueItem['match']
  isNotStarted: boolean
}

const TableScoreDisplay = (props: TableScoreDisplayProps) => (
  <Show when={!props.isNotStarted} fallback={<div style={vsStyle}>vs</div>}>
    <div style={scoreContainerStyle}>
      <GameScores games={props.match?.games || []} />
    </div>
  </Show>
)

interface GameScoresProps {
  games: Game[]
}

const GameScores = (props: GameScoresProps) => (
  <Show
    when={props.games.length > 0}
    fallback={<div style={vsStyle}>vs</div>}
  >
    <div style={gameScoresRowStyle}>
      <For each={props.games}>
        {(game, index) => (
          <GameScoreItem
            game={game}
            isLatest={index() === props.games.length - 1}
          />
        )}
      </For>
    </div>
  </Show>
)

interface GameScoreItemProps {
  game: Game
  isLatest: boolean
}

const GameScoreItem = (props: GameScoreItemProps) => {
  const side1Won = () => props.game.winningSide === 1
  const side2Won = () => props.game.winningSide === 2
  const lastScoredSide = () => props.game.lastScoredSide

  return (
    <span style={gameScoreItemStyle}>
      <span
        style={getScoreNumberStyle(side1Won(), props.isLatest, lastScoredSide() === 1)}
      >
        {props.game.score1}
      </span>
      <span style={scoreColonStyle}>:</span>
      <span
        style={getScoreNumberStyle(side2Won(), props.isLatest, lastScoredSide() === 2)}
      >
        {props.game.score2}
      </span>
    </span>
  )
}

// ==================== MATCH QUEUE ====================

const MATCH_QUEUE_SCROLL_SPEED = 1
const MATCH_QUEUE_SCROLL_INTERVAL = 50

const useAutoScroll = (ref: () => HTMLDivElement | undefined) => {
  let intervalId: ReturnType<typeof setInterval> | undefined

  const startAutoScroll = () => {
    intervalId = setInterval(() => {
      const el = ref()
      if (!el) return
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if (atBottom) {
        el.scrollTop = 0
      } else {
        el.scrollTop += MATCH_QUEUE_SCROLL_SPEED
      }
    }, MATCH_QUEUE_SCROLL_INTERVAL)
  }

  const stopAutoScroll = () => {
    if (intervalId !== undefined) {
      clearInterval(intervalId)
      intervalId = undefined
    }
  }

  onMount(() => {
    startAutoScroll()
    onCleanup(stopAutoScroll)
  })
}

const MatchQueue = (props: { isMobile?: boolean }) => {
  let listRef: HTMLDivElement | undefined
  const [myMatchesOnly, setMyMatchesOnly] = createSignal(false)
  const showMyMatches = () => !!authState.user?._id && !authState.isAdmin
  const queue = () => {
    const all = liveScoreState.matchQueue
    if (!myMatchesOnly() || !showMyMatches()) return all
    const uid = authState.user!._id!.toString()
    return all.filter((it) => matchIncludesPlayer(it, uid))
  }

  if (!props.isMobile) {
    useAutoScroll(() => listRef)
  }

  return (
    <div style={matchQueueContainerStyle}>
      <div
        style={{
          ...matchQueueTitleRowStyle,
          'justify-content': showMyMatches() ? 'space-between' : 'center',
        }}
      >
        <div style={matchQueueTitleStyle}>Match Queue</div>
        <Show when={showMyMatches()}>
          <ToggleButton
            label="My Matches"
            value={myMatchesOnly()}
            onChange={setMyMatchesOnly}
          />
        </Show>
      </div>
      <Show
        when={queue().length > 0}
        fallback={<div style={emptyQueueStyle}>No matches in queue</div>}
      >
        <div ref={listRef} class="hide-scrollbar" style={matchQueueListStyle}>
          <For each={queue()}>
            {(item) => <MatchQueueRow item={item} isMobile={props.isMobile} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

const matchIncludesPlayer = (item: MatchQueueItem, uid: string): boolean => {
  const m = item.match
  if (!m) return false
  for (const p of m.side1 || []) {
    if (p._id?.toString() === uid) return true
  }
  for (const p of m.side2 || []) {
    if (p._id?.toString() === uid) return true
  }
  return false
}

interface MatchQueueRowProps {
  item: MatchQueueItem
  isMobile?: boolean
}

const MatchQueueRow = (props: MatchQueueRowProps) => {
  const match = () => props.item.match
  const m = (mobileStyle: JSX.CSSProperties): JSX.CSSProperties =>
    props.isMobile ? mobileStyle : {}

  return (
    <div style={{ ...queueRowStyle, ...m(queueRowMobileStyle) }}>
      <div style={{ ...queueEventNameStyle, ...m(queueEventNameMobileStyle) }}>
        {props.item.eventName}
      </div>
      <div style={{ ...queueStageStyle, ...m(queueStageMobileStyle) }}>
        {props.item.stageName}
      </div>
      <div style={{ ...queueMatchStyle, ...m(queueMatchMobileStyle) }}>
        <SidePlayersDisplay players={match()?.side1 || []} />
        <span style={{ ...queueVsStyle, ...m(queueVsMobileStyle) }}> vs </span>
        <SidePlayersDisplay players={match()?.side2 || []} />
      </div>
    </div>
  )
}

const SidePlayersDisplay = (props: { players: Player[] }) => {
  const tokens = () => formatPlayersTokens(props.players)
  return (
    <span>
      <For each={tokens()}>
        {(tok) => (
          <Show
            when={tok.isSeparator}
            fallback={
              <span
                style={
                  liveScoreActions.isPlayerOnTable(tok.playerId)
                    ? queuePlayerOnTableStyle
                    : queuePlayerStyle
                }
              >
                {tok.text}
              </span>
            }
          >
            <span style={queuePlayerStyle}>{tok.text}</span>
          </Show>
        )}
      </For>
    </span>
  )
}

interface PlayerToken {
  text: string
  isSeparator: boolean
  playerId?: string
}

const formatPlayersTokens = (players: Player[]): PlayerToken[] => {
  if (!players || players.length === 0) {
    return [{ text: 'TBD', isSeparator: false }]
  }
  if (players.length === 1) {
    const p = players[0]
    return [
      {
        text: `${p.firstName} ${p.lastName}`,
        isSeparator: false,
        playerId: p._id?.toString(),
      },
    ]
  }
  const out: PlayerToken[] = []
  players.forEach((p, i) => {
    if (i > 0) out.push({ text: '/', isSeparator: true })
    out.push({
      text: p.firstName,
      isSeparator: false,
      playerId: p._id?.toString(),
    })
  })
  return out
}

// ==================== HELPERS ====================

const createIsWideScreen = () => {
  const [isWide, setIsWide] = createSignal(window.innerWidth > 768)

  onMount(() => {
    const handleResize = () => setIsWide(window.innerWidth > 768)
    window.addEventListener('resize', handleResize)
    onCleanup(() => window.removeEventListener('resize', handleResize))
  })

  return isWide
}

// ==================== STYLES ====================

const pageContainerStyle: JSX.CSSProperties = {
  height: '100dvh',
  'background-color': '#1a1a2e',
  display: 'flex',
  'flex-direction': 'column',
  overflow: 'hidden',
}

const loadingStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  height: '100%',
  color: '#fff',
  'font-size': '24px',
}

// Desktop layout
const desktopLayoutStyle: JSX.CSSProperties = {
  display: 'flex',
  flex: 1,
  gap: '8px',
  padding: '8px',
  'min-height': 0,
}

const tablesGridDesktopStyle: JSX.CSSProperties = {
  flex: 3,
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'min-height': 0,
}

const matchQueueDesktopStyle: JSX.CSSProperties = {
  flex: 1,
  'min-width': '280px',
  'max-width': '350px',
  'min-height': 0,
  'overflow-y': 'auto',
}

// Mobile layout
const mobileLayoutStyle: JSX.CSSProperties = {
  position: 'relative',
  display: 'flex',
  'flex-direction': 'column',
  flex: 1,
  padding: '8px',
  'padding-bottom': '64px',
  gap: '8px',
  'min-height': 0,
}

const tablesScrollWrapperStyle: JSX.CSSProperties = {
  position: 'relative',
  flex: 1,
  'min-height': 0,
}

const tablesScrollContainerStyle: JSX.CSSProperties = {
  height: '100%',
  display: 'flex',
  'overflow-x': 'auto',
  '-webkit-overflow-scrolling': 'touch',
  'scroll-snap-type': 'x mandatory',
  gap: '8px',
  'min-height': 0,
}

const scrollIndicatorBaseStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: '32px',
  height: '32px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'background-color': 'rgba(0, 0, 0, 0.18)',
  color: '#fff',
  'font-size': '24px',
  'font-weight': 700,
  'border-radius': '50%',
  cursor: 'pointer',
  'user-select': 'none',
  'z-index': 2,
}

const scrollIndicatorLeftStyle: JSX.CSSProperties = {
  ...scrollIndicatorBaseStyle,
  left: '4px',
}

const scrollIndicatorRightStyle: JSX.CSSProperties = {
  ...scrollIndicatorBaseStyle,
  right: '4px',
}

const tablesGridMobileStyle: JSX.CSSProperties = {
  'min-width': '100%',
  flex: '0 0 100%',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'scroll-snap-align': 'start',
  'min-height': 0,
}

const matchQueueSheetStyle = (expanded: boolean): JSX.CSSProperties => ({
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  'flex-direction': 'column',
  height: expanded ? '90vh' : '56px',
  'background-color': '#fff',
  'box-shadow': '0 -4px 12px rgba(0, 0, 0, 0.15)',
  'border-top-left-radius': '12px',
  'border-top-right-radius': '12px',
  transition: 'height 0.3s ease',
  'z-index': 5,
  overflow: 'hidden',
})

const matchQueueSheetHandleStyle: JSX.CSSProperties = {
  flex: '0 0 56px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '0 20px',
  cursor: 'pointer',
  'font-size': '18px',
  'font-weight': 700,
  'background-color': '#f8f9fa',
  'border-bottom': '1px solid #eee',
  'user-select': 'none',
}

const matchQueueChevronStyle: JSX.CSSProperties = {
  'font-size': '36px',
  'line-height': 1,
}

const matchQueueSheetBodyStyle: JSX.CSSProperties = {
  flex: 1,
  'min-height': 0,
  'overflow-y': 'auto',
}

// Table row
const getTableRowStyle = (columns: number): JSX.CSSProperties => ({
  display: 'grid',
  'grid-template-columns': `repeat(${columns}, 1fr)`,
  gap: '8px',
  flex: 1,
  'min-height': 0,
})

// Available table
const availableTableStyle: JSX.CSSProperties = {
  'min-width': 0,
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'background-color': '#27ae60',
  'border-radius': '12px',
  'min-height': 0,
  overflow: 'hidden',
}

const availableTableNumberStyle: JSX.CSSProperties = {
  'font-size': '72px',
  'font-weight': 900,
  color: '#f1c40f',
  'text-shadow': '2px 2px 4px rgba(0,0,0,0.3)',
}

// Assigned table
const getAssignedTableStyle = (
  isNotStarted: boolean,
  isFinishedUnconfirmed: boolean,
): JSX.CSSProperties => {
  const flashes = isNotStarted || isFinishedUnconfirmed
  return {
    'min-width': 0,
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'justify-content': 'center',
    gap: '2px',
    padding: '8px',
    'border-radius': '12px',
    'background-color': isNotStarted ? '#c0392b' : '#2980b9',
    border: flashes ? '3px solid #f1c40f' : '3px solid transparent',
    'min-height': 0,
    overflow: 'hidden',
    animation: flashes ? 'flashBorder 1s ease-in-out infinite' : 'none',
  }
}

const tableNumberAssignedStyle: JSX.CSSProperties = {
  'font-size': '64px',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1,
}

const tableActionButtonBaseStyle: JSX.CSSProperties = {
  'margin-top': '6px',
  padding: '6px 14px',
  'font-size': '13px',
  'font-weight': 700,
  border: 'none',
  'border-radius': '6px',
  color: '#fff',
  cursor: 'pointer',
}

const tablePostponeButtonStyle: JSX.CSSProperties = {
  ...tableActionButtonBaseStyle,
  'background-color': '#f39c12',
}

const tableCancelButtonStyle: JSX.CSSProperties = {
  ...tableActionButtonBaseStyle,
  'background-color': '#e74c3c',
}

const postponeDialogOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
  padding: '16px',
}

const postponeDialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: '100%',
  'max-width': '320px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const postponeDialogTitleStyle: JSX.CSSProperties = {
  'font-size': '1.2rem',
  'font-weight': 700,
  'margin-top': 0,
  'margin-bottom': '12px',
  color: '#333',
  'text-align': 'center',
}

const postponeButtonsStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': '1fr 1fr',
  gap: '8px',
  'margin-bottom': '12px',
}

const postponeButtonStyle: JSX.CSSProperties = {
  padding: '12px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #f39c12',
  'border-radius': '8px',
  'background-color': '#f39c12',
  color: '#fff',
  cursor: 'pointer',
}

const postponeCancelButtonStyle: JSX.CSSProperties = {
  width: '100%',
  padding: '10px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #ddd',
  'border-radius': '8px',
  'background-color': '#fff',
  color: '#333',
  cursor: 'pointer',
}

const eventNameTableStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'center',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
  'max-width': '100%',
}

const stageNameTableStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'font-weight': 500,
  color: 'rgba(255,255,255,0.8)',
  'text-align': 'center',
}

const subMatchTableLabelStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'font-weight': 500,
  color: 'rgba(255,255,255,0.8)',
  'text-align': 'center',
}

const bestOfTableStyle: JSX.CSSProperties = {
  'font-size': '11px',
  'font-weight': 500,
  color: 'rgba(255,255,255,0.7)',
  'text-align': 'center',
}

const tableSpacer: JSX.CSSProperties = {
  flex: '0 0 8px',
}

const tablePlayerRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '6px',
  'max-width': '100%',
}

const tablePlayerStyle: JSX.CSSProperties = {
  'font-size': '13px',
  'font-weight': 600,
  color: '#fff',
  'text-align': 'center',
  overflow: 'hidden',
  'text-overflow': 'ellipsis',
  'white-space': 'nowrap',
}

const gameScoreBadgeStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 800,
  color: '#f1c40f',
  'min-width': '20px',
  'text-align': 'center',
}

const tablePlayerWinnerStyle: JSX.CSSProperties = {
  ...tablePlayerStyle,
  'font-weight': 900,
  color: '#f1c40f',
}

const gameScoreBadgeWinnerStyle: JSX.CSSProperties = {
  ...gameScoreBadgeStyle,
  'font-weight': 900,
  color: '#fff14a',
  'text-shadow': '0 0 8px rgba(241, 196, 15, 0.8)',
}

const vsStyle: JSX.CSSProperties = {
  'font-size': '20px',
  'font-weight': 700,
  color: '#fff',
  'text-align': 'center',
}

const scoreContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const gameScoresRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
  'flex-wrap': 'wrap',
  'justify-content': 'center',
}

const gameScoreItemStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#fff',
}

const getScoreNumberStyle = (
  isWinner: boolean,
  isLatest: boolean,
  isLastScored: boolean,
): JSX.CSSProperties => ({
  'font-weight': isWinner || (isLatest && isLastScored) ? 800 : 400,
  color: isWinner ? '#f1c40f' : isLatest && isLastScored ? '#00e5ff' : '#fff',
  animation: isLatest && isLastScored ? 'flashPoint 1s ease-in-out infinite' : 'none',
})

const scoreColonStyle: JSX.CSSProperties = {
  margin: '0 1px',
  color: 'rgba(255,255,255,0.6)',
}

// Match Queue styles
const matchQueueContainerStyle: JSX.CSSProperties = {
  'background-color': '#16213e',
  'border-radius': '12px',
  padding: '12px',
  height: '100%',
  display: 'flex',
  'flex-direction': 'column',
  'min-height': 0,
}

const matchQueueTitleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '8px',
  'margin-bottom': '12px',
}

const matchQueueTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#f1c40f',
}

const emptyQueueStyle: JSX.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  'text-align': 'center',
  padding: '20px 0',
  'font-size': '14px',
}

const matchQueueListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'overflow-y': 'auto',
  '-webkit-overflow-scrolling': 'touch',
  flex: 1,
  'min-height': 0,
}

const queueRowStyle: JSX.CSSProperties = {
  'background-color': 'rgba(255,255,255,0.08)',
  'border-radius': '8px',
  padding: '10px 12px',
}

const queueRowMobileStyle: JSX.CSSProperties = {
  padding: '12px 14px',
}

const queueEventNameStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#3498db',
  'margin-bottom': '2px',
}

const queueEventNameMobileStyle: JSX.CSSProperties = {
  'font-size': '15px',
  'margin-bottom': '4px',
}

const queueStageStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: 'rgba(255,255,255,0.6)',
  'margin-bottom': '4px',
}

const queueStageMobileStyle: JSX.CSSProperties = {
  'font-size': '13px',
  'margin-bottom': '6px',
}

const queueMatchStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#fff',
}

const queueMatchMobileStyle: JSX.CSSProperties = {
  'font-size': '16px',
}

const queuePlayerStyle: JSX.CSSProperties = {
  'font-weight': 500,
}

const queuePlayerOnTableStyle: JSX.CSSProperties = {
  'font-weight': 500,
  color: '#e74c3c',
}

const queueVsStyle: JSX.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  margin: '0 4px',
  'font-size': '11px',
}

const queueVsMobileStyle: JSX.CSSProperties = {
  'font-size': '13px',
}

export default LiveScore
