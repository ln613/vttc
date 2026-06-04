import { Show, For, createSignal, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import ToggleButton from '../components/ToggleButton'
import Select from '../components/Select'
import Button from '../components/Button'
import FeeInfoDialog from '../components/FeeInfoDialog'
import TeammateSelectDialog from '../components/TeammateSelectDialog'
import { eventListState, eventListActions } from '../stores/eventListStore'
import { parseLocalDate, formatLocalDate } from '../utils/date'
import { authState, authActions } from '../stores/authStore'
import {
  tournamentState,
  tournamentActions,
  type Tournament,
} from '../stores/tournamentStore'
import { apiGet, apiPost } from '../utils/api'
import { eventActions, type EventOption } from '../stores/eventStore'

const EventList = () => {
  const navigate = useNavigate()

  onMount(() => {
    eventListActions.fetchEvents()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <div style={pageHeaderStyle}>
          <h1 style={titleStyle}>Events</h1>
          <ToolsSection />
        </div>
        <EventListContent />
      </div>
      <FeeInfoDialog />
      <TeammateSelectDialog />
    </div>
  )
}

const ToolsSection = () => {
  const navigate = useNavigate()

  return (
    <div style={toolsSectionStyle}>
      <ToggleButton
        label="Today's Events"
        value={eventListState.todayOnly}
        onChange={() => eventListActions.toggleTodayEvents()}
      />
      <Show
        when={
          authActions.isSignedIn() &&
          !authState.isAdmin &&
          !authState.isSuperAdmin
        }
      >
        <ToggleButton
          label="My Events"
          value={eventListState.myEventsOnly}
          onChange={() => eventListActions.toggleMyEvents()}
        />
      </Show>
      <Show when={authState.isAdmin}>
        <button style={addButtonStyle} onClick={() => navigate('/event/new')}>
          +
        </button>
      </Show>
      <Show when={authState.isAdmin && isSimulationEnabled()}>
        <SimulateEventButton />
      </Show>
    </div>
  )
}

const isSimulationEnabled = (): boolean =>
  import.meta.env.VITE_SIMULATION === '1'

const SimulateEventButton = () => {
  const [open, setOpen] = createSignal(false)
  return (
    <>
      <button style={simulateAddButtonStyle} onClick={() => setOpen(true)}>
        +
      </button>
      <Show when={open()}>
        <SimulateEventDialog onClose={() => setOpen(false)} />
      </Show>
    </>
  )
}

const MAX_PARTICIPANTS_OPTIONS = (() => {
  const options = [{ value: 'Unlimited', label: 'Unlimited' }]
  for (let i = 4; i <= 128; i++) {
    options.push({ value: String(i), label: String(i) })
  }
  return options
})()

const groupTournaments = (tournaments: Tournament[]) => ({
  openSingles: tournaments.filter(
    (t) => t.type === 'Single' && t.restriction === 'Open',
  ),
  ratedSingles: tournaments.filter(
    (t) => t.type === 'Single' && t.restriction === 'Rated',
  ),
  agedSingles: tournaments.filter(
    (t) => t.type === 'Single' && t.restriction === 'Age',
  ),
  teams: tournaments.filter((t) => t.type !== 'Single'),
})

const formatTimeNowPlus1Min = (): string => {
  const d = new Date(Date.now() + 60_000)
  let hours = d.getHours()
  const minutes = d.getMinutes()
  const period = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${String(minutes).padStart(2, '0')} ${period}`
}

const SimulateEventDialog = (props: { onClose: () => void }) => {
  const [seriesList, setSeriesList] = createSignal<string[]>([])
  const [selectedSeries, setSelectedSeries] = createSignal('')
  const [selectedTournamentId, setSelectedTournamentId] = createSignal('')
  const [maxParticipants, setMaxParticipants] = createSignal('16')
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)

  onMount(async () => {
    tournamentActions.fetchTournaments()
    try {
      const series = await apiGet<string[]>('eventSeries')
      setSeriesList(series)
      if (series.length > 0) setSelectedSeries(series[0])
    } catch {
      setSeriesList([])
    }
  })

  const groups = () => groupTournaments(tournamentState.data ?? [])

  const seriesOptions = () =>
    seriesList().map((s) => ({ value: s, label: s }))

  const handleSave = async () => {
    const tournamentId = selectedTournamentId()
    if (!tournamentId) {
      setError('Please select a tournament')
      return
    }
    const tournament = tournamentActions.getTournamentById(tournamentId)
    if (!tournament) {
      setError('Tournament not found')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await apiPost('simulateEvent', {
        tournamentId,
        eventSeries: selectedSeries() || undefined,
        maxParticipants:
          maxParticipants() === 'Unlimited' ? 0 : parseInt(maxParticipants(), 10),
        name: `${tournament.name} - test`,
        date: formatLocalDate(new Date()),
        time: formatTimeNowPlus1Min(),
        registrationFee: 30,
      })
      await eventListActions.fetchEvents()
      props.onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to simulate event')
      setSaving(false)
    }
  }

  return (
    <div style={dialogOverlayStyle} onClick={props.onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>Simulate Event</h2>
        <Select
          label="Event Series"
          name="simSeries"
          value={selectedSeries()}
          onChange={setSelectedSeries}
          options={seriesOptions()}
        />
        <div style={tournamentGroupsContainerStyle}>
          <TournamentGroup
            title="Open Singles"
            tournaments={groups().openSingles}
            selectedId={selectedTournamentId()}
            onSelect={setSelectedTournamentId}
          />
          <TournamentGroup
            title="Rated Singles"
            tournaments={groups().ratedSingles}
            selectedId={selectedTournamentId()}
            onSelect={setSelectedTournamentId}
          />
          <TournamentGroup
            title="Aged Singles"
            tournaments={groups().agedSingles}
            selectedId={selectedTournamentId()}
            onSelect={setSelectedTournamentId}
          />
          <TournamentGroup
            title="Teams"
            tournaments={groups().teams}
            selectedId={selectedTournamentId()}
            onSelect={setSelectedTournamentId}
          />
        </div>
        <Select
          label="Max Participants"
          name="simMax"
          value={maxParticipants()}
          onChange={setMaxParticipants}
          options={MAX_PARTICIPANTS_OPTIONS}
        />
        <Show when={error()}>
          <div style={dialogErrorStyle}>{error()}</div>
        </Show>
        <div style={dialogButtonContainerStyle}>
          <Button color="#e74c3c" onClick={props.onClose} disabled={saving()}>
            Cancel
          </Button>
          <Button color="#27ae60" onClick={handleSave} disabled={saving()}>
            {saving() ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const TournamentGroup = (props: {
  title: string
  tournaments: Tournament[]
  selectedId: string
  onSelect: (id: string) => void
}) => (
  <Show when={props.tournaments.length > 0}>
    <div style={tournamentGroupStyle}>
      <div style={tournamentGroupHeaderStyle}>{props.title}</div>
      <div style={tournamentButtonsStyle}>
        <For each={props.tournaments}>
          {(t) => (
            <button
              type="button"
              style={
                t._id === props.selectedId
                  ? tournamentButtonSelectedStyle
                  : tournamentButtonStyle
              }
              onClick={() => props.onSelect(t._id)}
            >
              {t.name}
            </button>
          )}
        </For>
      </div>
    </div>
  </Show>
)

const EventListContent = () => (
  <Show when={!eventListState.loading} fallback={<div>Loading...</div>}>
    <Show
      when={!eventListState.error}
      fallback={<div>{eventListState.error}</div>}
    >
      <div style={listStyle}>
        <For each={eventListActions.sortedEvents()}>
          {(event) => <EventListItem event={event} />}
        </For>
      </div>
    </Show>
  </Show>
)

interface EventListItemProps {
  event: EventOption
}

const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2196F3"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const DeleteIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#e74c3c"
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

const MultiUserIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#2196F3"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const RegisterIcon = (props: { warning?: boolean }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke={props.warning ? '#e67e22' : '#27ae60'}
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
)

const FeeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#e67e22"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 0 1 0 4H8" />
    <line x1="12" y1="18" x2="12" y2="6" />
  </svg>
)

const MultiPlayerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#9b59b6"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const handleIconClick = (
  e: MouseEvent,
  path: string,
  navigate: (path: string) => void,
) => {
  e.stopPropagation()
  navigate(path)
}

const handleRegisterClick = (e: MouseEvent, event: EventOption) => {
  e.stopPropagation()

  if (!authActions.isSignedIn()) {
    authActions.showSignInDialog()
    return
  }

  const blockReason = eventListActions.getRegisterBlockReason(event)
  if (blockReason) {
    window.alert(blockReason)
    return
  }

  const confirmed = window.confirm(
    `Do you want to register for "${event.eventName}"?`,
  )
  if (!confirmed) return

  eventListActions.registerForEvent(event)
}

const shouldShowRegisterIcon = (event: EventOption): boolean => {
  if (authState.isAdmin) return false
  if (eventListActions.isPlayerRegistered(event)) return false
  if (eventListActions.isEventStarted(event)) return false
  return true
}

const shouldShowFeeIcon = (event: EventOption): boolean => {
  if (authState.isAdmin) return false
  return eventListActions.isPlayerUnpaid(event)
}

const shouldShowMultiPlayerIcon = (event: EventOption): boolean => {
  if (authState.isAdmin) return false
  return eventListActions.isPlayerInPartialTeam(event)
}

const handleFeeIconClick = (e: MouseEvent, event: EventOption) => {
  e.stopPropagation()
  eventListActions.showFeeInfo(event)
}

const handleMultiPlayerIconClick = (e: MouseEvent, event: EventOption) => {
  e.stopPropagation()
  eventListActions.showTeammateDialogForManage(event)
}

const EventListItem = (props: EventListItemProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/event/${props.event._id}`)
  }

  return (
    <div
      style={{
        ...itemStyle,
        'background-color': eventListActions.getEventRowColor(props.event),
      }}
      onClick={handleClick}
    >
      <div style={itemContentStyle}>
        <div style={itemNameStyle}>{props.event.eventName}</div>
        <Show when={props.event.eventSeries}>
          <div style={itemSeriesStyle}>{props.event.eventSeries}</div>
        </Show>
        <div style={itemDateTimeStyle}>
          {formatDateTime(props.event.date, props.event.time)}
        </div>
        <div style={participantCountStyle}>
          {eventListActions.getParticipantCountText(props.event)}
        </div>
      </div>
      <div style={actionIconsStyle}>
        <Show when={shouldShowRegisterIcon(props.event)}>
          <div
            style={iconStyle}
            onClick={(e) => handleRegisterClick(e, props.event)}
          >
            <RegisterIcon
              warning={!!eventListActions.getRegisterBlockReason(props.event)}
            />
          </div>
        </Show>
        <Show when={shouldShowFeeIcon(props.event)}>
          <div
            style={iconStyle}
            onClick={(e) => handleFeeIconClick(e, props.event)}
          >
            <FeeIcon />
          </div>
        </Show>
        <Show when={shouldShowMultiPlayerIcon(props.event)}>
          <div
            style={iconStyle}
            onClick={(e) => handleMultiPlayerIconClick(e, props.event)}
          >
            <MultiPlayerIcon />
          </div>
        </Show>
        <Show when={authState.isAdmin}>
          <div
            style={iconStyle}
            onClick={(e) =>
              handleIconClick(
                e,
                `/event/${props.event._id}/edit`,
                navigate,
              )
            }
          >
            <EditIcon />
          </div>
          <div
            style={iconStyle}
            onClick={(e) =>
              handleIconClick(
                e,
                `/event/participants?eventId=${props.event._id}`,
                navigate,
              )
            }
          >
            <MultiUserIcon />
          </div>
        </Show>
        <Show when={authState.isSuperAdmin}>
          <div
            style={iconStyle}
            onClick={async (e) => {
              e.stopPropagation()
              if (
                !confirm(
                  `Delete "${props.event.eventName}"? This cannot be undone.`,
                )
              ) {
                return
              }
              try {
                await eventActions.deleteEvent(props.event._id)
              } catch (err) {
                alert(
                  err instanceof Error
                    ? err.message
                    : 'Failed to delete event',
                )
              }
            }}
          >
            <DeleteIcon />
          </div>
        </Show>
      </div>
    </div>
  )
}

const formatDateTime = (date: string, time?: string): string => {
  if (!date) return ''
  const datePart = formatDate(date)
  const timePart = time || ''
  return timePart ? `${datePart}  ${timePart}` : datePart
}

const formatDate = (date: string): string => {
  const d = parseLocalDate(date)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// Styles
const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f5f5',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  margin: '0 auto',
  padding: '16px 20px 20px',
}

const pageHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  'margin-bottom': '20px',
}

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  margin: '0',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
}

const itemStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  padding: '16px 20px',
  'background-color': '#fff',
  'border-radius': '10px',
  'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.06)',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s ease, transform 0.1s ease',
  border: '1px solid #e8e8e8',
}

const itemContentStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  flex: '1',
}

const itemNameStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#2c3e50',
}

const itemSeriesStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#888',
  'margin-top': '2px',
}

const itemDateTimeStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#555',
  'margin-top': '4px',
}

const actionIconsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
}

const participantCountStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  'font-weight': 500,
  'white-space': 'nowrap',
  'margin-top': '4px',
}

const iconStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  cursor: 'pointer',
  padding: '4px',
  'border-radius': '4px',
  transition: 'background-color 0.2s ease',
}

const toolsSectionStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '12px',
}

const addButtonStyle: JSX.CSSProperties = {
  width: '36px',
  height: '36px',
  'background-color': '#27ae60',
  color: '#fff',
  border: 'none',
  'border-radius': '8px',
  'font-size': '24px',
  cursor: 'pointer',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  padding: '0 0 3px 0',
}

const simulateAddButtonStyle: JSX.CSSProperties = {
  ...addButtonStyle,
  'background-color': '#9b59b6',
}

const dialogOverlayStyle: JSX.CSSProperties = {
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

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '560px',
  'max-height': '90vh',
  'overflow-y': 'auto',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '1.4rem',
  'font-weight': 700,
  'margin-top': 0,
  'margin-bottom': '16px',
  color: '#333',
  'text-align': 'left',
}

const tournamentGroupsContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
  'margin-bottom': '16px',
}

const tournamentGroupStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '6px',
}

const tournamentGroupHeaderStyle: JSX.CSSProperties = {
  'font-size': '13px',
  'font-weight': 700,
  color: '#666',
  'text-transform': 'uppercase',
  'letter-spacing': '0.5px',
}

const tournamentButtonsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: '6px',
}

const tournamentButtonStyle: JSX.CSSProperties = {
  padding: '6px 12px',
  'font-size': '13px',
  'font-weight': 600,
  border: '1px solid #ddd',
  'border-radius': '6px',
  'background-color': '#fff',
  color: '#333',
  cursor: 'pointer',
}

const tournamentButtonSelectedStyle: JSX.CSSProperties = {
  ...tournamentButtonStyle,
  'background-color': '#27ae60',
  'border-color': '#27ae60',
  color: '#fff',
}

const dialogErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'margin-top': '8px',
  'text-align': 'left',
}

const dialogButtonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
  'margin-top': '20px',
  'justify-content': 'flex-end',
}

export default EventList
