import type { StagesType, TournamentType } from '../../shared/types'
import { apiGet } from '../utils/api'
import { createStore, createAsyncState, type AsyncState } from './createStore'

export interface Tournament {
  _id: string
  name: string
  type: TournamentType
  stages: ('group' | 'knockout')[]
  stagesType: StagesType
}

interface TournamentState extends AsyncState<Tournament[]> {}

const tournamentStore = createStore<TournamentState>(createAsyncState<Tournament[]>())

export const {
  useStore: useTournamentStore,
  useSelector: useTournamentSelector,
  getState: getTournamentState,
} = tournamentStore

export const tournamentActions = {
  fetchTournaments: async () => {
    const state = tournamentStore.getState()
    if (state.data || state.loading) return

    setLoadingState()
    try {
      const data = await apiGet<Tournament[]>('tournaments')
      setSuccessState(data)
    } catch (err) {
      setErrorState(err)
    }
  },

  getTournamentById: (_id: string): Tournament | undefined => {
    const state = tournamentStore.getState()
    return state.data?.find((t) => t._id === _id)
  },
}

const setLoadingState = () =>
  tournamentStore.setState({ loading: true, error: null })

const setSuccessState = (data: Tournament[]) =>
  tournamentStore.setState({ data, loading: false, error: null })

const setErrorState = (err: unknown) =>
  tournamentStore.setState({
    loading: false,
    error: err instanceof Error ? err.message : 'Failed to fetch tournaments',
  })
