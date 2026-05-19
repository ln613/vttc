import { Show, For, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import { eventListState, eventListActions } from '../stores/eventListStore'
import { eventState } from '../stores/eventStore'
import type { EventOption } from '../stores/eventStore'

const EventList = () => {
  onMount(() => {
    if (!eventState.data) {
      eventListActions.fetchEvents()
    }
  })

  return (
    <div style={containerStyle}>
      <Header />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Event List</h1>
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

const EventListItem = (props: EventListItemProps) => {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/event/${props.event._id}`)
  }

  const formattedDate = () => formatEventDate(props.event.date)

  return (
    <div style={itemStyle} onClick={handleClick}>
      <div style={itemNameStyle}>{props.event.eventName}</div>
      <div style={itemDateStyle}>{formattedDate()}</div>
    </div>
  )
}

const formatEventDate = (date: string): string => {
  if (!date) return ''
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
  padding: '20px',
}

const titleStyle: JSX.CSSProperties = {
  'text-align': 'left',
  'font-size': '28px',
  'font-weight': 700,
  color: '#333',
  'margin-bottom': '20px',
}

const listStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '12px',
}

const itemStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  padding: '16px 20px',
  'background-color': '#fff',
  'border-radius': '10px',
  'box-shadow': '0 2px 6px rgba(0, 0, 0, 0.06)',
  cursor: 'pointer',
  transition: 'box-shadow 0.2s ease, transform 0.1s ease',
  border: '1px solid #e8e8e8',
}

const itemNameStyle: JSX.CSSProperties = {
  'font-size': '16px',
  'font-weight': 600,
  color: '#2c3e50',
}

const itemDateStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#888',
}

export default EventList
