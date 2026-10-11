import { createStore } from 'solid-js/store'
import { apiGet } from '../utils/api'
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
}

interface MyBookingsState {
  bookings: MyBooking[]
  loading: boolean
  error: string | null
  // The booking whose receipt is open, if any.
  openReceiptId: string | null
}

const getInitialState = (): MyBookingsState => ({
  bookings: [],
  loading: false,
  error: null,
  openReceiptId: null,
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
}
