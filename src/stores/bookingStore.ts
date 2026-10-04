import { createStore } from 'solid-js/store'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import { parseLocalDate, formatLocalDate } from '../utils/date'
import { creditsState, creditsActions } from './creditsStore'
import { authState, authActions } from './authStore'
import {
  bookingRules,
  startTimes,
  daySlots,
  lengthOptions,
  bookingCredits,
  bookingPriceCents,
  formatLength,
  formatClockShort,
} from '../../shared/rules/booking'
import { isValidEmail, isValidPhone } from '../../shared/rules/contact'

// The Booking page: a week of days to pick from, the chosen day's court
// times, and the dialog that books one. See specs/pages/Booking.md.

export interface DayBooking {
  _id: string
  court: number
  start: number
  minutes: number
  mine: boolean
  name?: string
}

interface BookingDay {
  date: string
  today: string
  nowMinutes: number
  courts: number[]
  openTime: string
  closeTime: string
  paymentsAvailable: boolean
  bookings: DayBooking[]
}

// The code that opens the door for a booking — see
// netlify/functions/utils/doorAccess.js.
export interface DoorCode {
  code: string
  validFrom: string
  validUntil: string
  window: string
}

interface BookingCompleted {
  doorCode: DoorCode | null
  receiptSentTo: string | null
}

export type DialogStep = 'details' | 'guest' | 'pay' | 'done'

export type SlotStatus = 'loading' | 'past' | 'taken' | 'free' | 'tooLate'

interface BookingState {
  weekStart: string
  date: string
  day: BookingDay | null
  loading: boolean
  error: string | null
  // The booking dialog.
  step: DialogStep | null
  court: number
  start: number
  minutes: number
  firstName: string
  lastName: string
  email: string
  phone: string
  paymentId: string
  amountCents: number
  heldUntil: string
  busy: boolean
  dialogError: string | null
  bookedCredits: number
  doorCode: DoorCode | null
  receiptSentTo: string | null
}

const todayLocal = () => formatLocalDate(new Date())

const getInitialState = (): BookingState => ({
  weekStart: todayLocal(),
  date: todayLocal(),
  day: null,
  loading: false,
  error: null,
  step: null,
  court: 0,
  start: 0,
  minutes: 0,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  paymentId: '',
  amountCents: 0,
  heldUntil: '',
  busy: false,
  dialogError: null,
  bookedCredits: 0,
  doorCode: null,
  receiptSentTo: null,
})

const [bookingState, setBookingState] =
  createStore<BookingState>(getInitialState())

export { bookingState }

// The opening hours are an admin setting and come with each day from the
// server; the club config's are only used before the first day arrives.
const rules = () =>
  bookingRules({
    ...clubConfig.booking,
    ...(bookingState.day
      ? {
          openTime: bookingState.day.openTime,
          closeTime: bookingState.day.closeTime,
        }
      : {}),
  })
const WEEK = 7

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

const addDays = (date: string, days: number): string => {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + days)
  return formatLocalDate(d)
}

// ==================== derived ====================

// The club's today once the server has said, the browser's until then.
const today = (): string => bookingState.day?.today ?? todayLocal()

const weekDays = (): string[] =>
  Array.from({ length: WEEK }, (_, i) => addDays(bookingState.weekStart, i))

const canGoBack = (): boolean => bookingState.weekStart > today()

const courts = (): number[] => bookingState.day?.courts ?? clubConfig.tables.all

const courtLabel = (court: number): string => {
  const label = clubConfig.booking?.courtLabel || 'Court'
  return courts().length > 1 ? `${label} ${court}` : label
}

// The loaded day, once it is the one selected. Between tapping a day and its
// bookings arriving, the previous day's must not show under the new date.
const loadedDay = (): BookingDay | null =>
  bookingState.day?.date === bookingState.date ? bookingState.day : null

const bookingAt = (court: number, slot: number): DayBooking | undefined =>
  loadedDay()?.bookings.find(
    (b) => b.court === court && slot >= b.start && slot < b.start + b.minutes,
  )

// Whether a half hour has gone: an earlier day, or today at or before now.
const isPast = (slot: number): boolean => {
  const day = bookingState.day
  if (!day) return false
  if (day.date < day.today) return true
  return day.date === day.today && slot <= day.nowMinutes
}

const slotStatus = (court: number, slot: number): SlotStatus => {
  if (!loadedDay()) return 'loading'
  if (bookingAt(court, slot)) return 'taken'
  if (isPast(slot)) return 'past'
  // Free, but too close to closing to start a booking of the minimum length.
  if (!startTimes(rules()).includes(slot)) return 'tooLate'
  return 'free'
}

const bookingsFor = (court: number): DayBooking[] =>
  loadedDay()?.bookings.filter((b) => b.court === court) ?? []

const nextBusyStart = (court: number, start: number): number => {
  const later = bookingsFor(court)
    .filter((b) => b.start > start)
    .map((b) => b.start)
  return later.length ? Math.min(...later) : Infinity
}

// The calendar's rows: opening to closing, stretched to take in any booking
// made before the admin changed the hours, so none is ever hidden.
const gridSlots = (): number[] => {
  const r = rules()
  const bookings = loadedDay()?.bookings ?? []
  const first = Math.min(r.openMinutes, ...bookings.map((b) => b.start))
  const end = Math.max(
    r.closeMinutes,
    ...bookings.map((b) => b.start + b.minutes),
  )
  return daySlots({ ...r, openMinutes: first, closeMinutes: end })
}

const lengthChoices = (): number[] =>
  lengthOptions(
    rules(),
    bookingState.start,
    nextBusyStart(bookingState.court, bookingState.start),
  )

// "3 hours (4:30pm to 7:30pm)"
const lengthSelectOptions = () =>
  lengthChoices().map((minutes) => ({
    value: String(minutes),
    label: `${formatLength(minutes)} (${formatClockShort(bookingState.start)} to ${formatClockShort(bookingState.start + minutes)})`,
  }))

const costCredits = (): number => bookingCredits(rules(), bookingState.minutes)

const priceCents = (): number =>
  bookingPriceCents(rules(), bookingState.minutes)

const hasEnoughCredits = (): boolean =>
  (creditsState.balance ?? 0) >= costCredits()

// ==================== loading ====================

const fetchDay = async (date: string) => {
  setBookingState({ loading: true, error: null })
  try {
    const day = await apiGet<BookingDay>('bookingDay', { date })
    setBookingState({ day, loading: false })
    return day
  } catch (err) {
    setBookingState({
      loading: false,
      error: errorMessage(err, 'Could not load bookings'),
    })
    return null
  }
}

// The browser's date and the club's can differ around midnight; whichever
// the club says is today is where the week starts.
const init = async () => {
  setBookingState(getInitialState())
  const day = await fetchDay(todayLocal())
  if (day && day.today !== bookingState.date) {
    setBookingState({ weekStart: day.today, date: day.today })
    await fetchDay(day.today)
  }
  await creditsActions.fetchBalance()
}

const selectDate = (date: string) => {
  if (date < today()) return
  setBookingState('date', date)
  void fetchDay(date)
}

const shiftWeek = (weeks: number) => {
  const next = addDays(bookingState.weekStart, weeks * WEEK)
  const weekStart = next < today() ? today() : next
  setBookingState({ weekStart })
  selectDate(weekStart)
}

// ==================== the dialog ====================

const selectSlot = (court: number, start: number) => {
  if (slotStatus(court, start) !== 'free') return
  setBookingState({
    step: 'details',
    court,
    start,
    minutes: rules().minMinutes,
    dialogError: null,
    busy: false,
  })
}

const setMinutes = (minutes: number) =>
  setBookingState({ minutes, dialogError: null })

const closeDialog = () => setBookingState({ step: null, dialogError: null })

const backToDetails = () =>
  setBookingState({ step: 'details', dialogError: null })

const request = () => ({
  date: bookingState.date,
  court: bookingState.court,
  start: bookingState.start,
  minutes: bookingState.minutes,
})

const bookWithCredits = async () => {
  setBookingState({ busy: true, dialogError: null })
  try {
    const result = await apiPost<
      { balance: number; credits: number } & BookingCompleted
    >('bookCourt', request())
    creditsActions.setBalance(result.balance)
    setBookingState({
      busy: false,
      step: 'done',
      bookedCredits: result.credits,
      doorCode: result.doorCode,
      receiptSentTo: result.receiptSentTo,
    })
    void fetchDay(bookingState.date)
  } catch (err) {
    setBookingState({
      busy: false,
      dialogError: errorMessage(err, 'Booking failed'),
    })
    void fetchDay(bookingState.date)
  }
}

// The sign-in dialog lives in the header, under this one; close this so it
// shows. The time is picked again once signed in, priced in credits.
const signInForCredits = () => {
  closeDialog()
  authActions.showSignInDialog()
}

// A signed-in player paying by card (Credit turned off) starts with their
// own details filled in; anything already typed is kept.
const startGuest = () => {
  const user = authActions.hasPlayerRecord() ? authState.user : null
  setBookingState({
    step: 'guest',
    dialogError: null,
    firstName: bookingState.firstName || user?.firstName || '',
    lastName: bookingState.lastName || user?.lastName || '',
    email: bookingState.email || user?.email || '',
    phone: bookingState.phone || user?.phone || '',
  })
}

type GuestField = 'firstName' | 'lastName' | 'email' | 'phone'

const setGuestField = (field: GuestField, value: string) =>
  setBookingState({
    [field]: value,
    dialogError: null,
  } as Partial<BookingState>)

const validateGuest = (): string | null => {
  if (!bookingState.firstName.trim()) return 'Enter your first name'
  if (!bookingState.lastName.trim()) return 'Enter your last name'
  if (!isValidEmail(bookingState.email)) return 'Enter a valid email address'
  if (!isValidPhone(bookingState.phone))
    return 'Enter a valid Canadian/US phone number'
  return null
}

interface GuestHold {
  paymentId: string
  amountCents: number
  heldUntil: string
  paymentsAvailable: boolean
}

const submitGuest = async () => {
  const invalid = validateGuest()
  if (invalid) return setBookingState('dialogError', invalid)
  setBookingState({ busy: true, dialogError: null })
  try {
    const hold = await apiPost<GuestHold>('bookCourtAsGuest', {
      ...request(),
      firstName: bookingState.firstName,
      lastName: bookingState.lastName,
      email: bookingState.email,
      phone: bookingState.phone,
    })
    setBookingState({
      busy: false,
      step: 'pay',
      paymentId: hold.paymentId,
      amountCents: hold.amountCents,
      heldUntil: hold.heldUntil,
    })
    void fetchDay(bookingState.date)
  } catch (err) {
    setBookingState({
      busy: false,
      dialogError: errorMessage(err, 'Booking failed'),
    })
    void fetchDay(bookingState.date)
  }
}

const payAsGuest = async () => {
  setBookingState({ busy: true, dialogError: null })
  try {
    const result = await apiPost<BookingCompleted>('confirmPayment', {
      paymentId: bookingState.paymentId,
    })
    setBookingState({
      busy: false,
      step: 'done',
      bookedCredits: 0,
      doorCode: result.doorCode,
      receiptSentTo: result.receiptSentTo,
    })
    void fetchDay(bookingState.date)
  } catch (err) {
    setBookingState({
      busy: false,
      dialogError: errorMessage(err, 'Payment failed'),
    })
  }
}

const reset = () => setBookingState(getInitialState())

export const bookingActions = {
  init,
  selectDate,
  shiftWeek,
  selectSlot,
  setMinutes,
  closeDialog,
  backToDetails,
  bookWithCredits,
  signInForCredits,
  startGuest,
  setGuestField,
  submitGuest,
  payAsGuest,
  reset,
  today,
  weekDays,
  canGoBack,
  courts,
  courtLabel,
  bookingAt,
  bookingsFor,
  slotStatus,
  lengthChoices,
  lengthSelectOptions,
  costCredits,
  priceCents,
  hasEnoughCredits,
  gridSlots,
  rules,
}
