import { Show, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Button from '../components/Button'
import { eventListState, eventListActions } from '../stores/eventListStore'
import { authState } from '../stores/authStore'
import type { EventOption } from '../stores/eventStore'

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
          <h1 style={titleStyle}>Event List</h1>
          <Show when={authState.isAdmin}>
            <Button color="#27ae60" size="small" onClick={() => navigate('/event/new')}>
              New Event
            </Button>
          </Show>
        </div>
        <EventListContent />
      </div>
    </div>
  )
}

const EventListContent = () => (
  <Show when={!eventListState.loading} fallback={<div>Loading...</div>}>
    <Show when={!eventListState.error} fallback={<div>{eventListState.error}</div>}>
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

const handleIconClick = (e: MouseEvent, path: string, navigate: (path: string) => void) => {
  e.stopPropagation()
  navigate(path)
}

const EventListItem = (props: EventListItemProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/event/${props.event._id}`)
  }

  return (
    <div style={itemStyle} onClick={handleClick}>
      <div style={itemContentStyle}>
        <div style={itemNameStyle}>{props.event.eventName}</div>
        <div style={itemDateTimeStyle}>{formatDateTime(props.event.date, props.event.time)}</div>
      </div>
      <Show when={authState.isAdmin}>
        <div style={actionIconsStyle}>
          <div
            style={iconStyle}
            onClick={(e) => handleIconClick(e, `/event/${props.event._id}/edit`, navigate)}
          >
            <EditIcon />
          </div>
          <div
            style={iconStyle}
            onClick={(e) => handleIconClick(e, `/event/participants?eventId=${props.event._id}`, navigate)}
          >
            <MultiUserIcon />
          </div>
        </div>
      </Show>
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
  const d = new Date(date)
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

const iconStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  cursor: 'pointer',
  padding: '4px',
  'border-radius': '4px',
  transition: 'background-color 0.2s ease',
}

export default EventList
