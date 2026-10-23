import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'
import { creditsActions } from './creditsStore'
import { formatLocalDate } from '../utils/date'
import type { DoorCode } from './bookingStore'
import { langActions } from './langStore'

// The signed-in player's court bookings, newest first, each with its door
// code and receipt. See specs/pages/My Bookings.md.

export interface ReceiptLine {
  label: string
  value: string
}

export interface MyBooking {
  _id: string
  date: string
  court: number
  start: number
  minutes: number
  credits?: number
  paidWith: 'credits' | 'card'
  // The liability waiver the booker accepted (specs/rules/waiver.md).
  waiver?: { version: string; acceptedAt: string } | null
  amountCents?: number
  balanceAfter: number | null
  name: string
  paidAt: string
  createdAt: string
  doorCode: DoorCode | null
  receipt: { title: string; ref: string; lines: ReceiptLine[] }
  // Until when the player can cancel it (paid from the balance, 48 hours
  // before it starts); null when it can't be cancelled online.
  cancellableUntil: string | null
}

interface MyBookingsState {
  bookings: MyBooking[]
  loading: boolean
  error: string | null
  // The booking whose receipt is open, if any.
  openReceiptId: string | null
  // The booking the player is about to cancel, and how that went.
  cancelling: MyBooking | null
  busy: boolean
  cancelError: string | null
  // What went back to the balance on the last cancellation.
  refunded: number | null
}

const getInitialState = (): MyBookingsState => ({
  bookings: [],
  loading: false,
  error: null,
  openReceiptId: null,
  cancelling: null,
  busy: false,
  cancelError: null,
  refunded: null,
})

const [myBookingsState, setMyBookingsState] =
  createStore<MyBookingsState>(getInitialState())

export { myBookingsState }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

const today = () => formatLocalDate(new Date())

// Upcoming soonest first; past most recent first.
const upcoming = (): MyBooking[] =>
  myBookingsState.bookings
    .filter((b) => b.date >= today())
    .slice()
    .reverse()

const isPast = (b: MyBooking): boolean => b.date < today()

const past = (): MyBooking[] => myBookingsState.bookings.filter(isPast)

// A code stops working a little after the booking ends.
const isCodeExpired = (b: MyBooking): boolean =>
  !!b.doorCode && new Date(b.doorCode.validUntil) < new Date()

const isReceiptOpen = (id: string): boolean =>
  myBookingsState.openReceiptId === id

const toggleReceipt = (id: string) =>
  setMyBookingsState('openReceiptId', isReceiptOpen(id) ? null : id)

const init = async () => {
  setMyBookingsState({ loading: true, error: null })
  try {
    const bookings = await apiGet<MyBooking[]>('myBookings')
    setMyBookingsState({ bookings, loading: false })
  } catch (err) {
    setMyBookingsState({
      loading: false,
      error: errorMessage(err, langActions.t('myBookings.loadFailed')),
    })
  }
}

// ==================== cancelling ====================

const canCancel = (b: MyBooking): boolean =>
  !!b.cancellableUntil && new Date(b.cancellableUntil) > new Date()

// Paid from the balance, still to come, but too close to cancel.
const isTooLateToCancel = (b: MyBooking): boolean =>
  b.paidWith === 'credits' && !isPast(b) && !canCancel(b)

const openCancel = (b: MyBooking) =>
  setMyBookingsState({ cancelling: b, cancelError: null, busy: false })

const closeCancel = () =>
  setMyBookingsState({ cancelling: null, cancelError: null })

const confirmCancel = async () => {
  const booking = myBookingsState.cancelling
  if (!booking) return
  setMyBookingsState({ busy: true, cancelError: null })
  try {
    const result = await apiPost<{ refunded: number; balance: number }>(
      'cancelBooking',
      { bookingId: booking._id },
    )
    creditsActions.setBalance(result.balance)
    setMyBookingsState({
      busy: false,
      cancelling: null,
      refunded: result.refunded,
      bookings: myBookingsState.bookings.filter((b) => b._id !== booking._id),
    })
  } catch (err) {
    setMyBookingsState({
      busy: false,
      cancelError: errorMessage(err, langActions.t('myBookings.cancelFailed')),
    })
  }
}

const reset = () => setMyBookingsState(getInitialState())

export const myBookingsActions = {
  init,
  reset,
  upcoming,
  past,
  isPast,
  isCodeExpired,
  isReceiptOpen,
  toggleReceipt,
  canCancel,
  isTooLateToCancel,
  openCancel,
  closeCancel,
  confirmCancel,
}
