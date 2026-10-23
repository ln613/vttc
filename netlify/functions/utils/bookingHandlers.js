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
import { issueDoorCode, doorAccessAvailable, revokeDoorCode } from './doorAccess.js'
import { buildReceipt, buildTopUpReceipt, buildCancellationReceipt, doorCodeView } from './bookingReceipt.js'
import { sendBookingReceiptEmail, sendReceiptEmail } from './email.js'
import { getBookingHours, getTopUpOptions } from './settingsHandlers.js'
import { loadBookingRates, loadBookingRules } from './bookingRatesHandlers.js'
import { addRewardPoints } from './rewardsHandlers.js'
import { requireWaiverAccepted, guestWaiverAcceptance } from './waiverHandlers.js'
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
import { clubTaxes, withTaxes } from '../../../shared/rules/tax.js'
import { findTopUpOption, isPointsModel } from '../../../shared/rules/wallet.js'
import { toTitleCase } from '../../../shared/rules/nameMatch.js'
import {
  createPayment,
  findPayment,
  markPaymentPaid,
  markPaymentFailed,
  markRefundDue,
  markReceiptSent,
  findPaidTopUps,
  paymentsAvailable,
  checkoutFor,
  renewTicket,
  verifyCardPayment,
  logAttempt,
} from './payments.js'

const BOOKINGS = 'bookings'
const SLOTS = 'bookingSlots'
const PLAYERS = 'players'
const LEDGER = 'creditTransactions'

const throwError = (message) => {
  throw new Error(message)
}

const rules = () => bookingRules(club.booking)

// The rules with today's opening hours and prices, which an admin sets on
// the Settings page (settingsHandlers.js, bookingRatesHandlers.js) — the
// club config's are only the default.
const loadRules = loadBookingRules

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

// A guest who never finished paying no longer holds anything — unless their
// card did go through and the page just never said so (closed right after
// paying): then the booking is confirmed instead of let go.
const releaseExpiredHolds = async (slots, { court, date }) => {
  const expired = await slots
    .find({ court, date, heldUntil: { $ne: null, $lt: new Date() } }, { projection: { bookingId: 1 } })
    .toArray()
  if (!expired.length) return
  const lapsed = [...new Set(expired.map((s) => s.bookingId.toString()))].map(toObjectId)
  const bookingIds = []
  for (const bookingId of lapsed) {
    if (!(await completePaidInTheMeantime(bookingId))) bookingIds.push(bookingId)
  }
  if (!bookingIds.length) return
  await slots.deleteMany({ bookingId: { $in: bookingIds } })
  await getDB()
    .collection(BOOKINGS)
    .updateMany({ _id: { $in: bookingIds }, status: 'pending_payment' }, { $set: { status: 'expired' } })
}

// Asks the card provider about a lapsed guest booking's payment; when it was
// in fact paid, completes it as confirmPayment would have.
const completePaidInTheMeantime = async (bookingId) => {
  const booking = await getDB().collection(BOOKINGS).findOne({ _id: bookingId })
  if (!booking?.paymentId || booking.status !== 'pending_payment') return false
  const payment = await findPayment(booking.paymentId)
  if (payment?.provider !== 'moneris' || payment.status !== 'pending' || !payment.ticket) return false
  try {
    const verified = await verifyCardPayment(payment)
    if (!verified.ok) return false
    if (!(await markPaymentPaid(payment._id, verified.receipt))) return false
    const result = await applyGuestBookingPayment(payment)
    return result.ok
  } catch {
    return false
  }
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

// What the balance is called in a message: credits, or (points model, where
// it is dollars) the balance — specs/rules/wallet.md.
const pointsClub = () => isPointsModel(club)
const NOT_ENOUGH = () =>
  pointsClub()
    ? 'Not enough balance. Please top up first.'
    : 'Not enough credits. Please top up first.'

const validatePlayer = (auth) => {
  if (!auth?.playerId) {
    throwError(
      pointsClub()
        ? 'Sign in with a player account to book with your balance'
        : 'Sign in with a player account to book with credits',
    )
  }
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
  const [hours, rates] = await Promise.all([getBookingHours(), loadBookingRates()])

  const bookings = await getDB()
    .collection(BOOKINGS)
    .find(
      { date: params.date, status: { $in: ['confirmed', 'pending_payment', 'blocked'] } },
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
    // The day's prices, so the page shows what booking will charge.
    rates: rates.weekly,
    oneTimeRates: rates.oneTime.filter((r) => r.date === params.date),
    paymentsAvailable: paymentsAvailable(),
    bookings: bookings.map((b) => {
      const mine = !!auth?.playerId && b.playerId?.toString() === auth.playerId
      return {
        _id: b._id.toString(),
        court: b.court,
        start: b.start,
        minutes: b.minutes,
        mine,
        // A time an admin has blocked looks booked to everyone else.
        ...(auth?.isAdmin && b.status === 'blocked' ? { blocked: true } : {}),
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
    waiver: b.waiver ?? null,
    doorCode: doorCodeView(b),
    receipt: buildReceipt(b),
    cancellableUntil: cancellableUntil(b)?.toISOString() ?? null,
  }))
}

/**
 * The signed-in player's balance (credits), their reward points (points
 * model), and whether a top-up can be paid for here.
 */
export const getMyCredits = async (_params, auth) => {
  await requireModules('credit')
  validatePlayer(auth)
  const player = await getDB()
    .collection(PLAYERS)
    .findOne({ _id: toObjectId(auth.playerId) }, { projection: { credits: 1, points: 1 } })
  if (!player) throwError('Player not found')
  return {
    credits: player.credits || 0,
    points: player.points || 0,
    paymentsAvailable: paymentsAvailable(),
  }
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
  const waiver = await requireWaiverAccepted(auth.playerId)
  const r = await loadRules()
  const request = validateBookingRequest(body, r)
  const credits = bookingCredits(r, request.minutes, request.date, request.start)

  const db = getDB()
  const player = await db.collection(PLAYERS).findOne({ _id: toObjectId(auth.playerId) })
  if (!player) throwError('Player not found')
  if ((player.credits || 0) < credits) throwError(NOT_ENOUGH())

  const { insertedId: bookingId } = await db.collection(BOOKINGS).insertOne({
    ...request,
    playerId: player._id,
    name: playerName(player),
    credits,
    status: 'claiming',
    paidWith: 'credits',
    ...(waiver ? { waiver } : {}),
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
    throwError(NOT_ENOUGH())
  }

  await db
    .collection(BOOKINGS)
    .updateOne({ _id: bookingId }, { $set: { status: 'confirmed', paidAt: new Date(), balanceAfter: balance } })
  await recordLedger({ playerId: player._id, kind: 'booking', credits: -credits, balanceAfter: balance, bookingId })
  const completed = await completeBooking(bookingId)
  return { bookingId: bookingId.toString(), ...request, credits, balance, ...completed }
}

// ==================== cancelling ====================
//
// A player cancels a booking paid from their balance until a set time
// before it starts (48 hours): the balance gets all of it back, the time is
// free again, and the door code stops working. Card payments are never
// refunded here — the club does that from Moneris.

// When a booking stops being cancellable, or null if it never is.
const cancellableUntil = (booking) => {
  if (booking.paidWith !== 'credits' || !booking.playerId || !booking.credits) return null
  const start = clubTimeToDate(booking.date, booking.start)
  return new Date(start.getTime() - rules().cancelHoursBefore * 60 * 60 * 1000)
}

const validateCancellable = (booking) => {
  if (!booking || booking.status !== 'confirmed') throwError('Booking not found')
  const until = cancellableUntil(booking)
  if (!until) throwError('This booking cannot be cancelled online. Please contact the club.')
  if (until <= new Date()) {
    throwError(`A booking can only be cancelled up to ${rules().cancelHoursBefore} hours before it starts`)
  }
}

/** The signed-in player cancels their own booking; the balance is refunded. */
export const cancelBooking = async (body, auth) => {
  await requireModules('booking', 'myBooking')
  validatePlayer(auth)
  if (!body?.bookingId) throwError('Choose the booking to cancel')
  const db = getDB()
  const bookingId = toObjectId(body.bookingId)
  const booking = await db
    .collection(BOOKINGS)
    .findOne({ _id: bookingId, playerId: toObjectId(auth.playerId) })
  validateCancellable(booking)

  // Only one request gets past here, so the refund is made once.
  const claimed = await db
    .collection(BOOKINGS)
    .updateOne({ _id: bookingId, status: 'confirmed' }, { $set: { status: 'cancelled', cancelledAt: new Date() } })
  if (!claimed.modifiedCount) throwError('This booking has already been cancelled')

  await releaseSlots(bookingId)
  const balance = await refundCredits(booking)
  await db
    .collection(BOOKINGS)
    .updateOne({ _id: bookingId }, { $set: { refundedCredits: booking.credits, balanceAfterRefund: balance } })
  await revokeBookingDoorCode(booking)
  const cancelled = { ...booking, status: 'cancelled', refundedCredits: booking.credits, balanceAfterRefund: balance }
  const emailSentTo = await sendCancellation(cancelled)
  return { bookingId: body.bookingId, refunded: booking.credits, balance, emailSentTo }
}

const refundCredits = async (booking) => {
  const result = await getDB()
    .collection(PLAYERS)
    .findOneAndUpdate(
      { _id: booking.playerId },
      { $inc: { credits: booking.credits } },
      { returnDocument: 'after', projection: { credits: 1 } },
    )
  const after = result?.value !== undefined ? result.value : result
  await recordLedger({
    playerId: booking.playerId,
    kind: 'refund',
    credits: booking.credits,
    balanceAfter: after.credits,
    bookingId: booking._id,
  })
  return after.credits
}

// The code must not open the door for a booking that is gone. If UniFi
// can't be reached the cancellation still stands; the error is kept on the
// booking for the club to remove the visitor by hand.
const revokeBookingDoorCode = async (booking) => {
  if (!booking.doorCode?.code) return
  try {
    await revokeDoorCode(booking.doorCode)
  } catch (err) {
    console.error(`Door code for cancelled booking ${booking._id}:`, err.message)
    await getDB()
      .collection(BOOKINGS)
      .updateOne({ _id: booking._id }, { $set: { doorCodeRevokeError: err.message } })
  }
}

const sendCancellation = async (booking) => {
  const { email } = await bookingContact(booking)
  try {
    if (!email) throwError('No email address on file')
    await sendReceiptEmail(email, buildCancellationReceipt(booking))
    await getDB()
      .collection(BOOKINGS)
      .updateOne({ _id: booking._id }, { $set: { cancellationSentTo: email } })
    return email
  } catch (err) {
    console.error(`Cancellation email for booking ${booking._id}:`, err.message)
    await getDB()
      .collection(BOOKINGS)
      .updateOne({ _id: booking._id }, { $set: { cancellationEmailError: err.message } })
    return null
  }
}

// ==================== blocking a time ====================

/**
 * An admin takes a time off the calendar without booking it: it shows as
 * booked, but nobody pays, no door code or email, and it is in nobody's
 * bookings. Unblocking frees it again.
 */
export const blockCourt = async (body, auth) => {
  await requireModules('booking', 'calendar')
  const request = validateBookingRequest(body, await loadRules())
  const db = getDB()
  const { insertedId: bookingId } = await db.collection(BOOKINGS).insertOne({
    ...request,
    name: 'Blocked',
    status: 'blocked',
    blockedBy: auth?.playerId ? toObjectId(auth.playerId) : 'admin',
    createdAt: new Date(),
  })
  try {
    await claimSlots({ bookingId, ...request })
  } catch (err) {
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throw err
  }
  return { bookingId: bookingId.toString(), ...request }
}

/** An admin frees a blocked time. */
export const unblockCourt = async (body) => {
  await requireModules('booking', 'calendar')
  if (!body?.bookingId) throwError('Choose the blocked time')
  const bookingId = toObjectId(body.bookingId)
  const result = await getDB()
    .collection(BOOKINGS)
    .updateOne({ _id: bookingId, status: 'blocked' }, { $set: { status: 'unblocked', unblockedAt: new Date() } })
  if (!result.modifiedCount) throwError('That time is not blocked')
  await releaseSlots(bookingId)
  return { success: true }
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
  const waiver = await guestWaiverAcceptance(body, auth)
  // Charged by card with the club's tax on top (tax.js).
  const priced = withTaxes(
    clubTaxes(club.booking),
    bookingPriceCents(r, request.minutes, request.date, request.start),
  )
  const amountCents = priced.totalCents
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
    subtotalCents: priced.subtotalCents,
    taxes: priced.taxes,
    status: 'pending_payment',
    paidWith: 'card',
    heldUntil,
    ...(waiver ? { waiver } : {}),
    createdAt: new Date(),
  })

  try {
    await claimSlots({ bookingId, ...request, heldUntil })
  } catch (err) {
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throw err
  }

  let payment
  try {
    payment = await createPayment({
      kind: 'guestBooking',
      amountCents,
      subtotalCents: priced.subtotalCents,
      taxes: priced.taxes,
      bookingId,
      language: body.language,
    })
  } catch (err) {
    // No card form to pay with (Moneris unreachable or refusing): let the
    // time go rather than hold it for nobody.
    await releaseSlots(bookingId)
    await db.collection(BOOKINGS).deleteOne({ _id: bookingId })
    throw err
  }
  await db.collection(BOOKINGS).updateOne({ _id: bookingId }, { $set: { paymentId: payment._id } })
  return {
    bookingId: bookingId.toString(),
    paymentId: payment._id.toString(),
    amountCents,
    subtotalCents: priced.subtotalCents,
    taxes: priced.taxes,
    heldUntil,
    paymentsAvailable: paymentsAvailable(),
    checkout: checkoutFor(payment),
  }
}

// ==================== topping up ====================

/**
 * Start a top-up for the signed-in player. The balance (and, for a points
 * club, the reward points) arrive once it is paid.
 */
export const topUpCredits = async (body, auth) => {
  await requireModules('credit')
  validatePlayer(auth)
  await requireWaiverAccepted(auth.playerId)
  const r = rules()
  const dollars = Number(body?.dollars)
  const points = await topUpRewardPoints(r, dollars)
  // The balance gets the top-up's own amount; the card pays it plus tax.
  const priced = withTaxes(clubTaxes(club.booking), dollars * 100)
  const payment = await createPayment({
    kind: 'topUp',
    amountCents: priced.totalCents,
    subtotalCents: priced.subtotalCents,
    taxes: priced.taxes,
    credits: creditsForDollars(r, dollars),
    points,
    playerId: toObjectId(auth.playerId),
    language: body?.language,
  })
  return {
    paymentId: payment._id.toString(),
    amountCents: payment.amountCents,
    subtotalCents: priced.subtotalCents,
    taxes: priced.taxes,
    credits: payment.credits,
    points: payment.points,
    paymentsAvailable: paymentsAvailable(),
    checkout: checkoutFor(payment),
  }
}

// A credits club takes any whole-dollar amount from its minimum up; a points
// club only the amounts it offers, each with its reward points (fixed into
// the payment now, so a later change to the offer can't alter it).
const topUpRewardPoints = async (r, dollars) => {
  if (!pointsClub()) {
    if (!isValidTopUp(r, dollars)) throwError(`Top up at least $${r.minTopUpDollars}, in whole dollars`)
    return 0
  }
  const option = findTopUpOption(await getTopUpOptions(), dollars)
  if (!option) throwError('Choose one of the top-up amounts')
  return option.points
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
  // The card is already charged here: the booking stands if its time is
  // still this booking's (or still free to take back); otherwise the club
  // owes a refund.
  if (!booking || !(await keepsItsTime(booking))) {
    const reason = 'paid after the hold ran out; the time was taken'
    await markRefundDue(payment._id, reason)
    if (booking) {
      await db.collection(BOOKINGS).updateOne({ _id: booking._id }, { $set: { status: 'refund_due' } })
    }
    return {
      ok: false,
      reason:
        'We received your payment, but this time was booked by someone else after your hold ran out. The club will refund you.',
    }
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

// Whether a paid guest booking still has its court time: held for it, or
// — the hold ran out and was let go — free to take again.
const keepsItsTime = async (booking) => {
  const held = await (await getSlots()).countDocuments({ bookingId: booking._id })
  if (held === slotsCovered(rules(), booking.start, booking.minutes).length) return true
  try {
    await claimSlots({
      bookingId: booking._id,
      court: booking.court,
      date: booking.date,
      start: booking.start,
      minutes: booking.minutes,
    })
    return true
  } catch {
    return false
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
  const points = payment.points
    ? await addRewardPoints(payment.playerId, payment.points, { kind: 'topUpReward', paymentId: payment._id })
    : null
  const receiptSentTo = await sendTopUpReceipt(payment._id, after.credits)
  return { ok: true, balance: after.credits, ...(points !== null ? { points } : {}), receiptSentTo }
}

// The top-up's receipt by email, as paid (with the card's details). Like a
// booking's, a failure to send never undoes it: it is noted on the payment.
const sendTopUpReceipt = async (paymentId, balanceAfter) => {
  const payment = await findPayment(paymentId)
  const player = await getDB()
    .collection(PLAYERS)
    .findOne({ _id: payment.playerId }, { projection: { firstName: 1, lastName: 1, email: 1 } })
  try {
    if (!player?.email) throwError('No email address on file')
    await sendReceiptEmail(player.email, buildTopUpReceipt(payment, { name: playerName(player), balanceAfter }))
    await markReceiptSent(payment._id, { sentTo: player.email })
    return player.email
  } catch (err) {
    console.error(`Receipt for top-up ${payment._id}:`, err.message)
    await markReceiptSent(payment._id, { error: err.message })
    return null
  }
}

/** The signed-in player's paid top-ups, newest first. */
export const getMyTopUps = async (_params, auth) => {
  await requireModules('credit')
  validatePlayer(auth)
  const payments = await findPaidTopUps(toObjectId(auth.playerId))
  return payments.map((p) => ({
    _id: p._id.toString(),
    paidAt: p.paidAt ?? p.createdAt,
    amountCents: p.amountCents,
    subtotalCents: p.subtotalCents ?? p.amountCents,
    taxes: p.taxes ?? [],
    credits: p.credits,
    points: p.points || 0,
    cardType: p.receipt?.cardType ?? null,
    last4: p.receipt?.last4 ?? null,
  }))
}

const APPLY = { guestBooking: applyGuestBookingPayment, topUp: applyTopUpPayment }

/**
 * Complete a payment once the card form says it is done. Whether it was paid
 * is asked of the card provider (verifyCardPayment), never taken from the
 * browser. A top-up can only be completed by the player it is for.
 */
export const confirmPayment = async (body, auth) => {
  const payment = await loadPayablePayment(body, auth)

  // Nothing has been charged yet with the placeholder, so a lapsed hold is
  // simply refused; a real card is checked first and then honoured.
  if (payment.provider !== 'moneris' && payment.kind === 'guestBooking') {
    await refuseLapsedHold(payment)
  }

  const verified = await verifyCardPayment(payment)
  if (!verified.ok) {
    await logAttempt(payment, `not paid: ${verified.reason}`, verified.receipt)
    throwError(verified.reason)
  }
  if (!(await markPaymentPaid(payment._id, verified.receipt))) {
    throwError('This payment has already been completed')
  }
  const result = await APPLY[payment.kind](payment)
  if (!result.ok) throwError(result.reason)
  return { kind: payment.kind, ...result }
}

/**
 * A fresh card form for a pending payment — after a decline, or a form left
 * or expired (a Moneris ticket lasts 30 minutes).
 */
export const renewPaymentTicket = async (body, auth) => {
  const payment = await loadPayablePayment(body, auth)
  // A card that did go through on an earlier form must not be asked for
  // again: the page completes the payment instead (confirmPayment).
  if (payment.provider === 'moneris' && (await verifyCardPayment(payment)).ok) {
    return { paymentId: payment._id.toString(), paid: true }
  }
  if (payment.kind === 'guestBooking') await refuseLapsedHold(payment)
  const renewed = await renewTicket(payment, {
    language: body?.language,
    reason: body?.reason ? `form: ${body.reason}` : undefined,
  })
  return { paymentId: renewed._id.toString(), checkout: checkoutFor(renewed) }
}

// The pending payment the caller may complete: anyone's guest booking (a
// guest has no account), only their own top-up.
const loadPayablePayment = async (body, auth) => {
  if (!body?.paymentId) throwError('Payment is required')
  const payment = await findPayment(body.paymentId)
  if (!payment) throwError('Payment not found')
  await requireModules(payment.kind === 'topUp' ? 'credit' : 'booking')
  if (payment.kind === 'topUp' && payment.playerId?.toString() !== auth?.playerId) {
    throwError('Payment not found')
  }
  if (payment.status !== 'pending') throwError('This payment has already been completed')
  return payment
}

// A guest booking whose hold has lapsed is refused before anything is paid.
const refuseLapsedHold = async (payment) => {
  const booking = await getDB().collection(BOOKINGS).findOne({ _id: payment.bookingId })
  if (!booking || booking.status !== 'pending_payment' || booking.heldUntil < new Date()) {
    await markPaymentFailed(payment._id, 'hold expired')
    throwError('Your hold on this time ran out. Please book again.')
  }
}
