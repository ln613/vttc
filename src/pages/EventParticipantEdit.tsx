import React, { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import type { Player } from '../../shared/types/Player'
import type { Participant } from '../../shared/types/Tournament'
import { useEventStore, type EventOption } from '../stores/eventStore'
import { usePlayerStore } from '../stores/playerStore'
import {
  useEventParticipantEditStore,
  eventParticipantEditActions,
  canShowDeleteColumn,
  isAddDisabled,
  getParticipantsCountText,
  calculateCombinedRating,
  calculateTopNCombinedRating,
} from '../stores/eventParticipantEditStore'

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

const EventParticipantEdit: React.FC = () => {
  const { data: events } = useEventStore()
  const { data: players } = usePlayerStore()
  const { selectedEventId, showAddDialog, toastMessage } =
    useEventParticipantEditStore()

  const selectedEvent = eventParticipantEditActions.getSelectedEvent()

  useEffect(() => {
    eventParticipantEditActions.init()
    return () => eventParticipantEditActions.reset()
  }, [])

  const eventOptions = (events || []).map((e) => ({
    value: e._id,
    label: e.eventName,
  }))

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

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Edit Event Participants</h1>
        <Select
          label="Event"
          name="event"
          value={selectedEventId}
          onChange={eventParticipantEditActions.setSelectedEventId}
          options={eventOptions}
        />
        {selectedEvent && (
          <>
            <div style={{ marginTop: '16px' }}>
              <Button
                color="#3498db"
                onClick={eventParticipantEditActions.openAddDialog}
                disabled={isAddDisabled(selectedEvent)}
              >
                Add Participant
              </Button>
            </div>
            <h3 style={sectionTitleStyle}>
              {getParticipantsCountText(selectedEvent)}
            </h3>
            <ParticipantsTable event={selectedEvent} />
          </>
        )}
      </div>

      {showAddDialog && selectedEvent && (
        <AddParticipantDialog
          nop={selectedEvent.nop}
          players={players || []}
        />
      )}

      {toastMessage && <div style={toastStyle}>{toastMessage.text}</div>}
    </div>
  )
}

interface ParticipantsTableProps {
  event: EventOption
}

const ParticipantsTable: React.FC<ParticipantsTableProps> = ({ event }) => {
  if (event.nop === 1) {
    return <SingleParticipantTable event={event} />
  }
  return <DoubleOrTeamParticipantTable event={event} />
}

interface SingleParticipantTableProps {
  event: EventOption
}

const SingleParticipantTable: React.FC<SingleParticipantTableProps> = ({
  event,
}) => {
  const sortedParticipants = [...event.participants].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0),
  )
  const showDelete = canShowDeleteColumn(event)

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
          <SingleParticipantRow
            key={participant._id}
            participant={participant}
            showDelete={showDelete}
          />
        ))}
      </tbody>
    </table>
  )
}

interface SingleParticipantRowProps {
  participant: Participant
  showDelete: boolean
}

const SingleParticipantRow: React.FC<SingleParticipantRowProps> = ({
  participant,
  showDelete,
}) => (
  <tr>
    <td style={tdStyle}>
      {participant.players[0]?.firstName} {participant.players[0]?.lastName}
    </td>
    <td style={tdStyle}>{participant.players[0]?.rating || 0}</td>
    {showDelete && (
      <td style={tdStyle}>
        <Button
          color="#e74c3c"
          onClick={() =>
            eventParticipantEditActions.deleteParticipant(participant._id)
          }
        >
          Delete
        </Button>
      </td>
    )}
  </tr>
)

interface DoubleOrTeamParticipantTableProps {
  event: EventOption
}

const DoubleOrTeamParticipantTable: React.FC<
  DoubleOrTeamParticipantTableProps
> = ({ event }) => {
  const sortedParticipants = [...event.participants].sort(
    (a, b) => calculateCombinedRating(b) - calculateCombinedRating(a),
  )
  const showDelete = canShowDeleteColumn(event)
  const isTeam = event.type === 'Team'
  const showTopNCombined =
    isTeam && event.topPlayersRatingEnabled && event.topPlayersCount

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Players</th>
          <th style={thStyle}>Rating</th>
          <th style={thStyle}>Combined Rating</th>
          {showTopNCombined && (
            <th style={thStyle}>Top {event.topPlayersCount} Combined</th>
          )}
          {showDelete && <th style={thStyle}>Action</th>}
        </tr>
      </thead>
      <tbody>
        {sortedParticipants.map((participant) => (
          <TeamParticipantRows
            key={participant._id}
            participant={participant}
            event={event}
            showDelete={showDelete}
            showTopNCombined={!!showTopNCombined}
          />
        ))}
      </tbody>
    </table>
  )
}

interface TeamParticipantRowsProps {
  participant: Participant
  event: EventOption
  showDelete: boolean
  showTopNCombined: boolean
}

const TeamParticipantRows: React.FC<TeamParticipantRowsProps> = ({
  participant,
  event,
  showDelete,
  showTopNCombined,
}) => {
  const sortedPlayers = [...participant.players].sort(
    (a, b) => (b.rating || 0) - (a.rating || 0),
  )
  const combinedRating = calculateCombinedRating(participant)
  const topNCombined = showTopNCombined
    ? calculateTopNCombinedRating(participant, event.topPlayersCount!)
    : null

  return (
    <>
      {sortedPlayers.map((player, index) => (
        <tr key={`${participant._id}-${player._id}`}>
          <td style={tdStyle}>
            {player.firstName} {player.lastName}
          </td>
          <td style={tdStyle}>{player.rating || 0}</td>
          {index === 0 && (
            <td
              style={{ ...tdStyle, verticalAlign: 'middle' }}
              rowSpan={sortedPlayers.length}
            >
              {combinedRating}
            </td>
          )}
          {showTopNCombined && index === 0 && (
            <td
              style={{ ...tdStyle, verticalAlign: 'middle' }}
              rowSpan={sortedPlayers.length}
            >
              {topNCombined}
            </td>
          )}
          {showDelete && index === 0 && (
            <td
              style={{ ...tdStyle, verticalAlign: 'middle' }}
              rowSpan={sortedPlayers.length}
            >
              <Button
                color="#e74c3c"
                onClick={() =>
                  eventParticipantEditActions.deleteParticipant(participant._id)
                }
              >
                Delete
              </Button>
            </td>
          )}
        </tr>
      ))}
    </>
  )
}

interface AddParticipantDialogProps {
  nop: number
  players: Player[]
}

const AddParticipantDialog: React.FC<AddParticipantDialogProps> = ({
  nop,
  players,
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
    eventParticipantEditActions.addParticipant(
      selectedPlayerIds.filter((id) => id !== ''),
    )
  }

  const playerOptions = players
    .sort((a, b) => {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .map((p) => ({
      value: p._id,
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
          <Button
            color="#e74c3c"
            onClick={eventParticipantEditActions.closeAddDialog}
          >
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

export default EventParticipantEdit
