import { Show, For, onMount, onCleanup, createSignal, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import { eventManageState, eventManageActions } from '../stores/eventManageStore'
import { eventState, eventActions } from '../stores/eventStore'
import type { Group, GroupParticipant } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import type { Match, Game } from '../../shared/types/Match'

const EventManage = () => {
  onMount(() => {
    if (!eventState.data) {
      eventActions.fetchEvents()
    }
  })

  onCleanup(() => {
    eventManageActions.reset()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Manage Event</h1>
        <EventSelector />
        <EventContent />
      </div>
    </div>
  )
}

const EventSelector = () => {
  const options = () =>
    eventState.data?.map((e) => ({
      value: e._id,
      label: e.eventName,
    })) || []

  const handleEventChange = (eventId: string) => {
    eventManageActions.selectEvent(eventId || null)
  }

  return (
    <Select
      label="Event"
      name="event"
      value={eventManageState.selectedEventId || ''}
      onChange={handleEventChange}
      options={options()}
      placeholder="-- Select an event --"
    />
  )
}

const EventContent = () => (
  <Show when={eventManageState.selectedEventId}>
    <Show when={!eventManageState.loading} fallback={<div>Loading...</div>}>
      <Show when={eventManageState.data}>
        <div style={eventContentStyle}>
          <StageTabs />
          <StageContent />
        </div>
      </Show>
    </Show>
  </Show>
)

const StageTabs = () => {
  const event = () => eventManageState.data

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
                  isActive={eventManageState.activeStageTab === tab.key}
                  onClick={() => eventManageActions.setActiveStageTab(tab.key)}
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
    when={eventManageState.activeStageTab === 'group'}
    fallback={<KnockoutStageContent />}
  >
    <GroupStageContent />
  </Show>
)

const GroupStageContent = () => {
  const hasGroups = () => eventManageActions.hasGroups()
  const groupStage = () => eventManageActions.getGroupStage()

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
    eventManageActions.generateGroups()
  }

  return (
    <div style={generateGroupsStyle}>
      <Button
        onClick={handleGenerateGroups}
        disabled={eventManageState.generatingGroups}
      >
        {eventManageState.generatingGroups ? 'Generating...' : 'Generate Groups'}
      </Button>
    </div>
  )
}

interface GroupDisplayProps {
  group: Group
}

const GroupDisplay = (props: GroupDisplayProps) => {
  const playerColumnTitle = () => eventManageActions.getPlayerColumnTitle()
  const rankedParticipants = () => getRankedParticipants(props.group.participants)

  return (
    <div style={groupContainerStyle}>
      <h3 style={groupTitleStyle}>Group {props.group.index + 1}</h3>
      <GroupTable
        participants={rankedParticipants()}
        playerColumnTitle={playerColumnTitle()}
      />
      <MatchSchedule matches={props.group.matches} groupIndex={props.group.index} />
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
  const side1Name = () => getMatchSideName(props.match.side1)
  const side2Name = () => getMatchSideName(props.match.side2)
  const hasResult = () =>
    props.match.winningSide !== undefined && props.match.winningSide !== null
  const hasStarted = () =>
    hasResult() || (props.match.games && props.match.games.length > 0)

  const handleStartClick = () => {
    const eventId = eventManageState.selectedEventId
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
          side1Name={side1Name()}
          side2Name={side2Name()}
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
    </div>
  )
}

const getMatchSideName = (side: Player[]): string => {
  if (!side || side.length === 0) return 'Unknown'
  return side.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
}

interface MatchResultDisplayProps {
  side1Name: string
  side2Name: string
  gamesWon1: number
  gamesWon2: number
  hasResult: boolean
}

const MatchResultDisplay = (props: MatchResultDisplayProps) => {
  const side1IsBold = () => props.hasResult && props.gamesWon1 > props.gamesWon2
  const side2IsBold = () => props.hasResult && props.gamesWon2 > props.gamesWon1

  return (
    <div style={matchResultStyle}>
      <div style={matchLeftSideStyle}>
        <span style={side1IsBold() ? boldTextStyle : normalTextStyle}>
          {props.side1Name}
        </span>
        <span style={side1IsBold() ? boldScoreStyle : normalScoreStyle}>
          {props.gamesWon1}
        </span>
      </div>
      <span style={scoreSeparatorStyle}>:</span>
      <div style={matchRightSideStyle}>
        <span style={side2IsBold() ? boldScoreStyle : normalScoreStyle}>
          {props.gamesWon2}
        </span>
        <span style={side2IsBold() ? boldTextStyle : normalTextStyle}>
          {props.side2Name}
        </span>
      </div>
    </div>
  )
}

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

  return (
    <tr>
      <td style={tdStyle}>{props.rank}</td>
      <td style={{ ...tdStyle, 'text-align': 'left' }}>{playerDisplay()}</td>
      <td style={tdStyle}>{total()}</td>
      <td style={tdStyle}>{stats().matchesWon}</td>
      <td style={tdStyle}>{stats().matchesLost}</td>
      <td style={tdStyle}>{differenceDisplay()}</td>
      <td style={tdStyle}>{winPercentage()}%</td>
      <td style={tdStyle}>{stats().matchesWon}</td>
      <td style={tdStyle}>{stats().matchesLost}</td>
      <td style={tdStyle}>{stats().gamesWon}</td>
      <td style={tdStyle}>{stats().gamesLost}</td>
    </tr>
  )
}

const getPlayerDisplay = (gp: GroupParticipant): string => {
  const participant = gp.participant

  if ('players' in participant && Array.isArray(participant.players)) {
    const sortedPlayers = [...participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
    return sortedPlayers.map((p) => `${p.firstName} ${p.lastName}`).join(' / ')
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

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
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
  'border-radius': '8px',
  padding: '20px',
  'box-shadow': '0 2px 4px rgba(0, 0, 0, 0.1)',
}

const groupTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#333',
  'margin-bottom': '16px',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'font-size': '14px',
}

const thStyle: JSX.CSSProperties = {
  padding: '12px 8px',
  'text-align': 'center',
  'border-bottom': '2px solid #ddd',
  'background-color': '#f9f9f9',
  'font-weight': 700,
  color: '#333',
}

const tdStyle: JSX.CSSProperties = {
  padding: '12px 8px',
  'text-align': 'center',
  'border-bottom': '1px solid #eee',
}

const emptyContentStyle: JSX.CSSProperties = {
  padding: '40px',
  'text-align': 'center',
  color: '#666',
}

const matchScheduleContainerStyle: JSX.CSSProperties = {
  'margin-top': '16px',
  'border-top': '1px solid #eee',
  'padding-top': '12px',
}

const collapsibleHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  'font-size': '14px',
  color: '#666',
}

const collapsibleTitleStyle: JSX.CSSProperties = {
  'font-weight': 600,
}

const matchScheduleContentStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
  'margin-top': '12px',
}

const matchRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'row',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
  padding: '8px 12px',
  'background-color': '#f9f9f9',
  'border-radius': '4px',
}

const matchContentContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '4px',
  flex: '1',
}

const matchResultStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '100%',
  'font-size': '14px',
}

const matchLeftSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-end',
  gap: '8px',
  flex: '1',
}

const matchRightSideStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'flex-start',
  gap: '8px',
  flex: '1',
}

const scoreSeparatorStyle: JSX.CSSProperties = {
  color: '#666',
  padding: '0 8px',
}

const boldScoreStyle: JSX.CSSProperties = {
  'font-weight': 700,
}

const normalScoreStyle: JSX.CSSProperties = {
  'font-weight': 400,
}

const boldTextStyle: JSX.CSSProperties = {
  'font-weight': 700,
}

const normalTextStyle: JSX.CSSProperties = {
  'font-weight': 400,
}

const gameScoresStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: '#666',
  'padding-left': '4px',
}

const gameScoreSeparatorStyle: JSX.CSSProperties = {
  margin: '0 2px',
}

const gameDelimiterStyle: JSX.CSSProperties = {
  'margin-right': '8px',
}

export default EventManage
