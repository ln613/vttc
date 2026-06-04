import { createStore } from 'solid-js/store'
import type {
  TableAssignment,
  MatchQueueItem,
  LiveScoreData,
} from '../../shared/types/Table'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import { authState } from './authStore'
import {
  subscribeToLiveScoreUpdates,
  type EventSubscription,
} from '../utils/pusher'

interface LiveScoreState {
  tables: TableAssignment[]
  matchQueue: MatchQueueItem[]
  activeSessionMatchIds: string[]
  loading: boolean
  error: string | null
}

const getInitialState = (): LiveScoreState => ({
  tables: [],
  matchQueue: [],
  activeSessionMatchIds: [],
  loading: false,
  error: null,
})

const [liveScoreState, setLiveScoreState] =
  createStore<LiveScoreState>(getInitialState())

let subscription: EventSubscription | null = null
// Periodic refetch ensures auto-start (group/schedule generation + queue
// rebuild) fires once an event's start time passes, even when no pusher
// event has been emitted by a write in the meantime.
const LIVE_SCORE_HEARTBEAT_MS = 60_000
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

export { liveScoreState }

const fetchLiveScore = async () => {
  try {
    const data = await apiGet<LiveScoreData>('liveScore')
    setLiveScoreState({
      tables: data.tables || [],
      matchQueue: data.matchQueue || [],
      activeSessionMatchIds: data.activeSessionMatchIds || [],
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

const startSubscription = () => {
  stopUpdates()
  subscription = subscribeToLiveScoreUpdates(() => {
    void fetchLiveScore()
  })
  // The heartbeat keeps the server's auto-start logic firing even when
  // no writes are happening — one admin viewer is enough, so gate it to
  // admins to avoid every connected client polling once a minute.
  if (authState.isAdmin) {
    heartbeatTimer = setInterval(() => {
      void fetchLiveScore()
    }, LIVE_SCORE_HEARTBEAT_MS)
  }
}

const stopUpdates = () => {
  if (subscription) {
    subscription.unsubscribe()
    subscription = null
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

const getPlayerIdsOnTables = (): Set<string> => {
  const ids = new Set<string>()
  for (const table of liveScoreState.tables) {
    if (table.status !== 'assigned' || !table.match) continue
    const match = table.match.match
    if (!match) continue
    addPlayerIds(match.side1 || [], ids)
    addPlayerIds(match.side2 || [], ids)
  }
  return ids
}

const addPlayerIds = (players: Player[], ids: Set<string>) => {
  for (const p of players) {
    if (p._id) ids.add(p._id.toString())
  }
}

const hasPlayerConflict = (
  item: MatchQueueItem,
  playersOnTables: Set<string>,
): boolean => {
  const match = item.match
  if (!match) return false
  for (const p of match.side1 || []) {
    if (p._id && playersOnTables.has(p._id.toString())) return true
  }
  for (const p of match.side2 || []) {
    if (p._id && playersOnTables.has(p._id.toString())) return true
  }
  return false
}

const isSideOnTable = (players: Player[]): boolean => {
  const playersOnTables = getPlayerIdsOnTables()
  for (const p of players) {
    if (p._id && playersOnTables.has(p._id.toString())) return true
  }
  return false
}

export const liveScoreActions = {
  fetchLiveScore: async () => {
    setLiveScoreState({ loading: true, error: null })
    await fetchLiveScore()
    startSubscription()
  },

  stopUpdates,

  getTable: (tableNumber: number): TableAssignment | undefined =>
    liveScoreState.tables.find((t) => t.tableNumber === tableNumber),

  getAssignedTables: (): TableAssignment[] =>
    liveScoreState.tables.filter((t) => t.status === 'assigned'),

  getAvailableTables: (): TableAssignment[] =>
    liveScoreState.tables.filter((t) => t.status === 'available'),

  postponeMatch: async (eventId: string, matchId: string, minutes: number) => {
    await apiPost('postponeMatch', { _id: eventId, matchId, minutes })
  },

  cancelMatch: async (eventId: string, matchId: string) => {
    await apiPost('cancelMatch', { _id: eventId, matchId })
  },

  assignMatchToTable: async (
    eventId: string,
    matchId: string,
    tableNumber: number,
  ) => {
    await apiPost('assignMatchToTable', {
      _id: eventId,
      matchId,
      tableNumber,
    })
    await fetchLiveScore()
  },

  isMatchInQueue: (matchId: string): boolean =>
    liveScoreState.matchQueue.some(
      (item) => item.matchId?.toString() === matchId.toString(),
    ),

  isMatchSessionActive: (matchId: string): boolean =>
    liveScoreState.activeSessionMatchIds.some(
      (id) => id.toString() === matchId.toString(),
    ),

  getTableForMatch: (matchId: string): number | undefined => {
    for (const table of liveScoreState.tables) {
      if (table.status !== 'assigned' || !table.match) continue
      if (table.match.matchId?.toString() === matchId.toString()) {
        return table.tableNumber
      }
    }
    return undefined
  },

  getAssignedMatchIds: (): Set<string> => {
    const ids = new Set<string>()
    for (const table of liveScoreState.tables) {
      if (table.status !== 'assigned' || !table.match) continue
      if (table.match.matchId) ids.add(table.match.matchId.toString())
    }
    return ids
  },

  isMatchPlayable: (item: MatchQueueItem): boolean => {
    const playersOnTables = getPlayerIdsOnTables()
    return !hasPlayerConflict(item, playersOnTables)
  },

  isSideOnTable: (players: Player[]): boolean => isSideOnTable(players),

  isPlayerOnTable: (playerId: string | undefined): boolean => {
    if (!playerId) return false
    return getPlayerIdsOnTables().has(playerId.toString())
  },

  reset: () => {
    stopUpdates()
    setLiveScoreState(getInitialState())
  },
}
