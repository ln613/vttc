import type { Player } from '../../shared/types/Player'
import { api } from '../utils/api'
import { createStore, createAsyncState, type AsyncState } from './createStore'

interface PlayerState extends AsyncState<Player[]> {}

const playerStore = createStore<PlayerState>(createAsyncState<Player[]>())

export const { useStore: usePlayerStore, useSelector: usePlayerSelector } =
  playerStore

export const playerActions = {
  fetchPlayers: async () => {
    setLoadingState()
    try {
      const data = await api<Player[]>('players')
      setSuccessState(data)
    } catch (err) {
      setErrorState(err)
    }
  },
}

const setLoadingState = () =>
  playerStore.setState({ loading: true, error: null })

const setSuccessState = (data: Player[]) =>
  playerStore.setState({ data, loading: false, error: null })

const setErrorState = (err: unknown) =>
  playerStore.setState({
    loading: false,
    error: err instanceof Error ? err.message : 'Failed to fetch players',
  })
