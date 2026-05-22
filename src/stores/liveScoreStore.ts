import { createStore } from 'solid-js/store'
import type {
  TableAssignment,
  MatchQueueItem,
  LiveScoreData,
} from '../../shared/types/Table'
import { apiGet } from '../utils/api'

interface LiveScoreState {
  tables: TableAssignment[]
  matchQueue: MatchQueueItem[]
  loading: boolean
  error: string | null
}

const getInitialState = (): LiveScoreState => ({
  tables: [],
  matchQueue: [],
  loading: false,
  error: null,
})

const [liveScoreState, setLiveScoreState] =
  createStore<LiveScoreState>(getInitialState())

let pollingInterval: ReturnType<typeof setInterval> | null = null
const POLL_INTERVAL_MS = 5000

export { liveScoreState }

const fetchLiveScore = async () => {
  try {
    const data = await apiGet<LiveScoreData>('liveScore')
    setLiveScoreState({
      tables: data.tables || [],
      matchQueue: data.matchQueue || [],
      loading: false,
      error: null,
    })
  } catch (err) {
    setLiveScoreState({
      loading: false,
      error: err instanceof Error ? err.message : 'Failed to fetch live score',
    })
  }
}

const startPolling = () => {
  stopPolling()
  pollingInterval = setInterval(fetchLiveScore, POLL_INTERVAL_MS)
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

export const liveScoreActions = {
  fetchLiveScore: async () => {
    setLiveScoreState({ loading: true, error: null })
    await fetchLiveScore()
    startPolling()
  },

  stopPolling,

  getTable: (tableNumber: number): TableAssignment | undefined =>
    liveScoreState.tables.find((t) => t.tableNumber === tableNumber),

  getAssignedTables: (): TableAssignment[] =>
    liveScoreState.tables.filter((t) => t.status === 'assigned'),

  getAvailableTables: (): TableAssignment[] =>
    liveScoreState.tables.filter((t) => t.status === 'available'),

  reset: () => {
    stopPolling()
    setLiveScoreState(getInitialState())
  },
}
