// Court booking and credits — see specs/rules/booking.md.
//
// A booking covers one or more half-hour slots on one court. Each slot it
// covers is claimed as its own document under a unique index on
// (court, date, start), so two people booking the same time at the same
// moment cannot both succeed: the second insert fails at the database,
// whatever either of them saw on screen.
//
// Registered players pay in credits, taken in a single conditional update so
// a balance can never go below zero. Guests pay by card: their slots are
// held for a few minutes while they do, and a hold that runs out frees the
// slots for anyone else.

import { getDB, toObjectId } from './db.js'
import { club, clubDate, clubMinutesOfDay, clubTimeToDate } from './club.js'
import { issueDoorCode, doorAccessAvailable } from './doorAccess.js'
import { buildReceipt, doorCodeView } from './bookingReceipt.js'
import { sendBookingReceiptEmail } from './email.js'
import { getBookingHours } from './settingsHandlers.js'
import { requireModules } from './modulesHandlers.js'
import {
  bookingRules,
  isValidBookingTime,
  slotsCovered,
  bookingCredits,
  bookingPriceCents,
  topUpCredits as creditsForDollars,
  isValidTopUp,
} from '../../../shared/rules/booking.js'
import { isValidEmail, normalizePhone } from '../../../shared/rules/contact.js'
import { toTitleCase } from '../../../shared/rules/nameMatch.js'
import {
  createPayment,
  findPayment,
  markPaymentPaid,
  markPaymentFailed,
  isPlaceholderPaymentAllowed,
  paymentsAvailable,
} from './payments.js'

const BOOKINGS = 'bookings'
const SLOTS = 'bookingSlots'
const PLAYERS = 'players'
const LEDGER = 'creditTransactions'

const throwError = (message) => {
  throw new Error(message)
}

const rules = () => bookingRules(club.booking)

// The rules with today's opening hours, which an admin sets on the Settings
// page (settingsHandlers.js) — the club config's are only the default.
const loadRules = async () => bookingRules({ ...club.booking, ...(await getBookingHours()) })

// The courts that can be booked: the club's tables, which for a club that
// books courts are its courts.
const courts = () => club.tables?.all || [1]

// Each endpoint names the modules it belongs to (specs/rules/modules.md):
// a super admin can turn booking, credits or My Booking off.

// ==================== slots ====================

let indexesReady = false

const getSlots = async () => {
  const collection = getDB().collection(SLOTS)
  if (!indexesReady) {
    await collection.createIndex({ court: 1, date: 1, start: 1 }, { unique: true })
    await collection.createIndex({ bookingId: 1 })
    indexesReady = true
  }
  return collection
}

// A guest who never finished paying no longer holds anything.
const releaseExpiredHolds = async (slots, { court, date }) => {
  const expired = await slots
    .find({ court, date, heldUntil: { $ne: null, $lt: new Date() } }, { projection: { bookingId: 1 } })
    .toArray()
  if (!expired.length) return
  const bookingIds = [...new Set(expired.map((s) => s.bookingId.toString()))].map(toObjectId)
  await slots.deleteMany({ bookingId: { $in: bookingIds } })
  await getDB()
    .collection(BOOKINGS)
    .updateMany({ _id: { $in: bookingIds }, status: 'pending_payment' }, { $set: { status: 'expired' } })
}

const DUPLICATE_KEY = 11000

// Claims every slot the booking covers, or none of them.
const claimSlots = async ({ bookingId, court, date, start, minutes, heldUntil = null }) => {
  const slots = await getSlots()
  await releaseExpiredHolds(slots, { court, date })
  const docs = slotsCovered(rules(), start, minutes).map((t) => ({
    court,
    date,
    start: t,
    bookingId,
    heldUntil,
  }))
  try {
    await slots.insertMany(docs, { ordered: true })
  } catch (err) {
    await slots.deleteMany({ bookingId })
    if (err?.code === DUPLICATE_KEY || err?.writeErrors?.some?.((e) => e.code === DUPLICATE_KEY)) {
      throwError('Sorry, that time has just been booked. Please choose another.')
    }
    throw err
  }
}

const releaseSlots = async (bookingId) => (await getSlots()).deleteMany({ bookingId })

// ==================== input ====================

const isClubDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '')

const validateDate = (date) => {
  if (!isClubDate(date)) throwError('Choose a date')
  if (date < clubDate()) throwError('That date has passed')
}

// The time itself: a real start on the half hour, at least the minimum, not
// past closing, and — today — not already gone.
const validateBookingRequest = (body, r) => {
  if (!body) throwError('Choose a time')
  validateDate(body.date)
  const court = Number(body.court)
  if (!courts().includes(court)) throwError('Choose a court')
  const start = Number(body.start)
  const minutes = Number(body.minutes)
  if (!isValidBookingTime(r, start, minutes)) throwError('Choose a start time and length')
  if (body.date === clubDate() && start <= clubMinutesOfDay()) throwError('That time has passed')
  return { date: body.date, court, start, minutes }
}

const validateGuest = (body) => {
  const errors = []
  if (!body?.firstName?.trim()) errors.push('First name is required')
  if (!body?.lastName?.trim()) errors.push('Last name is required')
  if (!isValidEmail(body?.email)) errors.push('Enter a valid email address')
  if (!normalizePhone(body?.phone)) errors.push('Enter a valid Canadian/US phone number')
  if (errors.length) throwError(errors.join('\n'))
}

const validatePlayer = (auth) => {
  if (!auth?.playerId) throwError('Sign in with a player account to book with credits')
}

// ==================== reading ====================

const playerName = (p) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim()

/**
 * The bookings on one day: who is shown depends on who is asking. Everyone
 * sees that a time is taken; a player also sees which bookings are theirs;
 * an admin sees whose every booking is.
 */
export const getBookingDay = async (params, auth) => {
  await requireModules('booking', 'calendar')
  if (!isClubDate(params?.date)) throwError('Choose a date')
  const slots = await getSlots()
  for (const court of courts()) await releaseExpiredHolds(slots, { court, date: params.date })
  const hours = await getBookingHours()

  const bookings = await getDB()
    .collection(BOOKINGS)
    .find(
      { date: params.date, status: { $in: ['confirmed', 'pending_payment'] } },
      { projection: { court: 1, start: 1, minutes: 1, status: 1, playerId: 1, name: 1 } },
    )
    .sort({ start: 1 })
    .toArray()

  return {
    date: params.date,
    today: clubDate(),
    nowMinutes: clubMinutesOfDay(),
    courts: courts(),
    openTime: hours.openTime,
    closeTime: hours.closeTime,
    paymentsAvailable: paymentsAvailable(),
    bookings: bookings.map((b) => {
      const mine = !!auth?.playerId && b.playerId?.toString() === auth.playerId
      return {
        _id: b._id.toString(),
        court: b.court,
        start: b.start,
        minutes: b.minutes,
        mine,
        ...(mine || auth?.isAdmin ? { name: b.name } : {}),
      }
    }),
  }
}

/** The signed-in player's bookings, newest first. */
export const getMyBookings = async (_params, auth) => {
  await requireModules('myBooking')
  validatePlayer(auth)
  const bookings = await getDB()
    .collection(BOOKINGS)
    .find({ playerId: toObjectId(auth.playerId), status: 'confirmed' })
    .sort({ date: -1, start: -1 })
    .toArray()
  const withCodes = await Promise.all(bookings.map(ensureDoorCodeIfStillUseful))
  return withCodes.map((b) => ({
    _id: b._id.toString(),
    date: b.date,
    court: b.court,
    start: b.start,
    minutes: b.minutes,
    credits: b.credits,
    paidWith: b.paidWith,
    amountCents: b.amountCents,
    balanceAfter: b.balanceAfter ?? null,
    name: b.name,
    paidAt: b.paidAt ?? b.createdAt,
    createdAt: b.createdAt,
    doorCode: doorCodeView(b),
    receipt: buildReceipt(b),
  }))
}

/** The signed-in player's credit balance, and what credits cost. */
export const getMyCredits = async (_params, auth) => {
  await requireModules('credit')
  validatePlayer(auth)
  const player = await getDB()
    .collection(PLAYERS)
    .findOne({ _id: toObjectId(auth.playerId) }, { projection: { credits: 1 } })
  if (!player) throwError('Player not found')
  return { credits: player.credits || 0, paymentsAvailable: paymentsAvailable() }
}

// ==================== booking with credits ====================

const recordLedger = (entry) =>
  getDB().collection(LEDGER).insertOne({ ...entry, createdAt: new Date() })

// Takes the credits only if the balance covers them, in one update — two
// bookings at once cannot both spend the same credits.
const spendCredits = async (playerId, credits) => {
  const result = await getDB()
    .collection(PLAYERS)
    .findOneAndUpdate(
      { _id: toObjectId(playerId), credits: { $gte: credits } },
      { $inc: { credits: -credits } },
      { returnDocument: 'after', projection: { credits: 1 } },
    )
  const after = result?.value !== undefined ? result.value : result
  return after ? after.credits : null
}

/**
 * Book a court for the signed-in player, paid in credits. The booking is
 * written first, its slots claimed, and only then the credits taken; any
 * step that fails undoes the ones before it.
 */
export const bookCourt = async (body, auth) => {
  await requireModules('booking', 'calendar', 'credit')
  validatePlayer(auth)
  const request = validateBookingRequest(body, await loadRules())
  const credits = bookingCredits(rules(), request.minutes, request.date, request.start)

  const db = getDB()
  const player = await db.collection(PLAYERS).findOne({ _id: toObjectId(auth.playerId) })
  if (!player) throwError('Player not found')
  if ((player.credits || 0) < credits) throwError('Not enough credits. Please top up first.')

  const { insertedId: bookingId } = await db.collection(BOOKINGS).insertOne({
    ...request,
    playerId: player._id,
    name: playerName(player),
    credits,
    status: 'claiming',
    paidWith: 'credits',
    createdAt: new Date(),
  })

  try {
    await claimSlots({ bookingId, ...request })
  } catch (err) {
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throw err
  }

  const balance = await spendCredits(player._id, credits)
  if (balance === null) {
    await releaseSlots(bookingId)
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throwError('Not enough credits. Please top up first.')
  }

  await db
    .collection(BOOKINGS)
    .updateOne({ _id: bookingId }, { $set: { status: 'confirmed', paidAt: new Date(), balanceAfter: balance } })
  await recordLedger({ playerId: player._id, kind: 'booking', credits: -credits, balanceAfter: balance, bookingId })
  const completed = await completeBooking(bookingId)
  return { bookingId: bookingId.toString(), ...request, credits, balance, ...completed }
}

// ==================== booking as a guest ====================

/**
 * Hold a court for a guest while they pay. Returns the payment to complete;
 * the booking is only confirmed once it is paid.
 */
export const bookCourtAsGuest = async (body, auth) => {
  await requireModules('booking', 'calendar')
  const r = await loadRules()
  const request = validateBookingRequest(body, r)
  validateGuest(body)
  const amountCents = bookingPriceCents(r, request.minutes, request.date, request.start)
  const guest = {
    firstName: toTitleCase(body.firstName),
    lastName: toTitleCase(body.lastName),
    email: body.email.trim(),
    phone: normalizePhone(body.phone),
  }

  const db = getDB()
  const heldUntil = new Date(Date.now() + r.guestHoldMinutes * 60 * 1000)
  const { insertedId: bookingId } = await db.collection(BOOKINGS).insertOne({
    ...request,
    guest,
    // A signed-in player paying by card (Credit turned off) still sees the
    // booking as theirs: on the calendar and in My Booking.
    ...(auth?.playerId ? { playerId: toObjectId(auth.playerId) } : {}),
    name: `${guest.firstName} ${guest.lastName}`,
    amountCents,
    status: 'pending_payment',
    paidWith: 'card',
    heldUntil,
    createdAt: new Date(),
  })

  try {
    await claimSlots({ bookingId, ...request, heldUntil })
  } catch (err) {
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throw err
  }

  const payment = await createPayment({ kind: 'guestBooking', amountCents, bookingId })
  await db.collection(BOOKINGS).updateOne({ _id: bookingId }, { $set: { paymentId: payment._id } })
  return {
    bookingId: bookingId.toString(),
    paymentId: payment._id.toString(),
    amountCents,
    heldUntil,
    paymentsAvailable: paymentsAvailable(),
  }
}

// ==================== topping up ====================

/** Start a top-up for the signed-in player. Credits arrive once it is paid. */
export const topUpCredits = async (body, auth) => {
  await requireModules('credit')
  validatePlayer(auth)
  const r = rules()
  const dollars = Number(body?.dollars)
  if (!isValidTopUp(r, dollars)) throwError(`Top up at least $${r.minTopUpDollars}, in whole dollars`)
  const payment = await createPayment({
    kind: 'topUp',
    amountCents: dollars * 100,
    credits: creditsForDollars(r, dollars),
    playerId: toObjectId(auth.playerId),
  })
  return {
    paymentId: payment._id.toString(),
    amountCents: payment.amountCents,
    credits: payment.credits,
    paymentsAvailable: paymentsAvailable(),
  }
}

// ==================== once a booking is confirmed ====================
//
// The door code, then the receipt by email. Neither can undo a booking that
// is already paid for: a failure is recorded on the booking (doorCodeError,
// receiptError), the code is tried again when the player opens My Bookings,
// and the club can resend by hand.

const ISSUING_TIMEOUT_MS = 60 * 1000

// When the door code works: a little before the booking to a little after.
const doorCodeWindow = (booking) => {
  const r = rules()
  return {
    validFrom: clubTimeToDate(booking.date, booking.start - r.doorCodeLeadMinutes),
    validUntil: clubTimeToDate(booking.date, booking.start + booking.minutes + r.doorCodeTrailMinutes),
  }
}

// Only one request issues a booking's code: two at once (the booking itself
// and an early look at My Bookings) would otherwise make two visitors.
const claimDoorCodeIssue = async (bookingId) => {
  const now = new Date()
  const result = await getDB()
    .collection(BOOKINGS)
    .findOneAndUpdate(
      {
        _id: bookingId,
        'doorCode.code': { $exists: false },
        $or: [
          { doorCodeIssuingAt: { $exists: false } },
          { doorCodeIssuingAt: { $lt: new Date(now.getTime() - ISSUING_TIMEOUT_MS) } },
        ],
      },
      { $set: { doorCodeIssuingAt: now } },
      { returnDocument: 'after' },
    )
  return result?.value !== undefined ? result.value : result
}

const visitFor = (booking, contact) => ({
  firstName: contact.firstName,
  lastName: contact.lastName,
  email: contact.email,
  phone: contact.phone,
  remarks: `Court booking ${booking._id.toString().slice(-8).toUpperCase()}`,
  ...doorCodeWindow(booking),
})

const bookingContact = async (booking) => {
  if (booking.guest) return booking.guest
  const player = await getDB()
    .collection(PLAYERS)
    .findOne({ _id: booking.playerId }, { projection: { firstName: 1, lastName: 1, email: 1, phone: 1 } })
  return player || {}
}

const ensureDoorCode = async (booking) => {
  if (booking.doorCode?.code || !doorAccessAvailable()) return booking
  const claimed = await claimDoorCodeIssue(booking._id)
  if (!claimed) return booking
  const bookings = getDB().collection(BOOKINGS)
  try {
    const doorCode = await issueDoorCode(visitFor(claimed, await bookingContact(claimed)))
    await bookings.updateOne(
      { _id: booking._id },
      { $set: { doorCode }, $unset: { doorCodeIssuingAt: '', doorCodeError: '' } },
    )
    return { ...claimed, doorCode }
  } catch (err) {
    console.error(`Door code for booking ${booking._id}:`, err.message)
    await bookings.updateOne(
      { _id: booking._id },
      { $set: { doorCodeError: err.message }, $unset: { doorCodeIssuingAt: '' } },
    )
    return claimed
  }
}

// My Bookings tries again for a booking still to come that has no code.
const ensureDoorCodeIfStillUseful = (booking) =>
  !booking.doorCode?.code && doorCodeWindow(booking).validUntil > new Date()
    ? ensureDoorCode(booking)
    : booking

const sendReceipt = async (booking) => {
  const bookings = getDB().collection(BOOKINGS)
  const { email } = await bookingContact(booking)
  try {
    if (!email) throwError('No email address on file')
    await sendBookingReceiptEmail(email, buildReceipt(booking))
    await bookings.updateOne(
      { _id: booking._id },
      { $set: { receiptSentAt: new Date(), receiptSentTo: email }, $unset: { receiptError: '' } },
    )
    return email
  } catch (err) {
    console.error(`Receipt for booking ${booking._id}:`, err.message)
    await bookings.updateOne({ _id: booking._id }, { $set: { receiptError: err.message } })
    return null
  }
}

/** The door code and receipt for a booking just confirmed. */
const completeBooking = async (bookingId) => {
  const booking = await getDB().collection(BOOKINGS).findOne({ _id: bookingId })
  const withCode = await ensureDoorCode(booking)
  const receiptSentTo = await sendReceipt(withCode)
  return { doorCode: doorCodeView(withCode), receiptSentTo }
}

// ==================== a payment completing ====================

const applyGuestBookingPayment = async (payment) => {
  const db = getDB()
  const booking = await db.collection(BOOKINGS).findOne({ _id: payment.bookingId })
  // The hold ran out (and the slots may already be someone else's), so the
  // money is not taken for a booking that no longer exists.
  if (!booking || booking.status !== 'pending_payment' || booking.heldUntil < new Date()) {
    return { ok: false, reason: 'Your hold on this time ran out. Please book again.' }
  }
  await db.collection(BOOKINGS).updateOne(
    { _id: booking._id },
    { $set: { status: 'confirmed', paidAt: new Date() }, $unset: { heldUntil: '' } },
  )
  await (await getSlots()).updateMany({ bookingId: booking._id }, { $set: { heldUntil: null } })
  const completed = await completeBooking(booking._id)
  return {
    ok: true,
    booking: { date: booking.date, court: booking.court, start: booking.start, minutes: booking.minutes },
    ...completed,
  }
}

const applyTopUpPayment = async (payment) => {
  const result = await getDB()
    .collection(PLAYERS)
    .findOneAndUpdate(
      { _id: payment.playerId },
      { $inc: { credits: payment.credits } },
      { returnDocument: 'after', projection: { credits: 1 } },
    )
  const after = result?.value !== undefined ? result.value : result
  await recordLedger({ playerId: payment.playerId, kind: 'topup', credits: payment.credits, balanceAfter: after.credits, paymentId: payment._id })
  return { ok: true, balance: after.credits }
}

const APPLY = { guestBooking: applyGuestBookingPayment, topUp: applyTopUpPayment }

/**
 * Complete a payment through the placeholder (see payments.js). A top-up can
 * only be completed by the player it is for.
 */
export const confirmPayment = async (body, auth) => {
  if (!isPlaceholderPaymentAllowed()) throwError('Online payment is not available yet')
  if (!body?.paymentId) throwError('Payment is required')
  const payment = await findPayment(body.paymentId)
  if (!payment) throwError('Payment not found')
  await requireModules(payment.kind === 'topUp' ? 'credit' : 'booking')
  if (payment.kind === 'topUp' && payment.playerId?.toString() !== auth?.playerId) {
    throwError('Payment not found')
  }
  if (payment.status !== 'pending') throwError('This payment has already been completed')

  // A guest booking whose hold has lapsed is refused before anything is paid.
  if (payment.kind === 'guestBooking') {
    const booking = await getDB().collection(BOOKINGS).findOne({ _id: payment.bookingId })
    if (!booking || booking.status !== 'pending_payment' || booking.heldUntil < new Date()) {
      await markPaymentFailed(payment._id, 'hold expired')
      throwError('Your hold on this time ran out. Please book again.')
    }
  }

  if (!(await markPaymentPaid(payment._id))) throwError('This payment has already been completed')
  const result = await APPLY[payment.kind](payment)
  if (!result.ok) throwError(result.reason)
  return { kind: payment.kind, ...result }
}
