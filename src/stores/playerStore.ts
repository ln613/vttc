import { createStore } from 'solid-js/store'
import type { Player } from '../../shared/types/Player'
import { api } from '../utils/api'

interface PlayerState {
  data: Player[] | null
  loading: boolean
  error: string | null
  search: string
}

const getInitialState = (): PlayerState => ({
  data: null,
  loading: false,
  error: null,
  search: '',
})

const [playerState, setPlayerState] = createStore<PlayerState>(getInitialState())

export { playerState }

const matchesSearch = (player: Player, term: string): boolean => {
  const lower = term.toLowerCase()
  return (
    (player.firstName || '').toLowerCase().includes(lower) ||
    (player.lastName || '').toLowerCase().includes(lower)
  )
}

const sortByRatingDesc = (a: Player, b: Player): number => b.rating - a.rating

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

  setSearch: (search: string) => {
    setPlayerState({ search })
  },

  filteredPlayers: (): Player[] => {
    const players = playerState.data
    if (!players) return []
    const term = playerState.search.trim()
    const filtered = term
      ? players.filter((p) => matchesSearch(p, term))
      : [...players]
    return filtered.sort(sortByRatingDesc)
  },

  reset: () => setPlayerState(getInitialState()),
}
