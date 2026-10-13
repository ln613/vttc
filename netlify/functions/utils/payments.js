// Card payments. A payment is recorded here as pending, and only a verified
// card payment marks it paid before what it pays for — a guest's booking, or
// a player's credits — happens.
//
// The card goes through Moneris Checkout (monerisCheckout.js) where the site
// has it set up: each payment gets a Moneris ticket the browser opens the
// card form with, and the receipt is checked here before anything is paid.
//
// Without Moneris there is a placeholder: a "Simulate payment" button that
// marks the payment paid with no card involved. It gives away bookings and
// credits for nothing, so it only works where PAYMENTS_MODE=placeholder is
// set — local dev, or a demo site on purpose. Everywhere else the payment
// step says online payment is not available yet.

import { getDB, toObjectId } from './db.js'
import { club } from './club.js'
import {
  isMonerisConfigured,
  monerisEnvironment,
  monerisScriptUrl,
  preloadCheckout,
  checkoutReceipt,
} from './monerisCheckout.js'

const COLLECTION = 'payments'

export const PAYMENT_KINDS = ['guestBooking', 'topUp']

const throwError = (message) => {
  throw new Error(message)
}

export const isPlaceholderPaymentAllowed = () => process.env.PAYMENTS_MODE === 'placeholder'

// Who takes the card: Moneris where it is set up, else the placeholder where
// allowed, else nobody.
const paymentProvider = () => {
  if (isMonerisConfigured()) return 'moneris'
  if (isPlaceholderPaymentAllowed()) return 'placeholder'
  return null
}

// Whether this site can take a payment at all right now.
export const paymentsAvailable = () => paymentProvider() !== null

export const createPayment = async ({ kind, amountCents, language, ...details }) => {
  if (!PAYMENT_KINDS.includes(kind)) throwError('Unknown payment kind')
  if (!Number.isInteger(amountCents) || amountCents <= 0) throwError('Invalid amount')
  const payment = {
    kind,
    amountCents,
    currency: 'cad',
    status: 'pending',
    provider: paymentProvider() || 'none',
    createdAt: new Date(),
    ...details,
  }
  const result = await getDB().collection(COLLECTION).insertOne(payment)
  const created = { ...payment, _id: result.insertedId }
  if (payment.provider !== 'moneris') return created
  try {
    return await issueTicket(created, { language })
  } catch (err) {
    // No card form, so nothing can be paid: the payment is over before it
    // started.
    await markPaymentFailed(created._id, 'no card form')
    throw err
  }
}

// ==================== Moneris tickets ====================

// Moneris wants an order number no other payment of the store has used —
// the test store is shared with everyone, hence the club in it — and a fresh
// one for every new ticket of the same payment.
const orderNumber = (payment, attempt) =>
  `${club.slug || 'club'}-${payment._id.toString()}-${attempt}`

// A ticket for the payment's card form; the payment remembers the latest.
const issueTicket = async (payment, { language } = {}) => {
  const attempt = (payment.attempts || 0) + 1
  const orderNo = orderNumber(payment, attempt)
  const { ticket } = await preloadCheckout({
    amountCents: payment.amountCents,
    orderNo,
    language: language === 'fr' ? 'fr' : 'en',
  })
  const update = { ticket, orderNo, attempts: attempt, ticketIssuedAt: new Date() }
  await getDB().collection(COLLECTION).updateOne({ _id: payment._id }, { $set: update })
  return { ...payment, ...update }
}

/** A new ticket for a pending payment whose card form was declined or left. */
export const renewTicket = async (payment, options) => {
  if (payment.status !== 'pending') throwError('This payment has already been completed')
  if (payment.provider !== 'moneris') throwError('This payment has no card form')
  return issueTicket(payment, options)
}

/**
 * What the browser needs to take the card: the Moneris ticket, environment
 * and script, or just the provider for the placeholder.
 */
export const checkoutFor = (payment) =>
  payment.provider === 'moneris'
    ? {
        provider: 'moneris',
        ticket: payment.ticket,
        environment: monerisEnvironment(),
        scriptUrl: monerisScriptUrl(),
      }
    : { provider: payment.provider }

/**
 * Whether the card payment went through, from the provider itself — never
 * from the browser's say-so. The placeholder counts as paid only where it
 * is allowed.
 */
export const verifyCardPayment = async (payment) => {
  if (payment.provider === 'moneris') {
    const { approved, details, error } = await checkoutReceipt({
      ticket: payment.ticket,
      orderNo: payment.orderNo,
      amountCents: payment.amountCents,
    })
    return approved
      ? { ok: true, receipt: details }
      : { ok: false, receipt: details, reason: declineReason(details, error) }
  }
  if (payment.provider === 'placeholder' && isPlaceholderPaymentAllowed()) {
    return { ok: true, receipt: null }
  }
  return { ok: false, reason: 'Online payment is not available yet' }
}

const declineReason = (details, error) => {
  if (details.result === 'd') return 'The card was declined. Please try again.'
  if (!details.result) return 'The payment was not completed. Please try again.'
  return `The payment could not be verified (${error}). Please try again.`
}

export const findPayment = (paymentId) =>
  getDB().collection(COLLECTION).findOne({ _id: toObjectId(paymentId) })

// Pending -> paid, once: the filter on status makes a second call (a double
// click, a webhook retry) a no-op that reports false rather than paying for
// the same thing twice.
// `receipt` is the provider's record of the card payment (approval code,
// reference, card type and last 4 — never the card number).
export const markPaymentPaid = async (paymentId, receipt = null) => {
  const result = await getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(paymentId), status: 'pending' },
      { $set: { status: 'paid', paidAt: new Date(), ...(receipt ? { receipt } : {}) } },
    )
  return result.modifiedCount === 1
}

// Paid by card, but what it paid for could not be given (a guest's time was
// taken after the hold ran out): the club refunds it from Moneris.
export const markRefundDue = (paymentId, reason) =>
  getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(paymentId) },
      { $set: { refundDue: true, refundReason: reason } },
    )

export const markPaymentFailed = (paymentId, reason) =>
  getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(paymentId), status: 'pending' },
      { $set: { status: 'failed', failedReason: reason, failedAt: new Date() } },
    )
