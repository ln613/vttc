// The court's prices, set by an admin — see specs/rules/booking.md ("Price")
// and shared/rules/bookingRates.js. Kept in their own settings document, so
// saving the Settings page's other settings can never put old prices back.
// Until an admin first saves one, the prices are the club config's
// `booking.rates`.

import { getDB } from './db.js'
import { club, clubDate } from './club.js'
import { getBookingHours } from './settingsHandlers.js'
import { requireModules } from './modulesHandlers.js'
import { bookingRules } from '../../../shared/rules/booking.js'
import {
  applyWeeklyRate,
  applyOneTimeRate,
  removeOneTimeRate,
  upcomingOneTimeRates,
  rateError,
  normalizeRate,
} from '../../../shared/rules/bookingRates.js'

const COLLECTION = 'settings'
const DOC_ID = 'bookingRates'

const throwError = (message) => {
  throw new Error(message)
}

/** Every price: { weekly, oneTime } (one-time ones of past days included). */
export const loadBookingRates = async () => {
  const doc = await getDB().collection(COLLECTION).findOne({ docId: DOC_ID })
  return {
    weekly: doc?.weekly ?? club.booking?.rates ?? [],
    oneTime: doc?.oneTime ?? [],
  }
}

const saveBookingRates = async ({ weekly, oneTime }) => {
  await getDB()
    .collection(COLLECTION)
    .updateOne(
      { docId: DOC_ID },
      { $set: { docId: DOC_ID, weekly, oneTime, updatedAt: new Date() } },
      { upsert: true },
    )
  return publicRates({ weekly, oneTime })
}

// What anyone may see: the weekly prices and the one-time ones still to come.
const publicRates = ({ weekly, oneTime }) => ({
  weekly,
  oneTime: upcomingOneTimeRates(oneTime, clubDate()),
})

/** GET bookingRates (public): what the Pricing page and Settings show. */
export const getBookingRates = async () => {
  await requireModules('booking')
  return publicRates(await loadBookingRates())
}

/**
 * The booking rules with today's opening hours and prices — what every
 * booking is checked and charged by.
 */
export const loadBookingRules = async () => {
  const [hours, rates] = await Promise.all([getBookingHours(), loadBookingRates()])
  return bookingRules({ ...club.booking, ...hours, rates: rates.weekly, oneTimeRates: rates.oneTime })
}

/**
 * POST saveBookingRate (admin): { repeat: 'weekly', days, from, to,
 * dollarsPerHour } or { repeat: 'once', date, from, to, dollarsPerHour },
 * painted over the prices it covers.
 */
export const saveBookingRate = async (body) => {
  await requireModules('booking')
  const rate = await validateRate(body)
  const current = await loadBookingRates()
  return saveBookingRates(
    rate.repeat === 'weekly'
      ? { ...current, weekly: applyWeeklyRate(current.weekly, rate) }
      : { ...current, oneTime: applyOneTimeRate(current.oneTime, rate, clubDate()) },
  )
}

const validateRate = async (body) => {
  const rate = body ? { ...body, dollarsPerHour: Number(body.dollarsPerHour) } : null
  const hours = await getBookingHours()
  const error = rateError(rate, {
    ...hours,
    slotMinutes: bookingRules(club.booking).slotMinutes,
    today: clubDate(),
  })
  if (error) throwError(error)
  return normalizeRate(rate)
}

/** POST deleteBookingRate (admin): { date, from, to } — a one-time price. */
export const deleteBookingRate = async (body) => {
  await requireModules('booking')
  if (!body?.date || !body?.from || !body?.to) throwError('Choose the price to remove')
  const current = await loadBookingRates()
  const oneTime = removeOneTimeRate(current.oneTime, body)
  if (oneTime.length === current.oneTime.length) throwError('That price has already been removed')
  return saveBookingRates({ ...current, oneTime })
}
