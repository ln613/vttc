import React, { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import { apiGet, apiPost } from '../utils/api'
import type { Player } from '../../shared/types/Player'
import type { Event, Participant, TournamentType } from '../../shared/types/Tournament'

interface EventOption {
  id: string
  eventName: string
  nop: number
  maxParticipants: number
  type: TournamentType
  topPlayersRatingEnabled: boolean
  topPlayersCount?: number
  participants: Participant[]
  hasSchedule?: boolean
  date: string
}

interface AddParticipantDialogProps {
  nop: number
  players: Player[]
  onSave: (playerIds: string[]) => void
  onCancel: () => void
}

const AddParticipantDialog: React.FC<AddParticipantDialogProps> = ({
  nop,
  players,
  onSave,
  onCancel,
}) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    Array(nop).fill(''),
  )

  const handlePlayerChange = (index: number, playerId: string) => {
    const newIds = [...selectedPlayerIds]
    newIds[index] = playerId
    setSelectedPlayerIds(newIds)
  }

  const handleSave = () => {
    const confirmed = window.confirm('Are you sure you want to add this participant?')
    if (confirmed) {
      onSave(selectedPlayerIds.filter((id) => id !== ''))
    }
  }

  const playerOptions = players
    .sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .map((p) => ({
      value: p.id,
      label: `${p.firstName} ${p.lastName} - ${p.rating || 0}`,
    }))

  const dialogOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const dialogStyle: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    minWidth: '400px',
    maxWidth: '500px',
  }

  const dialogTitleStyle: React.CSSProperties = {
    fontSize: '1.5rem',
    fontWeight: 700,
    marginBottom: '24px',
    color: '#333',
  }

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '16px',
    marginTop: '24px',
    justifyContent: 'flex-end',
  }

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <h2 style={dialogTitleStyle}>Add Participant</h2>
        {Array.from({ length: nop }, (_, index) => (
          <Select
            key={index}
            label={`Player ${index + 1}`}
            name={`player-${index}`}
            value={selectedPlayerIds[index]}
            onChange={(value) => handlePlayerChange(index, value)}
            options={playerOptions}
          />
        ))}
        <div style={buttonContainerStyle}>
          <Button color="#e74c3c" onClick={onCancel}>
            Cancel
          </Button>
          <Button color="#27ae60" onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

const EventParticipantEdit: React.FC = () => {
  const [events, setEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsData, playersData] = await Promise.all([
          apiGet<EventOption[]>('events'),
          apiGet<Player[]>('players'),
        ])
        setEvents(eventsData)
        setPlayers(playersData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId)
      setSelectedEvent(event || null)
    } else {
      setSelectedEvent(null)
    }
  }, [selectedEventId, events])

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 3000)
  }

  const handleAddParticipant = async (playerIds: string[]) => {
    if (!selectedEvent) return

    try {
      await apiPost('addParticipant', {
        tournamentId: selectedEvent.id,
        playerIds,
      })
      showToast('success', 'Participant added successfully')
      setShowAddDialog(false)
      // Refresh events to get updated participants
      const eventsData = await apiGet<EventOption[]>('events')
      setEvents(eventsData)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to add participant')
    }
  }

  const handleDeleteParticipant = async (participantId: string) => {
    if (!selectedEvent) return

    const confirmed = window.confirm('Are you sure you want to delete this participant?')
    if (!confirmed) return

    try {
      await apiPost('deleteParticipant', {
        tournamentId: selectedEvent.id,
        participantId,
      })
      showToast('success', 'Participant deleted successfully')
      // Refresh events to get updated participants
      const eventsData = await apiGet<EventOption[]>('events')
      setEvents(eventsData)
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Failed to delete participant')
    }
  }

  const canShowDeleteColumn = (): boolean => {
    if (!selectedEvent) return false
    const eventDate = new Date(selectedEvent.date)
    const now = new Date()
    return !selectedEvent.hasSchedule && eventDate > now
  }

  const isAddDisabled = (): boolean => {
    if (!selectedEvent) return true
    return (
      selectedEvent.maxParticipants > 0 &&
      selectedEvent.participants.length >= selectedEvent.maxParticipants
    )
  }

  const getParticipantsCountText = (): string => {
    if (!selectedEvent) return ''
    const count = selectedEvent.participants.length
    if (selectedEvent.maxParticipants === 0) {
      return `List of participants - ${count}`
    }
    return `List of participants - ${count} / ${selectedEvent.maxParticipants}`
  }

  const calculateCombinedRating = (participant: Participant): number => {
    return participant.players.reduce((sum, p) => sum + (p.rating || 0), 0)
  }

  const calculateTopNCombinedRating = (
    participant: Participant,
    topN: number,
  ): number => {
    const sortedPlayers = [...participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
    return sortedPlayers
      .slice(0, topN)
      .reduce((sum, p) => sum + (p.rating || 0), 0)
  }

  const eventOptions = events.map((e) => ({
    value: e.id,
    label: e.eventName,
  }))

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  }

  const contentStyle: React.CSSProperties = {
    padding: '24px',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: 700,
    textAlign: 'left',
    marginBottom: '24px',
    color: '#333',
  }

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    marginTop: '24px',
    marginBottom: '8px',
    color: '#333',
    textAlign: 'left',
  }

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '16px',
  }

  const thStyle: React.CSSProperties = {
    padding: '12px',
    textAlign: 'left',
    borderBottom: '2px solid #ddd',
    backgroundColor: '#f8f9fa',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px',
    borderBottom: '1px solid #eee',
  }

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    borderRadius: '8px',
    color: 'white',
    fontWeight: 500,
    zIndex: 1001,
    backgroundColor: toastMessage?.type === 'success' ? '#27ae60' : '#e74c3c',
  }

  const renderSingleParticipantTable = () => {
    if (!selectedEvent) return null

    const sortedParticipants = [...selectedEvent.participants].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
    const showDelete = canShowDeleteColumn()

    return (
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Player</th>
            <th style={thStyle}>Rating</th>
            {showDelete && <th style={thStyle}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {sortedParticipants.map((participant) => (
            <tr key={participant.id}>
              <td style={tdStyle}>
                {participant.players[0]?.firstName} {participant.players[0]?.lastName}
              </td>
              <td style={tdStyle}>{participant.players[0]?.rating || 0}</td>
              {showDelete && (
                <td style={tdStyle}>
                  <Button
                    color="#e74c3c"
                    onClick={() => handleDeleteParticipant(participant.id)}
                  >
                    Delete
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const renderDoubleOrTeamParticipantTable = () => {
    if (!selectedEvent) return null

    const sortedParticipants = [...selectedEvent.participants].sort(
      (a, b) => calculateCombinedRating(b) - calculateCombinedRating(a),
    )
    const showDelete = canShowDeleteColumn()
    const isTeam = selectedEvent.type === 'Team'
    const showTopNCombined =
      isTeam && selectedEvent.topPlayersRatingEnabled && selectedEvent.topPlayersCount

    return (
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Players</th>
            <th style={thStyle}>Rating</th>
            <th style={thStyle}>Combined Rating</th>
            {showTopNCombined && (
              <th style={thStyle}>Top {selectedEvent.topPlayersCount} Combined</th>
            )}
            {showDelete && <th style={thStyle}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {sortedParticipants.map((participant) => {
            const sortedPlayers = [...participant.players].sort(
              (a, b) => (b.rating || 0) - (a.rating || 0),
            )
            const combinedRating = calculateCombinedRating(participant)
            const topNCombined = showTopNCombined
              ? calculateTopNCombinedRating(participant, selectedEvent.topPlayersCount!)
              : null

            return sortedPlayers.map((player, index) => (
              <tr key={`${participant.id}-${player.id}`}>
                <td style={tdStyle}>
                  {player.firstName} {player.lastName}
                </td>
                <td style={tdStyle}>{player.rating || 0}</td>
                {index === 0 ? (
                  <td
                    style={{ ...tdStyle, verticalAlign: 'middle' }}
                    rowSpan={sortedPlayers.length}
                  >
                    {combinedRating}
                  </td>
                ) : null}
                {showTopNCombined &&
                  (index === 0 ? (
                    <td
                      style={{ ...tdStyle, verticalAlign: 'middle' }}
                      rowSpan={sortedPlayers.length}
                    >
                      {topNCombined}
                    </td>
                  ) : null)}
                {showDelete &&
                  (index === 0 ? (
                    <td
                      style={{ ...tdStyle, verticalAlign: 'middle' }}
                      rowSpan={sortedPlayers.length}
                    >
                      <Button
                        color="#e74c3c"
                        onClick={() => handleDeleteParticipant(participant.id)}
                      >
                        Delete
                      </Button>
                    </td>
                  ) : null)}
              </tr>
            ))
          })}
        </tbody>
      </table>
    )
  }

  const renderParticipantsTable = () => {
    if (!selectedEvent) return null

    if (selectedEvent.nop === 1) {
      return renderSingleParticipantTable()
    }
    return renderDoubleOrTeamParticipantTable()
  }

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Edit Event Participants</h1>
        <Select
          label="Event"
          name="event"
          value={selectedEventId}
          onChange={setSelectedEventId}
          options={eventOptions}
        />
        {selectedEvent && (
          <>
            <div style={{ marginTop: '16px' }}>
              <Button
                color="#3498db"
                onClick={() => setShowAddDialog(true)}
                disabled={isAddDisabled()}
              >
                Add Participant
              </Button>
            </div>
            <h3 style={sectionTitleStyle}>{getParticipantsCountText()}</h3>
            {renderParticipantsTable()}
          </>
        )}
      </div>

      {showAddDialog && selectedEvent && (
        <AddParticipantDialog
          nop={selectedEvent.nop}
          players={players}
          onSave={handleAddParticipant}
          onCancel={() => setShowAddDialog(false)}
        />
      )}

      {toastMessage && <div style={toastStyle}>{toastMessage.text}</div>}
    </div>
  )
}

export default EventParticipantEdit
