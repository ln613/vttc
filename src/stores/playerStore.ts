import { createStore } from 'solid-js/store'
import type { Player } from '../../shared/types/Player'
import { api, apiPost } from '../utils/api'
import { authState } from './authStore'
import { eventState, eventActions, type EventOption } from './eventStore'

interface ToastMessage {
  type: 'success' | 'error'
  text: string
}

interface PlayerState {
  data: Player[] | null
  loading: boolean
  error: string | null
  search: string
  paymentPlayer: Player | null
  toastMessage: ToastMessage | null
}

const getInitialState = (): PlayerState => ({
  data: null,
  loading: false,
  error: null,
  search: '',
  paymentPlayer: null,
  toastMessage: null,
})

const [playerState, setPlayerState] = createStore<PlayerState>(getInitialState())

export { playerState }

const isAdmin = (): boolean => authState.isAdmin || authState.isSuperAdmin

const matchesSearch = (player: Player, term: string): boolean => {
  const lower = term.toLowerCase()
  return (
    (player.firstName || '').toLowerCase().includes(lower) ||
    (player.lastName || '').toLowerCase().includes(lower)
  )
}

const sortByRatingDesc = (a: Player, b: Player): number => b.rating - a.rating

const isPlayerInEvent = (event: EventOption, playerId: string): boolean =>
  event.participants?.some((participant) =>
    participant.players?.some(
      (player) => player._id.toString() === playerId.toString(),
    ),
  ) ?? false

const isPlayerUnpaid = (event: EventOption, playerId: string): boolean =>
  isPlayerInEvent(event, playerId) &&
  !(event.paidPlayerIds || []).includes(playerId)

const getUnpaidEventsForPlayer = (playerId: string): EventOption[] =>
  (eventState.data || []).filter((event) => isPlayerUnpaid(event, playerId))

export const getPerPlayerFee = (event: EventOption): number => {
  const fee = event.registrationFee || 0
  if (event.type === 'Team' && event.nop > 1) {
    return Math.round((fee / event.nop) * 100) / 100
  }
  return fee
}

const showToast = (type: 'success' | 'error', text: string) => {
  setPlayerState({ toastMessage: { type, text } })
  setTimeout(() => setPlayerState({ toastMessage: null }), 3000)
}

const markPaymentReceived = async (eventId: string, playerId: string) => {
  try {
    await apiPost('paymentReceived', { _id: eventId, playerId })
    showToast('success', 'Payment marked as received')
    await eventActions.refreshEvents()
  } catch (error) {
    showToast(
      'error',
      error instanceof Error ? error.message : 'Failed to mark payment received',
    )
  }
}

const closeDialogIfFullyPaid = (playerId: string) => {
  if (getUnpaidEventsForPlayer(playerId).length === 0) {
    setPlayerState({ paymentPlayer: null })
  }
}

export const playerActions = {
  init: () => {
    playerActions.fetchPlayers()
    if (isAdmin()) eventActions.fetchEvents()
  },

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

  hasUnpaidEvents: (playerId: string): boolean =>
    getUnpaidEventsForPlayer(playerId).length > 0,

  unpaidEvents: (playerId: string): EventOption[] =>
    getUnpaidEventsForPlayer(playerId),

  openPaymentDialog: (player: Player) => {
    setPlayerState({ paymentPlayer: player })
  },

  closePaymentDialog: () => {
    setPlayerState({ paymentPlayer: null })
  },

  confirmPayment: async (eventId: string, playerId: string) => {
    const confirmed = window.confirm('Confirm payment received for this event?')
    if (!confirmed) return
    await markPaymentReceived(eventId, playerId)
    closeDialogIfFullyPaid(playerId)
  },

  confirmAllPayments: async (playerId: string) => {
    const confirmed = window.confirm(
      'Confirm payment received for all events?',
    )
    if (!confirmed) return
    const events = getUnpaidEventsForPlayer(playerId)
    for (const event of events) {
      await markPaymentReceived(event._id, playerId)
    }
    closeDialogIfFullyPaid(playerId)
  },

  reset: () => setPlayerState(getInitialState()),
}
