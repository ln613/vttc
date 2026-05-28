import { Show, For, onMount, onCleanup, createSignal, type JSX } from 'solid-js'
import { useSearchParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Select from '../components/Select'
import Button from '../components/Button'
import type { Player } from '../../shared/types/Player'
import type { Participant } from '../../shared/types/Tournament'
import { type EventOption } from '../stores/eventStore'
import { playerState, getPerPlayerFee } from '../stores/playerStore'
import { authState } from '../stores/authStore'
import {
  eventParticipantEditState,
  eventParticipantEditActions,
  canShowDeleteColumn,
  isAddDisabled,
  getParticipantsCountText,
  calculateCombinedRating,
  calculateTopNCombinedRating,
  isPlayerPaid,
} from '../stores/eventParticipantEditStore'

// ==================== Styles ====================

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

const iconStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  width: '20px',
  height: '20px',
}

const deleteIconStyle: JSX.CSSProperties = {
  ...iconStyle,
  color: '#e74c3c',
}

const editIconStyle: JSX.CSSProperties = {
  ...iconStyle,
  color: '#3498db',
}

const paymentIconStyle: JSX.CSSProperties = {
  ...iconStyle,
  color: '#27ae60',
}

const actionCellStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '8px',
  'align-items': 'center',
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

const paymentPlayerRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  padding: '12px 0',
  'border-bottom': '1px solid #eee',
}

const paymentFeeStyle: JSX.CSSProperties = {
  'font-weight': 600,
  color: '#333',
  'margin-left': 'auto',
  'margin-right': '12px',
}

// ==================== Icons ====================

const DeleteIcon = (props: { onClick: () => void }) => (
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

const EditIcon = (props: { onClick: () => void }) => (
  <svg
    style={editIconStyle}
    onClick={props.onClick}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const PaymentIcon = (props: { onClick: () => void }) => (
  <svg
    style={paymentIconStyle}
    onClick={props.onClick}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 0 1 0 4H8" />
    <line x1="12" y1="18" x2="12" y2="6" />
  </svg>
)

// ==================== Helpers ====================

const getRowBackgroundColor = (index: number): string =>
  index % 2 === 0 ? 'white' : '#e6e6fa'

const getPlayerNameStyle = (
  event: EventOption,
  playerId: string,
): JSX.CSSProperties => {
  if (!authState.isAdmin) return {}
  if (isPlayerPaid(event, playerId)) return {}
  return { color: 'red' }
}

// ==================== Main Component ====================

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

      <Show
        when={eventParticipantEditState.showParticipantDialog && selectedEvent()}
      >
        {(event) => (
          <ParticipantDialog
            nop={event().nop}
            players={playerState.data || []}
            editingParticipant={eventParticipantEditState.editingParticipant}
          />
        )}
      </Show>

      <Show
        when={eventParticipantEditState.showPaymentDialog && selectedEvent()}
      >
        {(event) => (
          <TeamPaymentDialog
            event={event()}
            participant={eventParticipantEditState.paymentParticipant!}
          />
        )}
      </Show>

      <Show
        when={eventParticipantEditState.showDeleteDialog && selectedEvent()}
      >
        {(event) => (
          <TeamDeleteDialog
            event={event()}
            participant={eventParticipantEditState.deleteParticipant!}
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

// ==================== Participants Table ====================

const ParticipantsTable = (props: { event: EventOption }) => (
  <Show
    when={props.event.nop === 1}
    fallback={<DoubleOrTeamParticipantTable event={props.event} />}
  >
    <SingleParticipantTable event={props.event} />
  </Show>
)

// ==================== Single Participant Table ====================

const SingleParticipantTable = (props: { event: EventOption }) => {
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
          <th style={thStyle}>Action</th>
        </tr>
      </thead>
      <tbody>
        <For each={sortedParticipants()}>
          {(participant, index) => (
            <SingleParticipantRow
              participant={participant}
              event={props.event}
              showDelete={showDelete()}
              rowIndex={index()}
            />
          )}
        </For>
      </tbody>
    </table>
  )
}

const SingleParticipantRow = (props: {
  participant: Participant
  event: EventOption
  showDelete: boolean
  rowIndex: number
}) => {
  const player = () => props.participant.players[0]

  return (
    <tr style={{ 'background-color': getRowBackgroundColor(props.rowIndex) }}>
      <td
        style={{
          ...tdStyle,
          ...getPlayerNameStyle(props.event, player()?._id),
        }}
      >
        {player()?.firstName} {player()?.lastName}
      </td>
      <td style={tdStyle}>{player()?.rating || 0}</td>
      <td style={tdStyle}>
        <div style={actionCellStyle}>
          <Show when={props.showDelete}>
            <DeleteIcon
              onClick={() =>
                eventParticipantEditActions.handleDeleteClick(
                  props.participant,
                )
              }
            />
          </Show>
          <Show when={!isPlayerPaid(props.event, player()?._id)}>
            <PaymentIcon
              onClick={() =>
                eventParticipantEditActions.openPaymentDialog(props.participant)
              }
            />
          </Show>
        </div>
      </td>
    </tr>
  )
}

// ==================== Double/Team Participant Table ====================

const DoubleOrTeamParticipantTable = (props: { event: EventOption }) => {
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
          <th style={thStyle}>Action</th>
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

const TeamParticipantRows = (props: {
  participant: Participant
  event: EventOption
  showDelete: boolean
  showTopNCombined: boolean
  participantIndex: number
}) => {
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

  const wholeTeamPaid = () =>
    props.participant.players.every((player) =>
      isPlayerPaid(props.event, player._id),
    )

  const handlePaymentClick = () => {
    eventParticipantEditActions.openPaymentDialog(props.participant)
  }

  return (
    <For each={sortedPlayers()}>
      {(player, index) => (
        <tr style={{ 'background-color': rowBgColor }}>
          <td
            style={{
              ...tdStyle,
              ...getPlayerNameStyle(props.event, player._id),
            }}
          >
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
          <Show when={index() === 0}>
            <td
              style={{ ...tdStyle, 'vertical-align': 'middle' }}
              rowSpan={sortedPlayers().length}
            >
              <div style={actionCellStyle}>
                <EditIcon
                  onClick={() =>
                    eventParticipantEditActions.openEditDialog(props.participant)
                  }
                />
                <Show when={props.showDelete}>
                  <DeleteIcon
                    onClick={() =>
                      eventParticipantEditActions.handleDeleteClick(
                        props.participant,
                      )
                    }
                  />
                </Show>
                <Show when={!wholeTeamPaid()}>
                  <PaymentIcon onClick={handlePaymentClick} />
                </Show>
              </div>
            </td>
          </Show>
        </tr>
      )}
    </For>
  )
}

// ==================== Participant Dialog ====================

const ParticipantDialog = (props: {
  nop: number
  players: Player[]
  editingParticipant: Participant | null
}) => {
  const isEditMode = () => props.editingParticipant !== null

  const getInitialPlayerIds = (): string[] => {
    if (props.editingParticipant) {
      return props.editingParticipant.players.map((p) => p._id)
    }
    return Array(props.nop).fill('')
  }

  const [selectedPlayerIds, setSelectedPlayerIds] = createSignal<string[]>(
    getInitialPlayerIds(),
  )

  const handlePlayerChange = (index: number, playerId: string) => {
    const newIds = [...selectedPlayerIds()]
    newIds[index] = playerId
    setSelectedPlayerIds(newIds)
  }

  const handleSave = () => {
    const playerIds = selectedPlayerIds().filter((id) => id !== '')
    if (isEditMode()) {
      eventParticipantEditActions.editParticipant(
        props.editingParticipant!._id,
        playerIds,
      )
    } else {
      eventParticipantEditActions.addParticipant(playerIds)
    }
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
        <h2 style={dialogTitleStyle}>
          {isEditMode() ? 'Edit Participant' : 'Add Participant'}
        </h2>
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
            onClick={eventParticipantEditActions.closeParticipantDialog}
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

// ==================== Team Payment Dialog ====================

const TeamPaymentDialog = (props: {
  event: EventOption
  participant: Participant
}) => {
  const sortedPlayers = () =>
    [...props.participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )

  const unpaidPlayerIds = () =>
    props.participant.players
      .filter((p) => !isPlayerPaid(props.event, p._id))
      .map((p) => p._id)

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <h2 style={dialogTitleStyle}>Payment</h2>
        <For each={sortedPlayers()}>
          {(player) => (
            <div style={paymentPlayerRowStyle}>
              <span
                style={
                  isPlayerPaid(props.event, player._id)
                    ? { color: '#27ae60' }
                    : {}
                }
              >
                {player.firstName} {player.lastName}
                {isPlayerPaid(props.event, player._id) ? ' ✓' : ''}
              </span>
              <span style={paymentFeeStyle}>${getPerPlayerFee(props.event)}</span>
              <Show when={!isPlayerPaid(props.event, player._id)}>
                <Button
                  color="#27ae60"
                  onClick={() =>
                    eventParticipantEditActions.paymentReceivedForTeamPlayer(
                      player._id,
                    )
                  }
                >
                  Confirm
                </Button>
              </Show>
            </div>
          )}
        </For>
        <div style={buttonContainerStyle}>
          <Show when={props.event.nop > 1 && unpaidPlayerIds().length > 0}>
            <Button
              color="#27ae60"
              onClick={() =>
                eventParticipantEditActions.paymentReceivedForAllTeamPlayers(
                  unpaidPlayerIds(),
                )
              }
            >
              Confirm All
            </Button>
          </Show>
          <Button
            color="#e74c3c"
            onClick={eventParticipantEditActions.closePaymentDialog}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

// ==================== Team Delete Dialog ====================

const TeamDeleteDialog = (props: {
  event: EventOption
  participant: Participant
}) => {
  const sortedPlayers = () =>
    [...props.participant.players].sort(
      (a, b) => (b.rating || 0) - (a.rating || 0),
    )

  return (
    <div style={dialogOverlayStyle}>
      <div style={dialogStyle}>
        <h2 style={dialogTitleStyle}>Delete Team Players</h2>
        <For each={sortedPlayers()}>
          {(player) => (
            <div style={paymentPlayerRowStyle}>
              <span>
                {player.firstName} {player.lastName}
              </span>
              <Button
                color="#e74c3c"
                onClick={() =>
                  eventParticipantEditActions.deletePlayerFromTeam(
                    props.participant._id,
                    player._id,
                  )
                }
              >
                Delete
              </Button>
            </div>
          )}
        </For>
        <div style={buttonContainerStyle}>
          <Button
            color="#e74c3c"
            onClick={() =>
              eventParticipantEditActions.deleteWholeParticipant(
                props.participant._id,
              )
            }
          >
            Delete All
          </Button>
          <Button
            color="#999"
            onClick={eventParticipantEditActions.closeDeleteDialog}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EventParticipantEdit
