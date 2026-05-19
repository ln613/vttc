import { createStore } from 'solid-js/store'
import type { EventOption } from './eventStore'
import { eventState, eventActions } from './eventStore'

interface EventListState {
  loading: boolean
  error: string | null
}

const getInitialState = (): EventListState => ({
  loading: false,
  error: null,
})

const [eventListState, setEventListState] =
  createStore<EventListState>(getInitialState())

export { eventListState }

const sortedEvents = (): EventOption[] => {
  if (!eventState.data) return []
  return [...eventState.data].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
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
  reset: () => setEventListState(getInitialState()),
}
