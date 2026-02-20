import { createStore } from 'solid-js/store'
import type { TournamentType, Participant } from '../../shared/types/Tournament'
import { apiGet } from '../utils/api'

export interface EventOption {
  _id: string
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

interface EventState {
  data: EventOption[] | null
  loading: boolean
  error: string | null
}

const getInitialState = (): EventState => ({
  data: null,
  loading: false,
  error: null,
})

const [eventState, setEventState] = createStore<EventState>(getInitialState())

export { eventState }

export const eventActions = {
  fetchEvents: async () => {
    setEventState({ loading: true, error: null })
    try {
      const data = await apiGet<EventOption[]>('events')
      setEventState({ data, loading: false, error: null })
    } catch (err) {
      setEventState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      })
    }
  },

  refreshEvents: async () => {
    try {
      const data = await apiGet<EventOption[]>('events')
      setEventState({ data, loading: false, error: null })
    } catch (err) {
      setEventState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      })
    }
  },

  getEventById: (_id: string): EventOption | undefined =>
    eventState.data?.find((e) => e._id === _id),

  reset: () => setEventState(getInitialState()),
}
