import { createStore } from 'solid-js/store'
import { apiGet } from '../utils/api'

export interface HistorySide {
  name: string
  before: number
  change: number
  after: number
}

export interface HistoryGame {
  score1: number
  score2: number
  winningSide?: 1 | 2
}

export interface HistoryRow {
  date: string
  event: string
  winningSide: 1 | 2
  games: HistoryGame[]
  winner: HistorySide
  loser: HistorySide
}

interface HistoryPlayer {
  _id: string
  name: string
  rating: number | null
}

interface HistoryState {
  player: HistoryPlayer | null
  rows: HistoryRow[]
  loading: boolean
  error: string | null
}

const [historyState, setHistoryState] = createStore<HistoryState>({
  player: null,
  rows: [],
  loading: false,
  error: null,
})

export { historyState }

export const historyActions = {
  fetch: async (playerId: string) => {
    if (!playerId) return
    setHistoryState({ loading: true, error: null })
    try {
      const data = await apiGet<{ player: HistoryPlayer | null; rows: HistoryRow[] }>(
        'playerHistory',
        { _id: playerId },
      )
      setHistoryState({
        player: data.player,
        rows: data.rows || [],
        loading: false,
      })
    } catch (err) {
      setHistoryState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load history',
      })
    }
  },
}
