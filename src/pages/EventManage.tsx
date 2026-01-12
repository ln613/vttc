import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import {
  useEventManageSelector,
  eventManageActions,
} from '../stores/eventManageStore'
import { eventActions, useEventSelector } from '../stores/eventStore'
import type { Group, GroupParticipant } from '../../shared/types/Tournament'
import type { Player } from '../../shared/types/Player'
import type { Match, Game } from '../../shared/types/Match'

const EventManage = () => {
  useInitializeData()

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

const useInitializeData = () => {
  const events = useEventSelector((s) => s.data)

  useEffect(() => {
    if (!events) {
      eventActions.fetchEvents()
    }
    return () => {
      eventManageActions.reset()
    }
  }, [events])
}

const EventSelector = () => {
  const events = useEventSelector((s) => s.data)
  const selectedEventId = useEventManageSelector((s) => s.selectedEventId)

  const options =
    events?.map((e) => ({
      value: e._id,
      label: e.eventName,
    })) || []

  return (
    <Select
      label="Event"
      name="event"
      value={selectedEventId || ''}
      onChange={handleEventChange}
      options={options}
      placeholder="-- Select an event --"
    />
  )
}

const handleEventChange = (eventId: string) => {
  eventManageActions.selectEvent(eventId || null)
}

const EventContent = () => {
  const selectedEventId = useEventManageSelector((s) => s.selectedEventId)
  const event = useEventManageSelector((s) => s.data)
  const loading = useEventManageSelector((s) => s.loading)

  if (!selectedEventId) return null
  if (loading) return <div>Loading...</div>
  if (!event) return null

  return (
    <div style={eventContentStyle}>
      <StageTabs />
      <StageContent />
    </div>
  )
}

const StageTabs = () => {
  const event = useEventManageSelector((s) => s.data)
  const activeTab = useEventManageSelector((s) => s.activeStageTab)

  if (!event) return null

  const stages = event.stages || []
  const tabs = stages.map((stage) => ({
    key: stage,
    label: stage === 'group' ? 'Group' : 'Knockout',
  }))

  return (
    <div style={tabsContainerStyle}>
      {tabs.map((tab) => (
        <TabButton
          key={tab.key}
          label={tab.label}
          isActive={activeTab === tab.key}
          onClick={() => eventManageActions.setActiveStageTab(tab.key)}
        />
      ))}
    </div>
  )
}

interface TabButtonProps {
  label: string
  isActive: boolean
  onClick: () => void
}

const TabButton = ({ label, isActive, onClick }: TabButtonProps) => (
  <button style={getTabStyle(isActive)} onClick={onClick}>
    {label}
  </button>
)

const getTabStyle = (isActive: boolean): React.CSSProperties => ({
  padding: '12px 24px',
  border: 'none',
  borderBottom: isActive ? '3px solid #e67e22' : '3px solid transparent',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontWeight: isActive ? 700 : 400,
  fontSize: '16px',
  color: isActive ? '#e67e22' : '#666',
  transition: 'all 0.2s ease',
})

const StageContent = () => {
  const activeTab = useEventManageSelector((s) => s.activeStageTab)

  if (activeTab === 'group') return <GroupStageContent />
  if (activeTab === 'knockout') return <KnockoutStageContent />

  return null
}

const GroupStageContent = () => {
  const hasGroups = eventManageActions.hasGroups()
  const groupStage = eventManageActions.getGroupStage()

  if (!hasGroups) return <GenerateGroupsSection />

  return (
    <div style={groupsListStyle}>
      {groupStage?.groups.map((group) => (
        <GroupDisplay key={group.index} group={group} />
      ))}
    </div>
  )
}

const GenerateGroupsSection = () => {
  const generatingGroups = useEventManageSelector((s) => s.generatingGroups)

  return (
    <div style={generateGroupsStyle}>
      <Button onClick={handleGenerateGroups} disabled={generatingGroups}>
        {generatingGroups ? 'Generating...' : 'Generate Groups'}
      </Button>
    </div>
  )
}

const handleGenerateGroups = () => {
  eventManageActions.generateGroups()
}

interface GroupDisplayProps {
  group: Group
}

const GroupDisplay = ({ group }: GroupDisplayProps) => {
  const playerColumnTitle = eventManageActions.getPlayerColumnTitle()
  const rankedParticipants = getRankedParticipants(group.participants)

  return (
    <div style={groupContainerStyle}>
      <h3 style={groupTitleStyle}>Group {group.index + 1}</h3>
      <GroupTable
        participants={rankedParticipants}
        playerColumnTitle={playerColumnTitle}
      />
      <MatchSchedule matches={group.matches} />
    </div>
  )
}

interface MatchScheduleProps {
  matches: Match[]
}

const MatchSchedule = ({ matches }: MatchScheduleProps) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!matches || matches.length === 0) return null

  return (
    <div style={matchScheduleContainerStyle}>
      <CollapsibleHeader
        title="Match Schedule"
        isExpanded={isExpanded}
        onToggle={() => setIsExpanded(!isExpanded)}
      />
      {isExpanded && (
        <div style={matchScheduleContentStyle}>
          {matches.map((match) => (
            <MatchRow key={match._id} match={match} />
          ))}
        </div>
      )}
    </div>
  )
}

interface CollapsibleHeaderProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
}

const CollapsibleHeader = ({
  title,
  isExpanded,
  onToggle,
}: CollapsibleHeaderProps) => (
  <button style={collapsibleHeaderStyle} onClick={onToggle}>
    <span>{isExpanded ? '▼' : '▶'}</span>
    <span style={collapsibleTitleStyle}>{title}</span>
  </button>
)

interface MatchRowProps {
  match: Match
}

const MatchRow = ({ match }: MatchRowProps) => {
  const side1Name = getMatchSideName(match.side1)
  const side2Name = getMatchSideName(match.side2)
  const hasResult = match.winningSide !== undefined

  return (
    <div style={matchRowStyle}>
      <MatchResultDisplay
        side1Name={side1Name}
        side2Name={side2Name}
        gamesWon1={match.gamesWon1}
        gamesWon2={match.gamesWon2}
        hasResult={hasResult}
      />
      <GameScoresDisplay games={match.games} />
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

const MatchResultDisplay = ({
  side1Name,
  side2Name,
  gamesWon1,
  gamesWon2,
  hasResult,
}: MatchResultDisplayProps) => {
  const side1IsBold = hasResult && gamesWon1 > gamesWon2
  const side2IsBold = hasResult && gamesWon2 > gamesWon1

  return (
    <div style={matchResultStyle}>
      <div style={matchLeftSideStyle}>
        <span style={side1IsBold ? boldTextStyle : normalTextStyle}>
          {side1Name}
        </span>
        <span style={side1IsBold ? boldScoreStyle : normalScoreStyle}>
          {gamesWon1}
        </span>
      </div>
      <span style={scoreSeparatorStyle}>:</span>
      <div style={matchRightSideStyle}>
        <span style={side2IsBold ? boldScoreStyle : normalScoreStyle}>
          {gamesWon2}
        </span>
        <span style={side2IsBold ? boldTextStyle : normalTextStyle}>
          {side2Name}
        </span>
      </div>
    </div>
  )
}

interface GameScoresDisplayProps {
  games: Game[]
}

const GameScoresDisplay = ({ games }: GameScoresDisplayProps) => {
  if (!games || games.length === 0) return null

  return (
    <div style={gameScoresStyle}>
      {games.map((game, index) => (
        <GameScoreDisplay key={game._id} game={game} isLast={index === games.length - 1} />
      ))}
    </div>
  )
}

interface GameScoreDisplayProps {
  game: Game
  isLast: boolean
}

const GameScoreDisplay = ({ game, isLast }: GameScoreDisplayProps) => {
  const side1IsBold = game.winningSide === 1
  const side2IsBold = game.winningSide === 2

  return (
    <span>
      <span style={side1IsBold ? boldScoreStyle : normalScoreStyle}>
        {game.score1}
      </span>
      <span style={gameScoreSeparatorStyle}>:</span>
      <span style={side2IsBold ? boldScoreStyle : normalScoreStyle}>
        {game.score2}
      </span>
      {!isLast && <span style={gameDelimiterStyle}>,</span>}
    </span>
  )
}

const getRankedParticipants = (
  participants: GroupParticipant[],
): GroupParticipant[] => {
  return [...participants].sort((a, b) => {
    if (b.stats.matchesWon !== a.stats.matchesWon) {
      return b.stats.matchesWon - a.stats.matchesWon
    }
    if (b.stats.gameDifference !== a.stats.gameDifference) {
      return b.stats.gameDifference - a.stats.gameDifference
    }
    return b.stats.gamesWon - a.stats.gamesWon
  })
}

interface GroupTableProps {
  participants: GroupParticipant[]
  playerColumnTitle: string
}

const GroupTable = ({ participants, playerColumnTitle }: GroupTableProps) => {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Rank</th>
          <th style={{ ...thStyle, textAlign: 'left' }}>{playerColumnTitle}</th>
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
        {participants.map((gp, index) => (
          <GroupTableRow
            key={getParticipantId(gp)}
            participant={gp}
            rank={index + 1}
          />
        ))}
      </tbody>
    </table>
  )
}

const getParticipantId = (gp: GroupParticipant): string => {
  const participant = gp.participant
  if ('_id' in participant) return String(participant._id)
  return String((participant as Player)._id)
}

interface GroupTableRowProps {
  participant: GroupParticipant
  rank: number
}

const GroupTableRow = ({ participant, rank }: GroupTableRowProps) => {
  const { stats } = participant
  const total = stats.matchesPlayed
  const winPercentage = total > 0 ? ((stats.matchesWon / total) * 100).toFixed(1) : '0.0'
  const playerDisplay = getPlayerDisplay(participant)
  const difference = stats.matchesWon - stats.matchesLost
  const differenceDisplay = difference >= 0 ? `+${difference}` : String(difference)

  return (
    <tr>
      <td style={tdStyle}>{rank}</td>
      <td style={{ ...tdStyle, textAlign: 'left' }}>{playerDisplay}</td>
      <td style={tdStyle}>{total}</td>
      <td style={tdStyle}>{stats.matchesWon}</td>
      <td style={tdStyle}>{stats.matchesLost}</td>
      <td style={tdStyle}>{differenceDisplay}</td>
      <td style={tdStyle}>{winPercentage}%</td>
      <td style={tdStyle}>{stats.matchesWon}</td>
      <td style={tdStyle}>{stats.matchesLost}</td>
      <td style={tdStyle}>{stats.gamesWon}</td>
      <td style={tdStyle}>{stats.gamesLost}</td>
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

const KnockoutStageContent = () => {
  return <div style={emptyContentStyle}>Knockout stage display coming soon</div>
}

// Styles
const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: '#f5f5f5',
}

const contentStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
  padding: '20px',
}

const titleStyle: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '28px',
  fontWeight: 700,
  color: '#333',
  marginBottom: '20px',
}

const eventContentStyle: React.CSSProperties = {
  marginTop: '20px',
}

const tabsContainerStyle: React.CSSProperties = {
  display: 'flex',
  gap: '4px',
  borderBottom: '1px solid #ddd',
  marginBottom: '20px',
}

const groupsListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '24px',
}

const generateGroupsStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
}

const groupContainerStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  borderRadius: '8px',
  padding: '20px',
  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
}

const groupTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 700,
  color: '#333',
  marginBottom: '16px',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
}

const thStyle: React.CSSProperties = {
  padding: '12px 8px',
  textAlign: 'center',
  borderBottom: '2px solid #ddd',
  backgroundColor: '#f9f9f9',
  fontWeight: 700,
  color: '#333',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 8px',
  textAlign: 'center',
  borderBottom: '1px solid #eee',
}

const emptyContentStyle: React.CSSProperties = {
  padding: '40px',
  textAlign: 'center',
  color: '#666',
}

const matchScheduleContainerStyle: React.CSSProperties = {
  marginTop: '16px',
  borderTop: '1px solid #eee',
  paddingTop: '12px',
}

const collapsibleHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '8px 0',
  fontSize: '14px',
  color: '#666',
}

const collapsibleTitleStyle: React.CSSProperties = {
  fontWeight: 600,
}

const matchScheduleContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '12px',
}

const matchRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  padding: '8px 12px',
  backgroundColor: '#f9f9f9',
  borderRadius: '4px',
}

const matchResultStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  fontSize: '14px',
}

const matchLeftSideStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '8px',
  flex: 1,
}

const matchRightSideStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '8px',
  flex: 1,
}

const scoreSeparatorStyle: React.CSSProperties = {
  color: '#666',
  padding: '0 8px',
}

const boldScoreStyle: React.CSSProperties = {
  fontWeight: 700,
}

const normalScoreStyle: React.CSSProperties = {
  fontWeight: 400,
}

const boldTextStyle: React.CSSProperties = {
  fontWeight: 700,
}

const normalTextStyle: React.CSSProperties = {
  fontWeight: 400,
}

const gameScoresStyle: React.CSSProperties = {
  fontSize: '12px',
  color: '#666',
  paddingLeft: '4px',
}

const gameScoreSeparatorStyle: React.CSSProperties = {
  margin: '0 2px',
}

const gameDelimiterStyle: React.CSSProperties = {
  marginRight: '8px',
}

export default EventManage
