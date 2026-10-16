// Court booking: opening hours, start times, lengths and prices. Shared so
// the booking page and the server agree on every number; the club's own
// values come from `booking` in clubs/<slug>/config.json, and anything a
// club leaves out falls back to the defaults below. See specs/rules/booking.md.

export const DEFAULT_BOOKING = {
  // Midnight closing is "24:00". An admin can change both on the Settings
  // page; these and the club config's are only the defaults.
  openTime: '08:00',
  closeTime: '24:00',
  // Bookings start on the half hour and grow in half-hour steps.
  slotMinutes: 30,
  minMinutes: 60,
  // A registered player pays in credits; a guest pays the same price in
  // dollars, at the top-up rate. With `rates` (below) the price follows the
  // day and the time; `creditsPerSlot` is the flat price otherwise, and for
  // any half hour no rate covers.
  creditsPerSlot: 2500,
  // [{ days: ['mon', 'tue'], from: '09:00', to: '18:00', dollarsPerHour: 30 }]
  rates: [],
  creditsPerDollar: 100,
  minTopUpDollars: 10,
  // How long a guest's slot is held while they pay.
  guestHoldMinutes: 15,
  // The door code works from this long before the booking to this long
  // after it.
  doorCodeLeadMinutes: 15,
  doorCodeTrailMinutes: 15,
}

// "HH:MM" on the 24-hour clock; "24:00" is midnight at the end of the day.
export const isTimeOfDay = (value) => {
  const m = /^(\d{2}):(\d{2})$/.exec(String(value ?? ''))
  if (!m) return false
  const minutes = Number(m[1]) * 60 + Number(m[2])
  return Number(m[2]) < 60 && minutes <= 24 * 60
}

export const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number)
  return h * 60 + (m || 0)
}

// The club's rules, with every number resolved to minutes or credits.
export const bookingRules = (config) => {
  const c = { ...DEFAULT_BOOKING, ...(config || {}) }
  return {
    openMinutes: toMinutes(c.openTime),
    closeMinutes: toMinutes(c.closeTime),
    slotMinutes: c.slotMinutes,
    minMinutes: c.minMinutes,
    creditsPerSlot: c.creditsPerSlot,
    creditsPerDollar: c.creditsPerDollar,
    rates: (c.rates || []).map((r) => ({
      days: r.days,
      fromMinutes: toMinutes(r.from),
      toMinutes: toMinutes(r.to),
      dollarsPerHour: r.dollarsPerHour,
    })),
    minTopUpDollars: c.minTopUpDollars,
    guestHoldMinutes: c.guestHoldMinutes,
    doorCodeLeadMinutes: c.doorCodeLeadMinutes,
    doorCodeTrailMinutes: c.doorCodeTrailMinutes,
  }
}

// "08:00" from 480.
export const toTimeOfDay = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// Why opening and closing times can't be used, or null when they can: both
// on a slot boundary, and open long enough for at least one booking.
export const bookingHoursError = (config, openTime, closeTime) => {
  if (!isTimeOfDay(openTime) || !isTimeOfDay(closeTime))
    return 'Choose the booking opening and closing times'
  const r = bookingRules({ ...(config || {}), openTime, closeTime })
  if (r.openMinutes % r.slotMinutes || r.closeMinutes % r.slotMinutes) {
    return `Booking hours must be on the ${r.slotMinutes}-minute mark`
  }
  if (r.closeMinutes - r.openMinutes < r.minMinutes) {
    return 'Booking closing time must be at least the minimum booking length after opening'
  }
  return null
}

// Every time a booking may start: on the slot boundary, from opening until
// the last start that still leaves the minimum length before closing.
export const startTimes = (rules) => {
  const out = []
  for (
    let t = rules.openMinutes;
    t + rules.minMinutes <= rules.closeMinutes;
    t += rules.slotMinutes
  ) {
    out.push(t)
  }
  return out
}

// Every half-hour row of the day, opening to closing — what the calendar draws.
export const daySlots = (rules) => {
  const out = []
  for (
    let t = rules.openMinutes;
    t < rules.closeMinutes;
    t += rules.slotMinutes
  )
    out.push(t)
  return out
}

// The lengths a booking starting at `start` may have: the minimum, then in
// slot steps, up to whichever comes first — closing, or the next booking.
export const lengthOptions = (rules, start, nextBusyStart = Infinity) => {
  const limit = Math.min(rules.closeMinutes, nextBusyStart)
  const out = []
  for (let m = rules.minMinutes; start + m <= limit; m += rules.slotMinutes)
    out.push(m)
  return out
}

// The slot starts a booking covers: 7:00 for 90 minutes is 7:00, 7:30, 8:00.
export const slotsCovered = (rules, start, minutes) => {
  const out = []
  for (let t = start; t < start + minutes; t += rules.slotMinutes) out.push(t)
  return out
}

export const isValidBookingTime = (rules, start, minutes) =>
  Number.isInteger(start) &&
  Number.isInteger(minutes) &&
  startTimes(rules).includes(start) &&
  minutes >= rules.minMinutes &&
  minutes % rules.slotMinutes === 0 &&
  start + minutes <= rules.closeMinutes

// ==================== prices ====================

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// "2026-10-09" → "fri". The date is the club's own, so no timezone applies.
export const weekdayOf = (date) =>
  WEEK_DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7]

// The rate that covers a half hour on a day, if one does.
export const rateAt = (rules, date, minute) => {
  const day = weekdayOf(date)
  return rules.rates.find(
    (r) =>
      r.days.includes(day) && minute >= r.fromMinutes && minute < r.toMinutes,
  )
}

// One half hour's price in cents: its rate, or the flat price.
export const slotPriceCents = (rules, date, start) => {
  const rate = date != null ? rateAt(rules, date, start) : null
  return rate
    ? Math.round((rate.dollarsPerHour * 100 * rules.slotMinutes) / 60)
    : Math.round((rules.creditsPerSlot / rules.creditsPerDollar) * 100)
}

// What a booking costs a guest, in cents: the sum of its half hours, so one
// that runs past 6 PM pays each rate for its own part.
export const bookingPriceCents = (
  rules,
  minutes,
  date,
  start = rules.openMinutes,
) =>
  slotsCovered(rules, start, minutes).reduce(
    (sum, t) => sum + slotPriceCents(rules, date, t),
    0,
  )

// The same price in credits, at the top-up rate.
export const bookingCredits = (rules, minutes, date, start) =>
  Math.round(
    (bookingPriceCents(rules, minutes, date, start) / 100) *
      rules.creditsPerDollar,
  )

// The hourly rate a half hour is charged at, in dollars.
export const hourlyRateAt = (rules, date, start) =>
  (slotPriceCents(rules, date, start) * 60) / rules.slotMinutes / 100

export const topUpCredits = (rules, dollars) => dollars * rules.creditsPerDollar

// Whole dollars only, at least the minimum.
export const isValidTopUp = (rules, dollars) =>
  Number.isInteger(dollars) && dollars >= rules.minTopUpDollars

// "8:00 AM", "12:30 PM"; 24:00 is "12:00 AM" (midnight).
export const formatClock = (minutes) => {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`
}

// "4:30pm", "12:00pm" — compact, for the length dropdown.
export const formatClockShort = (minutes) => {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${String(m).padStart(2, '0')}${h24 < 12 ? 'am' : 'pm'}`
}

// "1 hour", "1.5 hours", "2 hours".
export const formatLength = (minutes) => {
  const hours = minutes / 60
  return `${hours} hour${hours === 1 ? '' : 's'}`
}

// "$30", "$22.50", "$1,000".
// "$35" for a whole-dollar price; `exact` always shows the cents ("$35.00"),
// as a subtotal / tax / total breakdown must.
export const formatDollars = (cents, exact = false) => {
  const digits = exact || cents % 100 !== 0 ? 2 : 0
  return `$${(cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`
}

export const formatCredits = (credits) => credits.toLocaleString('en-US')
