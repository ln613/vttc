import { Show, For, onMount, onCleanup, createSignal, type JSX } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Button from '../components/Button'
import { eventDetailState, eventDetailActions } from '../stores/eventDetailStore'
import type { Group, GroupParticipant } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import type { Match, Game } from '../../shared/types/Match'

const EventDetail = () => {
  const params = useParams()

  onMount(() => {
    if (params.id) {
      eventDetailActions.loadEvent(params.id)
    }
  })

  onCleanup(() => {
    eventDetailActions.reset()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <EventHeader />
        <EventContent />
      </div>
    </div>
  )
}

const EventHeader = () => {
  const eventName = () => eventDetailState.data?.eventName || ''
  const dateTimeDisplay = () => formatDateTime(eventDetailState.data?.date)

  return (
    <Show when={eventDetailState.data}>
      <h1 style={eventNameStyle}>{eventName()}</h1>
      <h3 style={dateTimeStyle}>{dateTimeDisplay()}</h3>
    </Show>
  )
}

const formatDateTime = (date?: string): string => {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

const EventContent = () => (
  <Show when={!eventDetailState.loading} fallback={<div>Loading...</div>}>
    <Show when={eventDetailState.data}>
      <div style={eventContentStyle}>
        <StageTabs />
        <StageContent />
      </div>
    </Show>
  </Show>
)

const StageTabs = () => {
  const event = () => eventDetailState.data

  return (
    <Show when={event()}>
      {(e) => {
        const stages = e().stages || []
        const tabs = stages.map((stage) => ({
          key: stage as 'group' | 'knockout',
          label: stage === 'group' ? 'Group' : 'Knockout',
        }))

        return (
          <div style={tabsContainerStyle}>
            <For each={tabs}>
              {(tab) => (
                <TabButton
                  label={tab.label}
                  isActive={eventDetailState.activeStageTab === tab.key}
                  onClick={() => eventDetailActions.setActiveStageTab(tab.key)}
                />
              )}
            </For>
          </div>
        )
      }}
    </Show>
  )
}

interface TabButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
}

const TabButton = (props: TabButtonProps) => {
  const tabStyle = (): JSX.CSSProperties => ({
    padding: '12px 24px',
    border: 'none',
    'border-bottom': props.isActive
      ? '3px solid #e67e22'
      : '3px solid transparent',
    'background-color': 'transparent',
    cursor: 'pointer',
    'font-weight': props.isActive ? 700 : 400,
    'font-size': '16px',
    color: props.isActive ? '#e67e22' : '#666',
    transition: 'all 0.2s ease',
  })

  return (
    <button style={tabStyle()} onClick={props.onClick}>
      {props.label}
    </button>
  )
}

const StageContent = () => (
  <Show
    when={eventDetailState.activeStageTab === 'group'}
    fallback={<KnockoutStageContent />}
  >
    <GroupStageContent />
  </Show>
)

const GroupStageContent = () => {
  const hasGroups = () => eventDetailActions.hasGroups()
  const groupStage = () => eventDetailActions.getGroupStage()

  return (
    <Show when={hasGroups()} fallback={<GenerateGroupsSection />}>
      <div style={groupsListStyle}>
        <For each={groupStage()?.groups}>
          {(group) => <GroupDisplay group={group} />}
        </For>
      </div>
    </Show>
  )
}

const GenerateGroupsSection = () => {
  const handleGenerateGroups = () => {
    eventDetailActions.generateGroups()
  }

  return (
    <div style={generateGroupsStyle}>
      <Button
        onClick={handleGenerateGroups}
        disabled={eventDetailState.generatingGroups}
      >
        {eventDetailState.generatingGroups
          ? 'Generating...'
          : 'Generate Groups'}
      </Button>
    </div>
  )
}

interface GroupDisplayProps {
  group: Group
}

const GroupDisplay = (props: GroupDisplayProps) => {
  const playerColumnTitle = () => eventDetailActions.getPlayerColumnTitle()
  const rankedParticipants = () =>
    getRankedParticipants(props.group.participants)

  return (
    <div style={groupContainerStyle}>
      <h3 style={groupTitleStyle}>Group {props.group.index + 1}</h3>
      <GroupTable
        participants={rankedParticipants()}
        playerColumnTitle={playerColumnTitle()}
      />
      <MatchSchedule
        matches={props.group.matches}
        groupIndex={props.group.index}
      />
    </div>
  )
}

interface MatchScheduleProps {
  matches: Match[]
  groupIndex: number
}

const MatchSchedule = (props: MatchScheduleProps) => {
  const [isExpanded, setIsExpanded] = createSignal(false)

  return (
    <Show when={props.matches && props.matches.length > 0}>
      <div style={matchScheduleContainerStyle}>
        <CollapsibleHeader
          title="Match Schedule"
          isExpanded={isExpanded()}
          onToggle={() => setIsExpanded(!isExpanded())}
        />
        <Show when={isExpanded()}>
          <div style={matchScheduleContentStyle}>
            <For each={props.matches}>
              {(match) => (
                <MatchRow match={match} groupIndex={props.groupIndex} />
              )}
            </For>
          </div>
        </Show>
      </div>
    </Show>
  )
}

interface CollapsibleHeaderProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
}

const CollapsibleHeader = (props: CollapsibleHeaderProps) => (
  <button style={collapsibleHeaderStyle} onClick={props.onToggle}>
    <span>{props.isExpanded ? '▼' : '▶'}</span>
    <span style={collapsibleTitleStyle}>{props.title}</span>
  </button>
)

interface MatchRowProps {
  match: Match
  groupIndex: number
}

const MatchRow = (props: MatchRowProps) => {
  const navigate = useNavigate()
  const side1Players = () => getMatchSidePlayers(props.match.side1)
  const side2Players = () => getMatchSidePlayers(props.match.side2)
  const hasResult = () =>
    props.match.winningSide !== undefined && props.match.winningSide !== null
  const hasStarted = () =>
    hasResult() || (props.match.games && props.match.games.length > 0)

  const handleStartClick = () => {
    const eventId = eventDetailState.eventId
    if (eventId) {
      navigate(
        `/game-play?eventId=${eventId}&stage=group&groupIndex=${props.groupIndex}&matchId=${props.match._id}`,
      )
    }
  }

  return (
    <div style={matchRowStyle}>
      <div style={matchContentContainerStyle}>
        <MatchResultDisplay
          side1Players={side1Players()}
          side2Players={side2Players()}
          gamesWon1={props.match.gamesWon1}
          gamesWon2={props.match.gamesWon2}
          hasResult={hasResult()}
        />
        <GameScoresDisplay games={props.match.games} />
      </div>
      <Show when={!hasStarted()}>
        <Button onClick={handleStartClick} color="#27ae60" size="small">
          Start
        </Button>
      </Show>
      <Show when={hasStarted() && !hasResult()}>
        <Button onClick={handleStartClick} color="#e67e22" size="small">
          Continue
        </Button>
      </Show>
    </div>
  )
}

interface SidePlayer {
  firstName: string
  lastName: string
}

const getMatchSidePlayers = (side: Player[]): SidePlayer[] => {
  if (!side || side.length === 0) return [{ firstName: 'Unknown', lastName: '' }]
  return side.map((p) => ({ firstName: p.firstName, lastName: p.lastName }))
}

interface MatchResultDisplayProps {
  side1Players: SidePlayer[]
  side2Players: SidePlayer[]
  gamesWon1: number
  gamesWon2: number
  hasResult: boolean
}

const MatchResultDisplay = (props: MatchResultDisplayProps) => {
  const side1IsWinner = () =>
    props.hasResult && props.gamesWon1 > props.gamesWon2
  const side2IsWinner = () =>
    props.hasResult && props.gamesWon2 > props.gamesWon1

  return (
    <div style={matchResultStyle}>
      <div style={matchLeftSideStyle}>
        <PlayerNameDisplay
          players={props.side1Players}
          align="right"
          isWinner={side1IsWinner()}
        />
        <span
          style={side1IsWinner() ? winningScoreStyle : losingScoreStyle}
        >
          {props.gamesWon1}
        </span>
      </div>
      <span style={scoreSeparatorStyle}>:</span>
      <div style={matchRightSideStyle}>
        <span
          style={side2IsWinner() ? winningScoreStyle : losingScoreStyle}
        >
          {props.gamesWon2}
        </span>
        <PlayerNameDisplay
          players={props.side2Players}
          align="left"
          isWinner={side2IsWinner()}
        />
      </div>
    </div>
  )
}

interface PlayerNameDisplayProps {
  players: SidePlayer[]
  align: 'left' | 'right'
  isWinner: boolean
}

const PlayerNameDisplay = (props: PlayerNameDisplayProps) => (
  <div
    style={{
      display: 'flex',
      'flex-direction': 'column',
      'align-items': props.align === 'right' ? 'flex-end' : 'flex-start',
    }}
  >
    <For each={props.players}>
      {(player, index) => (
        <>
          <Show when={index() > 0}>
            <span style={playerSeparatorStyle}>/</span>
          </Show>
          <span
            style={{
              'font-size': '15px',
              'font-weight': props.isWinner ? 700 : 400,
              color: props.isWinner ? '#2c3e50' : '#555',
              'line-height': '1.2',
            }}
          >
            {player.firstName}
          </span>
          <span
            style={{
              'font-size': '13px',
              'font-weight': props.isWinner ? 600 : 400,
              color: props.isWinner ? '#34495e' : '#888',
              'line-height': '1.2',
            }}
          >
            {player.lastName}
          </span>
        </>
      )}
    </For>
  </div>
)

interface GameScoresDisplayProps {
  games: Game[]
}

const GameScoresDisplay = (props: GameScoresDisplayProps) => (
  <Show when={props.games && props.games.length > 0}>
    <div style={gameScoresStyle}>
      <For each={props.games}>
        {(game, index) => (
          <GameScoreDisplay
            game={game}
            isLast={index() === props.games.length - 1}
          />
        )}
      </For>
    </div>
  </Show>
)

interface GameScoreDisplayProps {
  game: Game
  isLast: boolean
}

const GameScoreDisplay = (props: GameScoreDisplayProps) => {
  const side1IsBold = () => props.game.winningSide === 1
  const side2IsBold = () => props.game.winningSide === 2

  return (
    <span>
      <span style={side1IsBold() ? boldScoreStyle : normalScoreStyle}>
        {props.game.score1}
      </span>
      <span style={gameScoreSeparatorStyle}>:</span>
      <span style={side2IsBold() ? boldScoreStyle : normalScoreStyle}>
        {props.game.score2}
      </span>
      <Show when={!props.isLast}>
        <span style={gameDelimiterStyle}>,</span>
      </Show>
    </span>
  )
}

const getRankedParticipants = (
  participants: GroupParticipant[],
): GroupParticipant[] =>
  [...participants].sort((a, b) => {
    if (b.stats.matchesWon !== a.stats.matchesWon) {
      return b.stats.matchesWon - a.stats.matchesWon
    }
    if (b.stats.gameDifference !== a.stats.gameDifference) {
      return b.stats.gameDifference - a.stats.gameDifference
    }
    return b.stats.gamesWon - a.stats.gamesWon
  })

interface GroupTableProps {
  participants: GroupParticipant[]
  playerColumnTitle: string
}

const GroupTable = (props: GroupTableProps) => (
  <div style={tableWrapperStyle}>
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Rank</th>
          <th style={{ ...thStyle, 'text-align': 'left' }}>
            {props.playerColumnTitle}
          </th>
          <th style={thStyle}>Total</th>
          <th style={thStyle}>W</th>
          <th style={thStyle}>L</th>
          <th style={thStyle}>+/-</th>
          <th style={thStyle}>Win %</th>
          <th style={thStyle}>MW</th>
          <th style={thStyle}>ML</th>
          <th style={thStyle}>GW</th>
          <th style={thStyle}>GL</th>
        </tr>
      </thead>
      <tbody>
        <For each={props.participants}>
          {(gp, index) => (
            <GroupTableRow participant={gp} rank={index() + 1} />
          )}
        </For>
      </tbody>
    </table>
  </div>
)

interface GroupTableRowProps {
  participant: GroupParticipant
  rank: number
}

const GroupTableRow = (props: GroupTableRowProps) => {
  const stats = () => props.participant.stats
  const total = () => stats().matchesPlayed
  const winPercentage = () =>
    total() > 0 ? ((stats().matchesWon / total()) * 100).toFixed(1) : '0.0'
  const playerDisplay = () => getPlayerDisplay(props.participant)
  const difference = () => stats().matchesWon - stats().matchesLost
  const differenceDisplay = () =>
    difference() >= 0 ? `+${difference()}` : String(difference())

  const rowBg = () => (props.rank % 2 === 0 ? '#f8f9fa' : '#fff')
  const cellStyle = (): JSX.CSSProperties => ({
    ...tdStyle,
    'background-color': rowBg(),
  })

  return (
    <tr>
      <td style={cellStyle()}>{props.rank}</td>
      <td
        style={{ ...cellStyle(), 'text-align': 'left', 'font-weight': 500 }}
      >
        {playerDisplay()}
      </td>
      <td style={cellStyle()}>{total()}</td>
      <td style={{ ...cellStyle(), 'font-weight': 600, color: '#27ae60' }}>
        {stats().matchesWon}
      </td>
      <td style={{ ...cellStyle(), color: '#e74c3c' }}>
        {stats().matchesLost}
      </td>
      <td style={cellStyle()}>{differenceDisplay()}</td>
      <td style={{ ...cellStyle(), 'font-weight': 500 }}>
        {winPercentage()}%
      </td>
      <td style={cellStyle()}>{stats().matchesWon}</td>
      <td style={cellStyle()}>{stats().matchesLost}</td>
      <td style={cellStyle()}>{stats().gamesWon}</td>
      <td style={cellStyle()}>{stats().gamesLost}</td>
    </tr>
  )
}

const getPlayerDisplay = (gp: GroupParticipant): string => {
  const participant = gp.participant

  if ('players' in participant && Array.isArray(participant.players)) {
    const sortedPlayers = [...participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
    return sortedPlayers
      .map((p) => `${p.firstName} ${p.lastName}`)
      .join(' / ')
  }

  if ('firstName' in participant && 'lastName' in participant) {
    return `${participant.firstName} ${participant.lastName}`
  }

  return 'Unknown'
}

const KnockoutStageContent = () => (
  <div style={emptyContentStyle}>Knockout stage display coming soon</div>
)

// Styles
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  margin: '0 auto',
  padding: '20px',
}

const eventNameStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  'margin-bottom': '4px',
}

const dateTimeStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '18px',
  'font-weight': 400,
  color: '#666',
  'margin-bottom': '20px',
}

const eventContentStyle: JSX.CSSProperties = {
  'margin-top': '20px',
}

const tabsContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '4px',
  'border-bottom': '1px solid #ddd',
  'margin-bottom': '20px',
}

const groupsListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '24px',
}

const generateGroupsStyle: JSX.CSSProperties = {
  padding: '40px',
  'text-align': 'center',
}

const groupContainerStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '0',
  'box-shadow': '0 2px 8px rgba(0, 0, 0, 0.08)',
  overflow: 'hidden',
  border: '1px solid #e8e8e8',
}

const groupTitleStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 700,
  color: '#fff',
  margin: '0',
  padding: '14px 20px',
  background: 'linear-gradient(135deg, #2c3e50, #34495e)',
  'letter-spacing': '0.5px',
}

const tableWrapperStyle: JSX.CSSProperties = {
  'overflow-x': 'auto',
  '-webkit-overflow-scrolling': 'touch',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'font-size': '13px',
  'min-width': '600px',
}

const thStyle: JSX.CSSProperties = {
  padding: '10px 8px',
  'text-align': 'center',
  'border-bottom': '2px solid #e67e22',
  'background-color': '#fafafa',
  'font-weight': 700,
  'font-size': '12px',
  color: '#666',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
}

const tdStyle: JSX.CSSProperties = {
  padding: '10px 8px',
  'text-align': 'center',
  'border-bottom': '1px solid #f0f0f0',
  color: '#444',
}

const emptyContentStyle: JSX.CSSProperties = {
  padding: '40px',
  'text-align': 'center',
  color: '#666',
}

const matchScheduleContainerStyle: JSX.CSSProperties = {
  'margin-top': '0',
  padding: '16px 20px',
  'background-color': '#fafafa',
  'border-top': '1px solid #f0f0f0',
}

const collapsibleHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  'font-size': '15px',
  color: '#2c3e50',
  width: '100%',
}

const collapsibleTitleStyle: JSX.CSSProperties = {
  'font-weight': 700,
  'letter-spacing': '0.3px',
}

const matchScheduleContentStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'margin-top': '12px',
  padding: '12px',
  'background-color': '#f0f2f5',
  'border-radius': '8px',
}

const matchRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '10px',
  padding: '14px 16px',
  'background-color': '#fff',
  'border-radius': '10px',
  'border-left': '4px solid #3498db',
  'box-shadow': '0 1px 4px rgba(0, 0, 0, 0.08)',
}

const matchContentContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '6px',
  width: '100%',
}

const matchResultStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '100%',
}

const matchLeftSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '12px',
  flex: '1',
}

const matchRightSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-start',
  gap: '12px',
  flex: '1',
}

const scoreSeparatorStyle: JSX.CSSProperties = {
  color: '#999',
  padding: '0 6px',
  'font-size': '20px',
  'font-weight': 300,
}

const winningScoreStyle: JSX.CSSProperties = {
  'font-weight': 800,
  'font-size': '28px',
  color: '#e67e22',
}

const losingScoreStyle: JSX.CSSProperties = {
  'font-weight': 400,
  'font-size': '28px',
  color: '#bbb',
}

const playerSeparatorStyle: JSX.CSSProperties = {
  'font-size': '11px',
  color: '#aaa',
  margin: '2px 0',
}

const boldScoreStyle: JSX.CSSProperties = {
  'font-weight': 700,
  color: '#e67e22',
}

const normalScoreStyle: JSX.CSSProperties = {
  'font-weight': 400,
  color: '#999',
}

const gameScoresStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#888',
  'background-color': '#f8f8f8',
  padding: '4px 10px',
  'border-radius': '12px',
}

const gameScoreSeparatorStyle: JSX.CSSProperties = {
  margin: '0 2px',
}

const gameDelimiterStyle: JSX.CSSProperties = {
  'margin-right': '8px',
}

export default EventDetail
