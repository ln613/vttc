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

// A ticket for the payment's card form. The payment keeps every ticket it
// was given (`tickets`), not just the latest (`ticket`, `orderNo`): any of
// them may be the one the card was charged on.
const issueTicket = async (payment, { language } = {}) => {
  const attempt = (payment.attempts || 0) + 1
  const orderNo = orderNumber(payment, attempt)
  const { ticket } = await preloadCheckout({
    amountCents: payment.amountCents,
    orderNo,
    language: language === 'fr' ? 'fr' : 'en',
  })
  const issuedAt = new Date()
  const update = { ticket, orderNo, attempts: attempt, ticketIssuedAt: issuedAt }
  await getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: payment._id },
      { $set: update, $push: { tickets: { ticket, orderNo, attempt, issuedAt } } },
    )
  return {
    ...payment,
    ...update,
    tickets: [...ticketsOf(payment), { ticket, orderNo, attempt, issuedAt }],
  }
}

// Every ticket of a payment, latest last — including a payment made before
// the history was kept, which has only its latest.
const ticketsOf = (payment) =>
  payment.tickets?.length
    ? payment.tickets
    : payment.ticket
      ? [{ ticket: payment.ticket, orderNo: payment.orderNo, attempt: payment.attempts || 1 }]
      : []

/**
 * A new ticket for a pending payment whose card form was declined, failed or
 * was left. `reason` — why a new one is needed — is kept on the payment
 * (`attemptLog`), so a failed payment can be understood afterwards.
 */
export const renewTicket = async (payment, { language, reason } = {}) => {
  if (payment.status !== 'pending') throwError('This payment has already been completed')
  if (payment.provider !== 'moneris') throwError('This payment has no card form')
  if (reason) await logAttempt(payment, reason)
  return issueTicket(payment, { language })
}

/** Note on the payment why its latest card form didn't end in a payment. */
export const logAttempt = (payment, reason, receipt = null) =>
  getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: payment._id },
      {
        $push: {
          attemptLog: {
            attempt: payment.attempts || 1,
            reason: String(reason).slice(0, 500),
            ...(receipt ? { receipt } : {}),
            at: new Date(),
          },
        },
      },
    )

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
  if (payment.provider === 'moneris') return verifyMonerisPayment(payment)
  if (payment.provider === 'placeholder' && isPlaceholderPaymentAllowed()) {
    return { ok: true, receipt: null }
  }
  return { ok: false, reason: 'Online payment is not available yet' }
}

// Every ticket the payment was given is asked, latest first: the card may
// have gone through on an earlier form than the one on screen now. Approved
// on more than one means the card was charged twice — the extra is flagged
// for the club to refund.
const verifyMonerisPayment = async (payment) => {
  const tickets = [...ticketsOf(payment)].reverse()
  const approved = []
  let latest = null
  for (const t of tickets) {
    const result = await checkoutReceipt({
      ticket: t.ticket,
      orderNo: t.orderNo,
      amountCents: payment.amountCents,
    })
    if (!latest) latest = result
    if (result.approved) approved.push(result.details)
  }
  if (approved.length > 1) {
    await markRefundDue(payment._id, `charged ${approved.length} times (orders ${approved.map((d) => d.orderNo).join(', ')}); refund all but one`)
  }
  if (approved.length) return { ok: true, receipt: approved[0] }
  return {
    ok: false,
    receipt: latest?.details || null,
    reason: declineReason(latest?.details || {}, latest?.error),
  }
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
