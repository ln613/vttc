import { createStore } from 'solid-js/store'
import type {
  TournamentType,
  TournamentRestriction,
  AgeLimitType,
  ParticipantSex,
  Participant,
  Stage,
} from '../../shared/types/Tournament'
import { apiGet, apiPost } from '../utils/api'

export interface EventOption {
  _id: string
  eventName: string
  eventSeries?: string
  nop: number
  maxParticipants: number
  registrationFee?: number
  type: TournamentType
  prize?: number
  topPlayersRatingEnabled: boolean
  topPlayersCount?: number
  participants: Participant[]
  hasSchedule?: boolean
  date: string
  time?: string
  paidPlayerIds: string[]
  restriction?: TournamentRestriction
  ratingLimit?: number
  ageLimitType?: AgeLimitType
  ageLimit?: number
  sex?: ParticipantSex
  stages?: ('group' | 'knockout')[]
  eventStages?: Stage[]
  // Server-computed flag in summary (list) mode, where eventStages is
  // omitted to keep the payload small.
  finished?: boolean
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
  // `full` requests the complete documents (with eventStages) — needed by
  // the Schedule page. The events list omits it for a small summary payload.
  fetchEvents: async (full = false) => {
    setEventState({ loading: true, error: null })
    try {
      const data = await apiGet<EventOption[]>(
        'events',
        full ? { full: 'true' } : {},
      )
      setEventState({ data, loading: false, error: null })
    } catch (err) {
      setEventState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      })
    }
  },

  refreshEvents: async (full = false) => {
    try {
      const data = await apiGet<EventOption[]>(
        'events',
        full ? { full: 'true' } : {},
      )
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

  deleteEvent: async (eventId: string) => {
    await apiPost('deleteEvent', { _id: eventId })
    await eventActions.refreshEvents()
  },

  cloneEvent: async (eventId: string, date: string, time: string) => {
    await apiPost('cloneEvent', { _id: eventId, date, time })
    await eventActions.refreshEvents()
  },

  reset: () => setEventState(getInitialState()),
}
