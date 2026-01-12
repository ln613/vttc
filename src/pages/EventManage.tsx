import { useEffect } from 'react'
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
    </div>
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

export default EventManage
