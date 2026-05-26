import { createStore } from 'solid-js/store'
import type { EventOption } from './eventStore'
import { eventState, eventActions } from './eventStore'
import { authState } from './authStore'

interface EventListState {
  loading: boolean
  error: string | null
  myEventsOnly: boolean
}

const getInitialState = (): EventListState => ({
  loading: false,
  error: null,
  myEventsOnly: false,
})

const [eventListState, setEventListState] =
  createStore<EventListState>(getInitialState())

export { eventListState }

const sortedEvents = (): EventOption[] => {
  if (!eventState.data) return []
  const events = eventListState.myEventsOnly
    ? filterMyEvents(eventState.data)
    : eventState.data
  return [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

const filterMyEvents = (events: EventOption[]): EventOption[] => {
  const userId = authState.user?._id
  if (!userId) return []
  return events.filter((event) => isPlayerInEvent(event, userId))
}

const isPlayerInEvent = (event: EventOption, playerId: string): boolean =>
  event.participants?.some((participant) =>
    participant.players?.some((player) => player._id.toString() === playerId.toString()),
  ) ?? false

const toggleMyEvents = () => {
  setEventListState('myEventsOnly', !eventListState.myEventsOnly)
}

const fetchEvents = async () => {
  setEventListState({ loading: true, error: null })
  try {
    await eventActions.fetchEvents()
    setEventListState({ loading: false })
  } catch (err) {
    setEventListState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch events',
    })
  }
}

export const eventListActions = {
  fetchEvents,
  sortedEvents,
  toggleMyEvents,
  reset: () => setEventListState(getInitialState()),
}
