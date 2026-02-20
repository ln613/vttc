import { createStore } from 'solid-js/store'
import type { Player } from '../../shared/types/Player'
import { api } from '../utils/api'

interface PlayerState {
  data: Player[] | null
  loading: boolean
  error: string | null
}

const getInitialState = (): PlayerState => ({
  data: null,
  loading: false,
  error: null,
})

const [playerState, setPlayerState] = createStore<PlayerState>(getInitialState())

export { playerState }

export const playerActions = {
  fetchPlayers: async () => {
    setPlayerState({ loading: true, error: null })
    try {
      const data = await api<Player[]>('players')
      setPlayerState({ data, loading: false, error: null })
    } catch (err) {
      setPlayerState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch players',
      })
    }
  },

  reset: () => setPlayerState(getInitialState()),
}
