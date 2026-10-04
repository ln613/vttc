// Card payments. Stripe is not wired up yet: a payment is recorded here as
// pending, and something has to mark it paid before what it pays for — a
// guest's booking, or a player's credits — happens.
//
// For now that something is a placeholder: a "Simulate payment" button that
// marks the payment paid with no card involved. It gives away bookings and
// credits for nothing, so it only works where PAYMENTS_MODE=placeholder is
// set — local dev, or a demo site on purpose. Everywhere else the payment
// step says online payment is not available yet.
//
// When Stripe arrives: create a Checkout Session where createPayment is
// called, and have its webhook call markPaymentPaid. Nothing that consumes a
// payment needs to change.

import { getDB, toObjectId } from './db.js'

const COLLECTION = 'payments'

export const PAYMENT_KINDS = ['guestBooking', 'topUp']

const throwError = (message) => {
  throw new Error(message)
}

export const isPlaceholderPaymentAllowed = () => process.env.PAYMENTS_MODE === 'placeholder'

// Whether this site can take a payment at all right now.
export const paymentsAvailable = () => isPlaceholderPaymentAllowed()

export const createPayment = async ({ kind, amountCents, ...details }) => {
  if (!PAYMENT_KINDS.includes(kind)) throwError('Unknown payment kind')
  if (!Number.isInteger(amountCents) || amountCents <= 0) throwError('Invalid amount')
  const payment = {
    kind,
    amountCents,
    currency: 'cad',
    status: 'pending',
    provider: 'placeholder',
    createdAt: new Date(),
    ...details,
  }
  const result = await getDB().collection(COLLECTION).insertOne(payment)
  return { ...payment, _id: result.insertedId }
}

export const findPayment = (paymentId) =>
  getDB().collection(COLLECTION).findOne({ _id: toObjectId(paymentId) })

// Pending -> paid, once: the filter on status makes a second call (a double
// click, a webhook retry) a no-op that reports false rather than paying for
// the same thing twice.
export const markPaymentPaid = async (paymentId) => {
  const result = await getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(paymentId), status: 'pending' },
      { $set: { status: 'paid', paidAt: new Date() } },
    )
  return result.modifiedCount === 1
}

export const markPaymentFailed = (paymentId, reason) =>
  getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(paymentId), status: 'pending' },
      { $set: { status: 'failed', failedReason: reason, failedAt: new Date() } },
    )
