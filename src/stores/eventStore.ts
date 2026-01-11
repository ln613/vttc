import type { TournamentType, Participant } from '../../shared/types/Tournament'
import { apiGet } from '../utils/api'
import { createStore, createAsyncState, type AsyncState } from './createStore'

export interface EventOption {
  id: string
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

interface EventState extends AsyncState<EventOption[]> {}

const eventStore = createStore<EventState>(createAsyncState<EventOption[]>())

export const {
  useStore: useEventStore,
  useSelector: useEventSelector,
  getState: getEventState,
} = eventStore

export const eventActions = {
  fetchEvents: async () => {
    setLoadingState()
    try {
      const data = await apiGet<EventOption[]>('events')
      setSuccessState(data)
    } catch (err) {
      setErrorState(err)
    }
  },

  refreshEvents: async () => {
    try {
      const data = await apiGet<EventOption[]>('events')
      setSuccessState(data)
    } catch (err) {
      setErrorState(err)
    }
  },

  getEventById: (id: string): EventOption | undefined => {
    const state = eventStore.getState()
    return state.data?.find((e) => e.id === id)
  },
}

const setLoadingState = () =>
  eventStore.setState({ loading: true, error: null })

const setSuccessState = (data: EventOption[]) =>
  eventStore.setState({ data, loading: false, error: null })

const setErrorState = (err: unknown) =>
  eventStore.setState({
    loading: false,
    error: err instanceof Error ? err.message : 'Failed to fetch events',
  })
