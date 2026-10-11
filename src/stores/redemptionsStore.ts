import { createStore } from 'solid-js/store'
import { apiGet } from '../utils/api'
import { authState } from './authStore'
import { langActions } from './langStore'

// The Redemption History page: a member's own redemptions, or — for an
// admin — every member's. See specs/pages/Redemptions.md.

export interface Redemption {
  _id: string
  playerId: string
  playerName: string
  clubId: string
  giftName: string
  giftPoints: number
  quantity: number
  points: number
  pointsAfter: number
  redeemedBy: string
  createdAt: string
}

interface RedemptionsState {
  redemptions: Redemption[]
  // The member's own points (their history only).
  points: number | null
  loading: boolean
  error: string | null
  search: string
}

const getInitialState = (): RedemptionsState => ({
  redemptions: [],
  points: null,
  loading: false,
  error: null,
  search: '',
})

const [redemptionsState, setRedemptionsState] =
  createStore<RedemptionsState>(getInitialState())

export { redemptionsState }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

// An admin sees the club's whole history; anyone else their own.
const showsAll = (): boolean => authState.isAdmin

const fetchMine = async () => {
  const data = await apiGet<{ points: number; redemptions: Redemption[] }>(
    'myRedemptions',
  )
  setRedemptionsState({ redemptions: data.redemptions, points: data.points })
}

const fetchAll = async () => {
  setRedemptionsState({
    redemptions: await apiGet<Redemption[]>('redemptions'),
    points: null,
  })
}

const load = async () => {
  setRedemptionsState({ loading: true, error: null })
  try {
    await (showsAll() ? fetchAll() : fetchMine())
    setRedemptionsState({ loading: false })
  } catch (err) {
    setRedemptionsState({
      loading: false,
      error: errorMessage(err, langActions.t('redemptions.loadFailed')),
    })
  }
}

const setSearch = (search: string) => setRedemptionsState({ search })

const matchesSearch = (r: Redemption, words: string[]) => {
  const text = `${r.playerName} ${r.clubId} ${r.giftName}`.toLowerCase()
  return words.every((w) => text.includes(w))
}

/** The list as shown: filtered by the admin's search. */
const shown = (): Redemption[] => {
  const words = redemptionsState.search
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  return words.length
    ? redemptionsState.redemptions.filter((r) => matchesSearch(r, words))
    : redemptionsState.redemptions
}

const reset = () => setRedemptionsState(getInitialState())

export const redemptionsActions = { showsAll, load, setSearch, shown, reset }
