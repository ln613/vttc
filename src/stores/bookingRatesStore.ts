import { createStore } from 'solid-js/store'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import { formatLocalDate } from '../utils/date'
import { langActions } from './langStore'
import { settingsState } from './settingsStore'
import {
  bookingRules,
  toMinutes,
  toTimeOfDay,
  WEEK_DAYS,
  type WeekDay,
} from '../../shared/rules/booking'
import {
  rateError,
  type NewRate,
  type OneTimeRate,
  type WeeklyRate,
} from '../../shared/rules/bookingRates'

// The court's prices: what the Pricing page shows, and the Settings page's
// "Court prices" editor, where an admin sets a weekly or a one-time price.
// See specs/rules/booking.md ("Price") and shared/rules/bookingRates.js.

type Repeat = NewRate['repeat']

interface RateForm {
  repeat: Repeat
  days: WeekDay[]
  date: string
  from: string
  to: string
  dollars: string
}

interface BookingRatesState {
  weekly: WeeklyRate[]
  // One-time prices still to come, soonest first.
  oneTime: OneTimeRate[]
  loaded: boolean
  error: string | null
  form: RateForm
  saving: boolean
  formError: string | null
  saved: boolean
  // The one-time price being removed.
  removing: OneTimeRate | null
}

const slotMinutes = bookingRules(clubConfig.booking).slotMinutes

const getInitialForm = (): RateForm => ({
  repeat: 'weekly',
  days: [],
  date: '',
  from: openTime(),
  to: closeTime(),
  dollars: '',
})

const getInitialState = (): BookingRatesState => ({
  // Until the server answers: the club config's, where they start.
  weekly: clubConfig.booking?.rates ?? [],
  oneTime: [],
  loaded: false,
  error: null,
  form: getInitialForm(),
  saving: false,
  formError: null,
  saved: false,
  removing: null,
})

// The court's opening hours, an admin setting (Settings page).
const openTime = () => settingsState.settings.bookingOpenTime
const closeTime = () => settingsState.settings.bookingCloseTime

const [bookingRatesState, setBookingRatesState] =
  createStore<BookingRatesState>(getInitialState())

export { bookingRatesState }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

interface RatesResponse {
  weekly: WeeklyRate[]
  oneTime: OneTimeRate[]
}

const applyRates = (rates: RatesResponse) =>
  setBookingRatesState({
    weekly: rates.weekly,
    oneTime: rates.oneTime,
    loaded: true,
  })

// ==================== loading ====================

const fetchRates = async () => {
  setBookingRatesState({ error: null })
  try {
    applyRates(await apiGet<RatesResponse>('bookingRates'))
  } catch (err) {
    setBookingRatesState({
      error: errorMessage(err, 'Could not load the prices'),
    })
  }
}

// ==================== the form ====================

const timeOption = (minutes: number) => ({
  value: toTimeOfDay(minutes),
  label:
    minutes === 24 * 60
      ? langActions.t('common.midnight', { time: langActions.clock(minutes) })
      : langActions.clock(minutes),
})

const timesBetween = (from: number, to: number) => {
  const out = []
  for (let t = from; t <= to; t += slotMinutes) out.push(timeOption(t))
  return out
}

// Every half hour within the opening hours: a start up to the last half
// hour, an end after the start up to closing.
const startOptions = () =>
  timesBetween(toMinutes(openTime()), toMinutes(closeTime()) - slotMinutes)

const endOptions = () =>
  timesBetween(
    toMinutes(bookingRatesState.form.from) + slotMinutes,
    toMinutes(closeTime()),
  )

const setForm = (patch: Partial<RateForm>) =>
  setBookingRatesState({
    form: { ...bookingRatesState.form, ...patch },
    formError: null,
    saved: false,
  })

const setOneTime = (oneTime: boolean) =>
  setForm({ repeat: oneTime ? 'once' : 'weekly' })

const isDayChosen = (day: WeekDay) => bookingRatesState.form.days.includes(day)

const toggleDay = (day: WeekDay) =>
  setForm({
    days: WEEK_DAYS.filter((d) =>
      d === day ? !isDayChosen(d) : isDayChosen(d),
    ),
  })

const setDate = (date: Date | null) =>
  setForm({ date: date ? formatLocalDate(date) : '' })

// A later start can leave the end at or before it; the end moves with it.
const setFrom = (from: string) => {
  const earliestEnd = toMinutes(from) + slotMinutes
  setForm({
    from,
    ...(toMinutes(bookingRatesState.form.to) < earliestEnd
      ? { to: toTimeOfDay(earliestEnd) }
      : {}),
  })
}

const setTo = (to: string) => setForm({ to })

const setDollars = (value: string) =>
  setForm({ dollars: value.replace(/[^\d.]/g, '') })

const newRate = (): NewRate => {
  const f = bookingRatesState.form
  return {
    repeat: f.repeat,
    ...(f.repeat === 'weekly' ? { days: f.days } : { date: f.date }),
    from: f.from,
    to: f.to,
    dollarsPerHour: Number(f.dollars),
  }
}

// The hours may have been changed since the form was filled in.
const keepFormInsideHours = () => {
  const { from, to } = bookingRatesState.form
  const open = toMinutes(openTime())
  const close = toMinutes(closeTime())
  if (toMinutes(from) < open || toMinutes(from) >= close) {
    setForm({ from: openTime() })
  }
  if (toMinutes(to) > close || toMinutes(to) <= toMinutes(from)) {
    setForm({ to: closeTime() })
  }
}

const save = async () => {
  keepFormInsideHours()
  const rate = newRate()
  const invalid = rateError(rate, {
    openTime: openTime(),
    closeTime: closeTime(),
    slotMinutes,
  })
  if (invalid) return setBookingRatesState('formError', invalid)
  setBookingRatesState({ saving: true, formError: null, saved: false })
  try {
    applyRates(await apiPost<RatesResponse>('saveBookingRate', rate))
    setBookingRatesState({ saving: false, saved: true })
  } catch (err) {
    setBookingRatesState({
      saving: false,
      formError: errorMessage(err, 'Could not save the price'),
    })
  }
}

const removeOneTime = async (rate: OneTimeRate) => {
  setBookingRatesState({ removing: rate, error: null })
  try {
    applyRates(
      await apiPost<RatesResponse>('deleteBookingRate', {
        date: rate.date,
        from: rate.from,
        to: rate.to,
      }),
    )
  } catch (err) {
    setBookingRatesState({
      error: errorMessage(err, 'Could not remove the price'),
    })
  }
  setBookingRatesState({ removing: null })
}

const isRemoving = (rate: OneTimeRate) =>
  bookingRatesState.removing?.date === rate.date &&
  bookingRatesState.removing?.from === rate.from

const resetForm = () =>
  setBookingRatesState({
    form: getInitialForm(),
    formError: null,
    saved: false,
  })

export const bookingRatesActions = {
  fetchRates,
  startOptions,
  endOptions,
  setOneTime,
  isDayChosen,
  toggleDay,
  setDate,
  setFrom,
  setTo,
  setDollars,
  save,
  removeOneTime,
  isRemoving,
  resetForm,
}
