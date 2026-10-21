// The court's prices as an admin sets them — see specs/rules/booking.md
// ("Price"). Two kinds:
//
//   weekly   { days: ['mon', 'tue'], from: '09:00', to: '18:00', dollarsPerHour: 30 }
//            the regular price, the same shape as `booking.rates` in the
//            club config (which is where it starts)
//   one-time { date: '2026-11-01', from: '12:00', to: '15:00', dollarsPerHour: 25 }
//            a price for one day only, ahead of the weekly one (a promotion)
//
// A new price is painted over whatever covered its time before: setting
// Monday 5–7 PM to $35 leaves the rest of Monday as it was. Shared so the
// Settings page shows exactly what the server will save.

import { WEEK_DAYS, isTimeOfDay, toMinutes, toTimeOfDay } from './booking.js'

const throwError = (message) => {
  throw new Error(message)
}

// ==================== segments ====================

// A day's prices as [{ from, to, dollarsPerHour }] in minutes, earliest first.
const paint = (segments, from, to, dollarsPerHour) =>
  mergeSegments(
    [
      ...segments.flatMap((s) => cutOut(s, from, to)),
      { from, to, dollarsPerHour },
    ].sort((a, b) => a.from - b.from),
  )

// What is left of a segment once [from, to) is taken out of it.
const cutOut = (s, from, to) => {
  if (s.to <= from || s.from >= to) return [s]
  return [
    ...(s.from < from ? [{ ...s, to: from }] : []),
    ...(s.to > to ? [{ ...s, from: to }] : []),
  ]
}

// Neighbours at the same price become one.
const mergeSegments = (segments) =>
  segments.reduce((out, s) => {
    const last = out[out.length - 1]
    if (last && last.to === s.from && last.dollarsPerHour === s.dollarsPerHour) {
      out[out.length - 1] = { ...last, to: s.to }
    } else out.push({ ...s })
    return out
  }, [])

const sameSegments = (a, b) =>
  a.length === b.length &&
  a.every(
    (s, i) => s.from === b[i].from && s.to === b[i].to && s.dollarsPerHour === b[i].dollarsPerHour,
  )

// ==================== weekly ====================

const weeklyByDay = (weekly) =>
  Object.fromEntries(
    WEEK_DAYS.map((day) => [
      day,
      mergeSegments(
        (weekly || [])
          .filter((r) => r.days.includes(day))
          .map((r) => ({ from: toMinutes(r.from), to: toMinutes(r.to), dollarsPerHour: r.dollarsPerHour }))
          .sort((a, b) => a.from - b.from),
      ),
    ]),
  )

// Days with the same prices all day are written once, as the Pricing page
// shows them: Mon–Thu, then Fri–Sun.
const weeklyFromDays = (byDay) => {
  const groups = []
  for (const day of WEEK_DAYS) {
    const group = groups.find((g) => sameSegments(g.segments, byDay[day]))
    if (group) group.days.push(day)
    else groups.push({ days: [day], segments: byDay[day] })
  }
  return groups.flatMap((g) =>
    g.segments.map((s) => ({
      days: g.days,
      from: toTimeOfDay(s.from),
      to: toTimeOfDay(s.to),
      dollarsPerHour: s.dollarsPerHour,
    })),
  )
}

/** The weekly prices with `rate` ({ days, from, to, dollarsPerHour }) painted on. */
export const applyWeeklyRate = (weekly, rate) => {
  const byDay = weeklyByDay(weekly)
  for (const day of rate.days) {
    byDay[day] = paint(byDay[day], toMinutes(rate.from), toMinutes(rate.to), rate.dollarsPerHour)
  }
  return weeklyFromDays(byDay)
}

// ==================== one-time ====================

/**
 * The one-time prices with `rate` ({ date, from, to, dollarsPerHour })
 * painted on its day, and any day before `today` dropped.
 */
export const applyOneTimeRate = (oneTime, rate, today) => {
  const others = (oneTime || []).filter((r) => r.date !== rate.date)
  const sameDay = (oneTime || [])
    .filter((r) => r.date === rate.date)
    .map((r) => ({ from: toMinutes(r.from), to: toMinutes(r.to), dollarsPerHour: r.dollarsPerHour }))
    .sort((a, b) => a.from - b.from)
  const painted = paint(sameDay, toMinutes(rate.from), toMinutes(rate.to), rate.dollarsPerHour).map((s) => ({
    date: rate.date,
    from: toTimeOfDay(s.from),
    to: toTimeOfDay(s.to),
    dollarsPerHour: s.dollarsPerHour,
  }))
  return sortOneTime([...others, ...painted]).filter((r) => !today || r.date >= today)
}

/** The one-time prices without the one on `date` from `from` to `to`. */
export const removeOneTimeRate = (oneTime, { date, from, to }) =>
  (oneTime || []).filter((r) => !(r.date === date && r.from === from && r.to === to))

/** The one-time prices from `today` on, soonest first. */
export const upcomingOneTimeRates = (oneTime, today) =>
  sortOneTime((oneTime || []).filter((r) => r.date >= today))

const sortOneTime = (rates) =>
  [...rates].sort((a, b) => (a.date === b.date ? toMinutes(a.from) - toMinutes(b.from) : a.date < b.date ? -1 : 1))

// ==================== checking a new price ====================

const isClubDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

// At most two decimals: a price in dollars and cents.
const isPrice = (value) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && Math.round(value * 100) === value * 100

/**
 * Why a new price can't be saved, or null when it can. `hours`: the court's
 * opening hours ({ openTime, closeTime }); `slotMinutes`: the booking step.
 */
export const rateError = (rate, { openTime, closeTime, slotMinutes = 30, today } = {}) => {
  if (!rate) return 'Choose a price to save'
  if (rate.repeat === 'weekly') {
    if (!Array.isArray(rate.days) || !rate.days.length) return 'Choose at least one day'
    if (rate.days.some((d) => !WEEK_DAYS.includes(d))) return 'Choose the days of the week'
  } else if (rate.repeat === 'once') {
    if (!isClubDate(rate.date)) return 'Choose a date'
    if (today && rate.date < today) return 'That date has passed'
  } else return 'Choose weekly or one-time'
  if (!isTimeOfDay(rate.from) || !isTimeOfDay(rate.to)) return 'Choose a start and end time'
  const from = toMinutes(rate.from)
  const to = toMinutes(rate.to)
  if (from % slotMinutes || to % slotMinutes) return `Times must be on the ${slotMinutes}-minute mark`
  if (to <= from) return 'The end time must be after the start time'
  if ((openTime && from < toMinutes(openTime)) || (closeTime && to > toMinutes(closeTime))) {
    return 'Choose times within the opening hours'
  }
  if (!isPrice(rate.dollarsPerHour)) return 'Enter the hourly rate in dollars'
  return null
}

/** The price as saved: only the fields its kind uses. */
export const normalizeRate = (rate) => {
  if (!rate) throwError('Choose a price to save')
  const base = { from: rate.from, to: rate.to, dollarsPerHour: rate.dollarsPerHour }
  return rate.repeat === 'weekly'
    ? { repeat: 'weekly', days: WEEK_DAYS.filter((d) => rate.days.includes(d)), ...base }
    : { repeat: 'once', date: rate.date, ...base }
}
