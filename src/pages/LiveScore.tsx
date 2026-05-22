import {
  onMount,
  onCleanup,
  createSignal,
  Show,
  For,
  type JSX,
} from 'solid-js'
import { liveScoreState, liveScoreActions } from '../stores/liveScoreStore'
import type { TableAssignment, MatchQueueItem } from '../../shared/types/Table'
import type { Player } from '../../shared/types/Player'
import type { Game } from '../../shared/types/Match'

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

const MobileLayout = () => (
  <div style={mobileLayoutStyle}>
    <div style={tablesScrollContainerStyle}>
      <div style={tablesGridMobileStyle}>
        <TableRow tables={[5, 6]} />
        <TableRow tables={[1, 2]} />
      </div>
      <div style={tablesGridMobileStyle}>
        <TableRow tables={[7, 8]} />
        <TableRow tables={[3, 4]} />
      </div>
    </div>
    <div class="hide-scrollbar" style={matchQueueMobileStyle}>
      <MatchQueue />
    </div>
  </div>
)

// ==================== TABLE COMPONENTS ====================

interface TableRowProps {
  tables: number[]
}

const TableRow = (props: TableRowProps) => (
  <div style={getTableRowStyle(props.tables.length)}>
    <For each={props.tables}>
      {(tableNum) => {
        const table = () => liveScoreActions.getTable(tableNum)
        return <TableCell table={table()} tableNumber={tableNum} />
      }}
    </For>
  </div>
)

interface TableCellProps {
  table?: TableAssignment
  tableNumber: number
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

interface AssignedTableProps {
  tableNumber: number
  matchItem: MatchQueueItem
  matchStatus: string
}

const AssignedTable = (props: AssignedTableProps) => {
  const isNotStarted = () => props.matchStatus === 'not_started'
  const match = () => props.matchItem.match
  const side1Players = () => match()?.side1 || []
  const side2Players = () => match()?.side2 || []
  const bestOf = () => match()?.config?.numberOfGames
  const isInProgress = () => !isNotStarted()
  const gamesWon1 = () => match()?.gamesWon1 ?? 0
  const gamesWon2 = () => match()?.gamesWon2 ?? 0

  return (
    <div style={getAssignedTableStyle(isNotStarted())}>
      <div style={tableNumberAssignedStyle}>{props.tableNumber}</div>
      <div style={eventNameTableStyle}>{props.matchItem.eventName}</div>
      <div style={stageNameTableStyle}>{props.matchItem.stageName}</div>
      <Show when={bestOf()}>
        <div style={bestOfTableStyle}>Best of {bestOf()}</div>
      </Show>
      <div style={tableSpacer} />
      <TablePlayerDisplay players={side1Players()} gamesWon={gamesWon1()} showScore={isInProgress()} />
      <TableScoreDisplay
        match={match()}
        isNotStarted={isNotStarted()}
      />
      <TablePlayerDisplay players={side2Players()} gamesWon={gamesWon2()} showScore={isInProgress()} />
    </div>
  )
}

interface TablePlayerDisplayProps {
  players: Player[]
  gamesWon: number
  showScore: boolean
}

const TablePlayerDisplay = (props: TablePlayerDisplayProps) => {
  const display = () => formatPlayersForTable(props.players)
  return (
    <div style={tablePlayerRowStyle}>
      <span style={tablePlayerStyle}>{display()}</span>
      <Show when={props.showScore}>
        <span style={gameScoreBadgeStyle}>{props.gamesWon}</span>
      </Show>
    </div>
  )
}

const formatPlayersForTable = (players: Player[]): string => {
  if (!players || players.length === 0) return 'TBD'
  if (players.length === 1) {
    return `${players[0].firstName} ${players[0].lastName}`
  }
  return players.map((p) => `${p.firstName}`).join(' / ')
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

const MatchQueue = () => {
  const queue = () => liveScoreState.matchQueue

  return (
    <div style={matchQueueContainerStyle}>
      <div style={matchQueueTitleStyle}>Match Queue</div>
      <Show
        when={queue().length > 0}
        fallback={<div style={emptyQueueStyle}>No matches in queue</div>}
      >
        <div class="hide-scrollbar" style={matchQueueListStyle}>
          <For each={queue()}>
            {(item) => <MatchQueueRow item={item} />}
          </For>
        </div>
      </Show>
    </div>
  )
}

interface MatchQueueRowProps {
  item: MatchQueueItem
}

const MatchQueueRow = (props: MatchQueueRowProps) => {
  const match = () => props.item.match
  const side1Name = () => formatPlayersShort(match()?.side1 || [])
  const side2Name = () => formatPlayersShort(match()?.side2 || [])
  const playable = () => liveScoreActions.isMatchPlayable(props.item)

  return (
    <div style={playable() ? queueRowStyle : queueRowDisabledStyle}>
      <div style={queueEventNameStyle}>{props.item.eventName}</div>
      <div style={queueStageStyle}>{props.item.stageName}</div>
      <div style={queueMatchStyle}>
        <span style={queuePlayerStyle}>{side1Name()}</span>
        <span style={queueVsStyle}> vs </span>
        <span style={queuePlayerStyle}>{side2Name()}</span>
      </div>
    </div>
  )
}

const formatPlayersShort = (players: Player[]): string => {
  if (!players || players.length === 0) return 'TBD'
  if (players.length === 1) return `${players[0].firstName} ${players[0].lastName}`
  return players.map((p) => p.firstName).join('/')
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
  display: 'flex',
  'flex-direction': 'column',
  flex: 1,
  padding: '8px',
  gap: '8px',
  'min-height': 0,
}

const tablesScrollContainerStyle: JSX.CSSProperties = {
  flex: 2,
  display: 'flex',
  'overflow-x': 'auto',
  '-webkit-overflow-scrolling': 'touch',
  'scroll-snap-type': 'x mandatory',
  gap: '8px',
  'min-height': 0,
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

const matchQueueMobileStyle: JSX.CSSProperties = {
  flex: 1,
  'min-height': '120px',
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
const getAssignedTableStyle = (isNotStarted: boolean): JSX.CSSProperties => ({
  'min-width': 0,
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  'justify-content': 'center',
  gap: '2px',
  padding: '8px',
  'border-radius': '12px',
  'background-color': isNotStarted ? '#c0392b' : '#2980b9',
  border: isNotStarted ? '3px solid #f1c40f' : '3px solid transparent',
  'min-height': 0,
  overflow: 'hidden',
  animation: isNotStarted ? 'flashBorder 1s ease-in-out infinite' : 'none',
})

const tableNumberAssignedStyle: JSX.CSSProperties = {
  'font-size': '36px',
  'font-weight': 900,
  color: '#f1c40f',
  'line-height': 1,
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

const matchQueueTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#f1c40f',
  'margin-bottom': '12px',
  'text-align': 'center',
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
  flex: 1,
  'min-height': 0,
}

const queueRowStyle: JSX.CSSProperties = {
  'background-color': 'rgba(255,255,255,0.08)',
  'border-radius': '8px',
  padding: '10px 12px',
}

const queueEventNameStyle: JSX.CSSProperties = {
  'font-size': '12px',
  'font-weight': 600,
  color: '#3498db',
  'margin-bottom': '2px',
}

const queueStageStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: 'rgba(255,255,255,0.6)',
  'margin-bottom': '4px',
}

const queueMatchStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#fff',
}

const queuePlayerStyle: JSX.CSSProperties = {
  'font-weight': 500,
}

const queueVsStyle: JSX.CSSProperties = {
  color: 'rgba(255,255,255,0.5)',
  margin: '0 4px',
  'font-size': '11px',
}

// Disabled queue row (match not playable - players on tables)
const queueRowDisabledStyle: JSX.CSSProperties = {
  ...queueRowStyle,
  'background-color': 'rgba(255,255,255,0.03)',
  opacity: '0.5',
}

export default LiveScore
