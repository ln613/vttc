// A court booking's receipt, worded once: the email (email.js) and the My
// Bookings page show the same lines. See specs/rules/booking.md ("Receipt").

import { club, formatClubTime, getClubTimezone } from './club.js'
import {
  formatClock,
  formatLength,
  formatDollars,
  formatCredits,
  bookingRules,
} from '../../../shared/rules/booking.js'
import { balanceCents, isPointsModel } from '../../../shared/rules/wallet.js'

const throwError = (message) => {
  throw new Error(message)
}

// Short enough to read out at the desk, from the booking's own id.
export const bookingRef = (booking) => booking._id.toString().slice(-8).toUpperCase()

const courtName = (court) => {
  const label = club.booking?.courtLabel || 'Court'
  return (club.tables?.all || [1]).length > 1 ? `${label} ${court}` : label
}

const longDate = (date) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })

const clubDateTime = (instant) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: getClubTimezone(),
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant)

// A balance amount as the club's model shows it: "3,000 credits", or (points
// model, where the balance is dollars) "$30.00" — specs/rules/wallet.md.
const balanceAmount = (credits) =>
  isPointsModel(club)
    ? formatDollars(balanceCents(credits, bookingRules(club.booking).creditsPerDollar))
    : `${formatCredits(credits)} credits`

const paymentLines = (booking) =>
  booking.paidWith === 'credits'
    ? [
        {
          label: 'Paid',
          value: isPointsModel(club)
            ? `${balanceAmount(booking.credits)} from balance`
            : balanceAmount(booking.credits),
        },
        ...(booking.balanceAfter != null
          ? [{ label: 'Balance after', value: balanceAmount(booking.balanceAfter) }]
          : []),
      ]
    : cardLines(booking)

// A card payment: with the club's tax, the subtotal and each tax first.
const cardLines = (booking) => [
  ...(booking.taxes?.length
    ? [
        { label: 'Subtotal', value: formatDollars(booking.subtotalCents, true) },
        ...booking.taxes.map((t) => ({ label: `${t.name} (${t.rate}%)`, value: formatDollars(t.cents, true) })),
      ]
    : []),
  { label: 'Paid', value: `${formatDollars(booking.amountCents, !!booking.taxes?.length)} by card` },
]

// The liability waiver the booker accepted (specs/rules/waiver.md), when the
// club requires one: which version, and when.
const waiverLines = (booking) =>
  booking.waiver
    ? [
        {
          label: 'Liability waiver',
          value: `Accepted ${clubDateTime(booking.waiver.acceptedAt)} (version ${booking.waiver.version})`,
        },
      ]
    : []

// "Works 7:15 PM – 9:15 PM", or nothing when the booking has no code yet.
export const doorCodeView = (booking) =>
  booking.doorCode?.code
    ? {
        code: booking.doorCode.code,
        validFrom: booking.doorCode.validFrom,
        validUntil: booking.doorCode.validUntil,
        window: `${formatClubTime(booking.doorCode.validFrom)} – ${formatClubTime(booking.doorCode.validUntil)}`,
      }
    : null

/**
 * { title, ref, lines: [{label, value}], doorCode } for a confirmed booking.
 */
export const buildReceipt = (booking) => {
  if (!booking?._id) throwError('Booking is required')
  return {
    title: `${club.name} — Court Booking`,
    ref: bookingRef(booking),
    lines: [
      { label: 'Booking', value: bookingRef(booking) },
      { label: 'Name', value: booking.name },
      { label: 'Date', value: longDate(booking.date) },
      { label: 'Time', value: `${formatClock(booking.start)} – ${formatClock(booking.start + booking.minutes)}` },
      { label: 'Length', value: formatLength(booking.minutes) },
      { label: 'Court', value: courtName(booking.court) },
      ...paymentLines(booking),
      { label: 'Booked on', value: clubDateTime(booking.paidAt || booking.createdAt) },
      ...waiverLines(booking),
    ],
    doorCode: doorCodeView(booking),
  }
}
