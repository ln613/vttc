import { createStore } from 'solid-js/store'
import type {
  TableAssignment,
  MatchQueueItem,
  LiveScoreData,
} from '../../shared/types/Table'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import { authState } from './authStore'
import { createJitteredRefetch } from '../utils/refetch'
import { countCall } from '../utils/counters' // TEMP diagnostic
import {
  subscribeToLiveScoreUpdates,
  type EventSubscription,
} from '../utils/pusher'

interface LiveScoreState {
  tables: TableAssignment[]
  matchQueue: MatchQueueItem[]
  activeSessionMatchIds: string[]
  scorerHeldMatchIds: string[]
  allowPublicUmpire: boolean
  loading: boolean
  error: string | null
}

const getInitialState = (): LiveScoreState => ({
  tables: [],
  matchQueue: [],
  activeSessionMatchIds: [],
  scorerHeldMatchIds: [],
  // Assumed on until the first fetch says otherwise, matching how the app
  // behaved before the setting existed.
  allowPublicUmpire: true,
  loading: false,
  error: null,
})

const [liveScoreState, setLiveScoreState] =
  createStore<LiveScoreState>(getInitialState())

let subscription: EventSubscription | null = null
// Periodic refetch ensures auto-start (group/schedule generation + queue
// rebuild) fires once an event's start time passes, even when no pusher
// event has been emitted by a write in the meantime. The heartbeat lives
// in the LiveScore page (admin only) so other pages don't trigger
// auto-start just by being open.
const LIVE_SCORE_HEARTBEAT_MS = 60_000
let autoStartHeartbeatTimer: ReturnType<typeof setInterval> | null = null

export { liveScoreState }

const fetchLiveScore = async (runAutoStart = false) => {
  countCall('fetchLiveScore') // TEMP diagnostic
  try {
    const data = await apiGet<LiveScoreData>(
      'liveScore',
      runAutoStart ? { runAutoStart: '1' } : undefined,
    )
    setLiveScoreState({
      tables: data.tables || [],
      matchQueue: data.matchQueue || [],
      activeSessionMatchIds: data.activeSessionMatchIds || [],
      scorerHeldMatchIds: data.scorerHeldMatchIds || [],
      allowPublicUmpire: data.allowPublicUmpire !== false,
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

// Broadcast-driven refetches are jittered + de-duplicated so a room full of
// clients doesn't hit the API in the same instant.
const refetchOnBroadcast = createJitteredRefetch(() => fetchLiveScore())

const startSubscription = () => {
  stopUpdates()
  subscription = subscribeToLiveScoreUpdates(() => {
    countCall('broadcast→liveScore') // TEMP diagnostic
    refetchOnBroadcast()
  })
}

const startAutoStartHeartbeat = () => {
  stopAutoStartHeartbeat()
  autoStartHeartbeatTimer = setInterval(() => {
    void fetchLiveScore(true)
  }, LIVE_SCORE_HEARTBEAT_MS)
}

const stopAutoStartHeartbeat = () => {
  if (autoStartHeartbeatTimer) {
    clearInterval(autoStartHeartbeatTimer)
    autoStartHeartbeatTimer = null
  }
}

const stopUpdates = () => {
  stopAutoStartHeartbeat()
  if (subscription) {
    subscription.unsubscribe()
    subscription = null
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

  // Used by the LiveScore page on mount. Auto-start runs only for
  // admins (both on mount and via the 60s heartbeat).
  fetchLiveScoreWithAutoStart: async () => {
    setLiveScoreState({ loading: true, error: null })
    await fetchLiveScore(authState.isAdmin)
    startSubscription()
    if (authState.isAdmin) startAutoStartHeartbeat()
  },

  stopAutoStartHeartbeat,
  stopUpdates,

  getTable: (tableNumber: number): TableAssignment | undefined =>
    liveScoreState.tables.find((t) => t.tableNumber === tableNumber),

  // Is there anything on a table for someone to umpire? A match that is
  // assigned and not finished needs a person at the table, whether it has
  // started or not.
  hasMatchesToUmpire: (): boolean =>
    liveScoreState.tables.some(
      (t) =>
        t.status === 'assigned' &&
        t.match &&
        t.match.matchStatus !== 'finished_unconfirmed' &&
        t.match.match?.winningSide == null,
    ),

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

  // Whether this device could actually take the table, which is not the
  // same question for everyone. A tablet can be the Mirror of a tablet
  // Scorer, so a table with one seat left is open to it; anyone who can
  // only be a Scorer needs that seat free. Asked before the table is
  // offered, so nobody picks a table only to be turned away on arrival.
  canEnterTable: (tableNumber: number): boolean => {
    const matchId = liveScoreActions.getTable(tableNumber)?.match?.matchId
    if (!matchId) return true
    if (authState.isAdmin) return true

    const id = matchId.toString()
    const held = (ids: string[]) => ids.some((x) => x.toString() === id)
    return authState.isTablet
      ? !held(liveScoreState.activeSessionMatchIds)
      : !held(liveScoreState.scorerHeldMatchIds)
  },

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
