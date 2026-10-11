// How a club's players hold money with it — see specs/rules/wallet.md.
//
// Two models, chosen in the club config (`creditModel`):
//
//   credits  (the default) top up dollars, get credits ($1 = 100), and pay
//            for bookings in credits.
//   points   top up dollars and keep them as a dollar balance that pays for
//            bookings; some top-up amounts also give reward points. Points
//            pay for nothing — they are redeemed for gifts at the club.
//
// Either way the balance is stored the same way (players.credits, at the
// club's creditsPerDollar), so booking and its ledger work unchanged; only
// how it is shown and topped up differs. Points are a separate number
// (players.points). Plain JavaScript, shared by the functions and the app.

export const CREDIT_MODELS = ['credits', 'points']

export const creditModelOf = (config) =>
  config?.creditModel === 'points' ? 'points' : 'credits'

export const isPointsModel = (config) => creditModelOf(config) === 'points'

/**
 * The top-up amounts a points club offers, each with the reward points it
 * gives. An admin changes them on the Settings page.
 */
export const DEFAULT_TOP_UP_OPTIONS = [
  { dollars: 25, points: 0 },
  { dollars: 50, points: 50 },
  { dollars: 100, points: 125 },
  { dollars: 200, points: 300 },
  { dollars: 500, points: 875 },
  { dollars: 1000, points: 2000 },
]

const MAX_TOP_UP_OPTIONS = 12
const MAX_TOP_UP_DOLLARS = 10000

const isWholeNumber = (n, min) => Number.isInteger(n) && n >= min

// Why a list of top-up options can't be saved, or null when it can.
export const topUpOptionsError = (options) => {
  if (!Array.isArray(options) || options.length === 0) {
    return 'Add at least one top-up amount'
  }
  if (options.length > MAX_TOP_UP_OPTIONS) {
    return `At most ${MAX_TOP_UP_OPTIONS} top-up amounts`
  }
  const bad = options.find(
    (o) =>
      !isWholeNumber(o?.dollars, 1) ||
      o.dollars > MAX_TOP_UP_DOLLARS ||
      !isWholeNumber(o?.points, 0),
  )
  if (bad) {
    return `Each amount must be $1 to $${MAX_TOP_UP_DOLLARS} in whole dollars, with 0 or more points`
  }
  const dollars = options.map((o) => o.dollars)
  if (new Set(dollars).size !== dollars.length) {
    return 'Each top-up amount can only be listed once'
  }
  return null
}

/** Smallest amount first, as the top-up dialog lists them. */
export const sortTopUpOptions = (options) =>
  [...options]
    .map((o) => ({ dollars: Number(o.dollars), points: Number(o.points) }))
    .sort((a, b) => a.dollars - b.dollars)

export const findTopUpOption = (options, dollars) =>
  (options || []).find((o) => o.dollars === Number(dollars))

/** The stored balance as cents (points model: the balance is dollars). */
export const balanceCents = (credits, creditsPerDollar) =>
  Math.round((credits * 100) / creditsPerDollar)

// ==================== gifts ====================

export const MAX_REDEEM_QUANTITY = 99

/** Points a redemption costs. */
export const redemptionPoints = (giftPoints, quantity) => giftPoints * quantity

export const isValidRedeemQuantity = (quantity) =>
  Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_REDEEM_QUANTITY

/**
 * A short id a member can read out at the desk, and the admin sees beside
 * their name when redeeming: the end of their account id.
 */
export const clubIdOf = (playerId) =>
  String(playerId || '')
    .slice(-6)
    .toUpperCase()
