import { createStore } from 'solid-js/store'
import type { StagesType, TournamentType } from '../../shared/types'
import { apiGet } from '../utils/api'

export interface Tournament {
  _id: string
  name: string
  type: TournamentType
  stages: ('group' | 'knockout')[]
  stagesType: StagesType
}

interface TournamentState {
  data: Tournament[] | null
  loading: boolean
  error: string | null
}

const getInitialState = (): TournamentState => ({
  data: null,
  loading: false,
  error: null,
})

const [tournamentState, setTournamentState] =
  createStore<TournamentState>(getInitialState())

export { tournamentState }

export const tournamentActions = {
  fetchTournaments: async () => {
    if (tournamentState.data || tournamentState.loading) return

    setTournamentState({ loading: true, error: null })
    try {
      const data = await apiGet<Tournament[]>('tournaments')
      setTournamentState({ data, loading: false, error: null })
    } catch (err) {
      setTournamentState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch tournaments',
      })
    }
  },

  getTournamentById: (_id: string): Tournament | undefined =>
    tournamentState.data?.find((t) => t._id === _id),

  reset: () => setTournamentState(getInitialState()),
}
