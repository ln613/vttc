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
  hourlyRateAt,
} from '../../shared/rules/booking'
import { langActions } from './langStore'
import { isValidEmail, isValidPhone } from '../../shared/rules/contact'
import { requiredWaiver } from '../../shared/rules/waiver'
import { waiverState } from './waiverStore'
import {
  NO_CHECKOUT,
  paymentLanguage,
  renewPaymentTicket,
  type PaymentCheckout,
} from '../utils/payment'

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

// 'waiver': a guest accepts the club's liability waiver before paying
// (specs/rules/waiver.md).
export type DialogStep = 'details' | 'guest' | 'waiver' | 'pay' | 'done'

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
  // The guest ticked the waiver's box, and accepted it for this booking.
  waiverAgreed: boolean
  waiverAccepted: boolean
  paymentId: string
  amountCents: number
  heldUntil: string
  // How the guest's card is taken (Moneris's form, or the placeholder).
  checkout: PaymentCheckout
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
  waiverAgreed: false,
  waiverAccepted: false,
  paymentId: '',
  amountCents: 0,
  heldUntil: '',
  checkout: NO_CHECKOUT,
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
  const label = langActions.courtName()
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
    label: langActions.t('booking.lengthOption', {
      length: langActions.length(minutes),
      from: langActions.shortClock(bookingState.start),
      to: langActions.shortClock(bookingState.start + minutes),
    }),
  }))

// What a half hour on the chosen day costs per hour, in dollars.
const hourlyRate = (slot: number): number =>
  hourlyRateAt(rules(), bookingState.date, slot)

// Priced by the day and the time it covers (shared/rules/booking.js).
const costCredits = (): number =>
  bookingCredits(
    rules(),
    bookingState.minutes,
    bookingState.date,
    bookingState.start,
  )

const priceCents = (): number =>
  bookingPriceCents(
    rules(),
    bookingState.minutes,
    bookingState.date,
    bookingState.start,
  )

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
      error: errorMessage(err, langActions.t('booking.loadFailed')),
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
    // Each booking is accepted for on its own.
    waiverAgreed: false,
    waiverAccepted: false,
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
  const t = langActions.t
  if (!bookingState.firstName.trim()) return t('booking.enterFirstName')
  if (!bookingState.lastName.trim()) return t('booking.enterLastName')
  if (!isValidEmail(bookingState.email)) return t('booking.enterEmail')
  if (!isValidPhone(bookingState.phone)) return t('booking.enterPhone')
  return null
}

interface GuestHold {
  paymentId: string
  amountCents: number
  heldUntil: string
  paymentsAvailable: boolean
  checkout?: PaymentCheckout
}

// The club's waiver, when it requires one. A signed-in member has accepted
// it already (WaiverGate), so only a guest is asked here.
const clubWaiver = requiredWaiver(clubConfig)

const guestMustAcceptWaiver = (): boolean =>
  !!clubWaiver &&
  !bookingState.waiverAccepted &&
  !(authActions.hasPlayerRecord() && !waiverState.mustAccept)

// The details are checked first; then, where the club requires it, the
// waiver; only then is the time held for payment.
const submitGuest = async () => {
  const invalid = validateGuest()
  if (invalid) return setBookingState('dialogError', invalid)
  if (guestMustAcceptWaiver()) {
    return setBookingState({ step: 'waiver', dialogError: null })
  }
  await holdForGuest()
}

const setWaiverAgreed = (agreed: boolean) =>
  setBookingState({ waiverAgreed: agreed, dialogError: null })

const acceptWaiverAndContinue = async () => {
  if (!bookingState.waiverAgreed) return
  setBookingState({ waiverAccepted: true })
  await holdForGuest()
}

const backToGuest = () => setBookingState({ step: 'guest', dialogError: null })

const holdForGuest = async () => {
  setBookingState({ busy: true, dialogError: null })
  try {
    const hold = await apiPost<GuestHold>('bookCourtAsGuest', {
      ...request(),
      firstName: bookingState.firstName,
      lastName: bookingState.lastName,
      email: bookingState.email,
      phone: bookingState.phone,
      ...(clubWaiver && bookingState.waiverAccepted
        ? { waiverVersion: clubWaiver.version }
        : {}),
      language: paymentLanguage(),
    })
    setBookingState({
      busy: false,
      step: 'pay',
      paymentId: hold.paymentId,
      amountCents: hold.amountCents,
      heldUntil: hold.heldUntil,
      checkout: hold.checkout ?? NO_CHECKOUT,
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

// `completing`: called because an earlier card form turned out to be paid.
const payAsGuest = async (completing = false) => {
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
    await offerNewCardForm(undefined, completing)
  }
}

// The card form said something went wrong: say so, and open a fresh one.
// `detail` is what Moneris reported, kept on the payment's record.
const cardError = async (message: string, detail?: string) => {
  setBookingState('dialogError', message)
  await offerNewCardForm(detail || message)
}

// After a decline or a broken form, Moneris needs a new ticket for the same
// payment. The placeholder has nothing to renew. If an earlier form did
// take the card after all, the payment is completed instead — once, so a
// payment the server won't complete can't loop.
const offerNewCardForm = async (reason?: string, completing = false) => {
  if (bookingState.checkout.provider !== 'moneris') return
  try {
    const renewed = await renewPaymentTicket(bookingState.paymentId, reason)
    if (renewed.paid && !completing) return await payAsGuest(true)
    if (renewed.checkout) setBookingState('checkout', renewed.checkout)
  } catch (err) {
    setBookingState('dialogError', errorMessage(err, 'Payment failed'))
  }
}

const reset = () => setBookingState(getInitialState())

export const bookingActions = {
  init,
  cardError,
  selectDate,
  shiftWeek,
  selectSlot,
  setMinutes,
  closeDialog,
  backToDetails,
  bookWithCredits,
  signInForCredits,
  startGuest,
  setWaiverAgreed,
  acceptWaiverAndContinue,
  backToGuest,
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
  hourlyRate,
  priceCents,
  hasEnoughCredits,
  gridSlots,
  rules,
}
