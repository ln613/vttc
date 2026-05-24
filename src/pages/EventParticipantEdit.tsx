import { Show, For, onMount, onCleanup, createSignal, type JSX } from 'solid-js'
import { useSearchParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import type { Player } from '../../shared/types/Player'
import type { Participant } from '../../shared/types/Tournament'
import { type EventOption } from '../stores/eventStore'
import { playerState } from '../stores/playerStore'
import {
  eventParticipantEditState,
  eventParticipantEditActions,
  canShowDeleteColumn,
  isAddDisabled,
  getParticipantsCountText,
  calculateCombinedRating,
  calculateTopNCombinedRating,
} from '../stores/eventParticipantEditStore'

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px 24px 24px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  'margin-bottom': '24px',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '2rem',
  'font-weight': 700,
  'text-align': 'left',
  'margin-top': '0',
  'margin-bottom': '0',
  color: '#333',
}

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 700,
  'margin-top': '24px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const tableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
  'margin-top': '16px',
}

const thStyle: JSX.CSSProperties = {
  padding: '12px',
  'text-align': 'left',
  'border-bottom': '2px solid #ddd',
  'background-color': '#f8f9fa',
}

const tdStyle: JSX.CSSProperties = {
  padding: '12px',
  'border-bottom': '1px solid #eee',
  'text-align': 'left',
}

const deleteIconStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  color: '#e74c3c',
  width: '20px',
  height: '20px',
}

const EventParticipantEdit = () => {
  const [searchParams] = useSearchParams()

  onMount(() => {
    eventParticipantEditActions.init(searchParams.eventId as string | undefined)
  })

  onCleanup(() => {
    eventParticipantEditActions.reset()
  })

  const selectedEvent = () => eventParticipantEditActions.getSelectedEvent()

  const toastStyle = (): JSX.CSSProperties => ({
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    'border-radius': '8px',
    color: 'white',
    'font-weight': '500',
    'z-index': 1001,
    'background-color':
      eventParticipantEditState.toastMessage?.type === 'success'
        ? '#27ae60'
        : '#e74c3c',
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <div style={titleRowStyle}>
          <h1 style={titleStyle}>Edit Event Participants</h1>
          <Show when={selectedEvent()}>
            {(event) => (
              <Button
                color="#3498db"
                onClick={eventParticipantEditActions.openAddDialog}
                disabled={isAddDisabled(event())}
              >
                Add Participant
              </Button>
            )}
          </Show>
        </div>
        <Show when={selectedEvent()}>
          {(event) => (
            <>
              <h3 style={sectionTitleStyle}>
                {getParticipantsCountText(event())}
              </h3>
              <ParticipantsTable event={event()} />
            </>
          )}
        </Show>
      </div>

      <Show when={eventParticipantEditState.showAddDialog && selectedEvent()}>
        {(event) => (
          <AddParticipantDialog
            nop={event().nop}
            players={playerState.data || []}
          />
        )}
      </Show>

      <Show when={eventParticipantEditState.toastMessage}>
        <div style={toastStyle()}>
          {eventParticipantEditState.toastMessage!.text}
        </div>
      </Show>
    </div>
  )
}

interface ParticipantsTableProps {
  event: EventOption
}

const ParticipantsTable = (props: ParticipantsTableProps) => (
  <Show
    when={props.event.nop === 1}
    fallback={<DoubleOrTeamParticipantTable event={props.event} />}
  >
    <SingleParticipantTable event={props.event} />
  </Show>
)

interface SingleParticipantTableProps {
  event: EventOption
}

const SingleParticipantTable = (props: SingleParticipantTableProps) => {
  const sortedParticipants = () =>
    [...props.event.participants].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
  const showDelete = () => canShowDeleteColumn(props.event)

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Player</th>
          <th style={thStyle}>Rating</th>
          <Show when={showDelete()}>
            <th style={thStyle}>Action</th>
          </Show>
        </tr>
      </thead>
      <tbody>
        <For each={sortedParticipants()}>
          {(participant, index) => (
            <SingleParticipantRow
              participant={participant}
              showDelete={showDelete()}
              rowIndex={index()}
            />
          )}
        </For>
      </tbody>
    </table>
  )
}

interface SingleParticipantRowProps {
  participant: Participant
  showDelete: boolean
  rowIndex: number
}

const getRowBackgroundColor = (index: number): string =>
  index % 2 === 0 ? 'white' : '#e6e6fa'

interface DeleteIconProps {
  onClick: () => void
}

const DeleteIcon = (props: DeleteIconProps) => (
  <svg
    style={deleteIconStyle}
    onClick={props.onClick}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
)

const SingleParticipantRow = (props: SingleParticipantRowProps) => (
  <tr style={{ 'background-color': getRowBackgroundColor(props.rowIndex) }}>
    <td style={tdStyle}>
      {props.participant.players[0]?.firstName}{' '}
      {props.participant.players[0]?.lastName}
    </td>
    <td style={tdStyle}>{props.participant.players[0]?.rating || 0}</td>
    <Show when={props.showDelete}>
      <td style={tdStyle}>
        <DeleteIcon
          onClick={() =>
            eventParticipantEditActions.deleteParticipant(props.participant._id)
          }
        />
      </td>
    </Show>
  </tr>
)

interface DoubleOrTeamParticipantTableProps {
  event: EventOption
}

const DoubleOrTeamParticipantTable = (
  props: DoubleOrTeamParticipantTableProps,
) => {
  const sortedParticipants = () =>
    [...props.event.participants].sort(
      (a, b) => calculateCombinedRating(b) - calculateCombinedRating(a),
    )
  const showDelete = () => canShowDeleteColumn(props.event)
  const isTeam = () => props.event.type === 'Team'
  const showTopNCombined = () =>
    isTeam() &&
    props.event.topPlayersRatingEnabled &&
    props.event.topPlayersCount

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          <th style={thStyle}>Players</th>
          <th style={thStyle}>Rating</th>
          <th style={thStyle}>Combined Rating</th>
          <Show when={showTopNCombined()}>
            <th style={thStyle}>Top {props.event.topPlayersCount} Combined</th>
          </Show>
          <Show when={showDelete()}>
            <th style={thStyle}>Action</th>
          </Show>
        </tr>
      </thead>
      <tbody>
        <For each={sortedParticipants()}>
          {(participant, index) => (
            <TeamParticipantRows
              participant={participant}
              event={props.event}
              showDelete={showDelete()}
              showTopNCombined={!!showTopNCombined()}
              participantIndex={index()}
            />
          )}
        </For>
      </tbody>
    </table>
  )
}

interface TeamParticipantRowsProps {
  participant: Participant
  event: EventOption
  showDelete: boolean
  showTopNCombined: boolean
  participantIndex: number
}

const TeamParticipantRows = (props: TeamParticipantRowsProps) => {
  const sortedPlayers = () =>
    [...props.participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )
  const combinedRating = () => calculateCombinedRating(props.participant)
  const topNCombined = () =>
    props.showTopNCombined
      ? calculateTopNCombinedRating(
          props.participant,
          props.event.topPlayersCount!,
        )
      : null

  const rowBgColor = getRowBackgroundColor(props.participantIndex)

  return (
    <For each={sortedPlayers()}>
      {(player, index) => (
        <tr style={{ 'background-color': rowBgColor }}>
          <td style={tdStyle}>
            {player.firstName} {player.lastName}
          </td>
          <td style={tdStyle}>{player.rating || 0}</td>
          <Show when={index() === 0}>
            <td
              style={{ ...tdStyle, 'vertical-align': 'middle' }}
              rowSpan={sortedPlayers().length}
            >
              {combinedRating()}
            </td>
          </Show>
          <Show when={props.showTopNCombined && index() === 0}>
            <td
              style={{ ...tdStyle, 'vertical-align': 'middle' }}
              rowSpan={sortedPlayers().length}
            >
              {topNCombined()}
            </td>
          </Show>
          <Show when={props.showDelete && index() === 0}>
            <td
              style={{ ...tdStyle, 'vertical-align': 'middle' }}
              rowSpan={sortedPlayers().length}
            >
              <DeleteIcon
                onClick={() =>
                  eventParticipantEditActions.deleteParticipant(
                    props.participant._id,
                  )
                }
              />
            </td>
          </Show>
        </tr>
      )}
    </For>
  )
}

interface AddParticipantDialogProps {
  nop: number
  players: Player[]
}

const dialogOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': 'white',
  'border-radius': '8px',
  padding: '24px',
  'min-width': '400px',
  'max-width': '500px',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '1.5rem',
  'font-weight': 700,
  'margin-bottom': '24px',
  color: '#333',
}

const buttonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '16px',
  'margin-top': '24px',
  'justify-content': 'flex-end',
}

const AddParticipantDialog = (props: AddParticipantDialogProps) => {
  const [selectedPlayerIds, setSelectedPlayerIds] = createSignal<string[]>(
    Array(props.nop).fill(''),
  )

  const handlePlayerChange = (index: number, playerId: string) => {
    const newIds = [...selectedPlayerIds()]
    newIds[index] = playerId
    setSelectedPlayerIds(newIds)
  }

  const handleSave = () => {
    eventParticipantEditActions.addParticipant(
      selectedPlayerIds().filter((id) => id !== ''),
    )
  }

  const playerOptions = () =>
    [...props.players]
      .sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      })
      .map((p) => ({
        value: p._id,
        label: `${p.firstName} ${p.lastName} - ${p.rating || 0}`,
      }))

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <h2 style={dialogTitleStyle}>Add Participant</h2>
        <For each={Array.from({ length: props.nop }, (_, i) => i)}>
          {(index) => (
            <Select
              label={`Player ${index + 1}`}
              name={`player-${index}`}
              value={selectedPlayerIds()[index]}
              onChange={(value) => handlePlayerChange(index, value)}
              options={playerOptions()}
            />
          )}
        </For>
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
