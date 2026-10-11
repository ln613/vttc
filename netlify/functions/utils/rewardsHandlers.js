// Reward points and gifts — see specs/rules/wallet.md ("Points model").
//
// Only at a club on the points model, and only while its Credit module is
// on. Points are earned by topping up (bookingHandlers.js) and spent only
// here: an admin redeems a gift for a member at the club. Every change to a
// member's points is written to a ledger (pointTransactions) with the points
// after it, and every redemption is kept for both the member's history and
// the club's.

import { getDB, toObjectId } from './db.js'
import { club } from './club.js'
import { requireModules } from './modulesHandlers.js'
import {
  MAX_REDEEM_QUANTITY,
  clubIdOf,
  isPointsModel,
  isValidRedeemQuantity,
  redemptionPoints,
} from '../../../shared/rules/wallet.js'

const GIFTS = 'gifts'
const REDEMPTIONS = 'redemptions'
const POINTS_LEDGER = 'pointTransactions'
const PLAYERS = 'players'

const throwError = (message) => {
  throw new Error(message)
}

const throwErrors = (errors) => {
  if (errors.length) throwError(errors.join('\n'))
}

const requireRewards = async () => {
  if (!isPointsModel(club)) throwError('Rewards are not available at this club')
  await requireModules('credit')
}

const findOneAndUpdateResult = (result) =>
  result?.value !== undefined ? result.value : result

const playerName = (p) => `${p?.firstName || ''} ${p?.lastName || ''}`.trim()

// ==================== points ====================

const recordPoints = (entry) =>
  getDB()
    .collection(POINTS_LEDGER)
    .insertOne({ ...entry, createdAt: new Date() })

/** Add reward points to a member (a top-up's reward). Returns their points after. */
export const addRewardPoints = async (playerId, points, details = {}) => {
  const result = await getDB()
    .collection(PLAYERS)
    .findOneAndUpdate(
      { _id: toObjectId(playerId) },
      { $inc: { points } },
      { returnDocument: 'after', projection: { points: 1 } },
    )
  const after = findOneAndUpdateResult(result)
  if (!after) throwError('Player not found')
  await recordPoints({
    playerId: toObjectId(playerId),
    points,
    pointsAfter: after.points,
    ...details,
  })
  return after.points
}

// Takes the points only if the member has them, in one update — two
// redemptions at once cannot both spend the same points.
const spendPoints = async (playerId, points) => {
  const result = await getDB()
    .collection(PLAYERS)
    .findOneAndUpdate(
      { _id: toObjectId(playerId), points: { $gte: points } },
      { $inc: { points: -points } },
      { returnDocument: 'after', projection: { points: 1 } },
    )
  const after = findOneAndUpdateResult(result)
  return after ? after.points : null
}

// ==================== gifts ====================

const MAX_NAME_LENGTH = 80
const MAX_DESCRIPTION_LENGTH = 500
const MAX_GIFT_POINTS = 1000000
// The image arrives as a data URL, already shrunk in the browser to fit
// about 800px; this only stops something unreasonable being stored.
const MAX_IMAGE_LENGTH = 1500000

const giftView = (g) => ({
  _id: g._id.toString(),
  name: g.name,
  description: g.description || '',
  image: g.image || '',
  points: g.points,
})

const liveGift = { deletedAt: { $exists: false } }

/** Every gift, fewest points first. Anyone may look. */
export const getGifts = async () => {
  await requireRewards()
  const gifts = await getDB()
    .collection(GIFTS)
    .find(liveGift)
    .sort({ points: 1, name: 1 })
    .toArray()
  return gifts.map(giftView)
}

const isImage = (value) =>
  value === '' ||
  (typeof value === 'string' &&
    /^(data:image\/(png|jpeg|webp|gif);base64,|https:\/\/)/.test(value))

const validateGift = (body) => {
  if (!body) throwError('Gift details are required')
  const errors = []
  const name = (body.name || '').trim()
  if (!name) errors.push('Name is required')
  if (name.length > MAX_NAME_LENGTH)
    errors.push(`Name is at most ${MAX_NAME_LENGTH} characters`)
  if ((body.description || '').length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`Description is at most ${MAX_DESCRIPTION_LENGTH} characters`)
  }
  const points = Number(body.points)
  if (!Number.isInteger(points) || points < 1 || points > MAX_GIFT_POINTS) {
    errors.push('Points needed must be a whole number from 1')
  }
  const image = body.image ?? ''
  if (!isImage(image)) errors.push('The image must be a PNG, JPEG, WebP or GIF')
  if (image.length > MAX_IMAGE_LENGTH) errors.push('The image is too large')
  throwErrors(errors)
  return { name, description: (body.description || '').trim(), image, points }
}

/** Create a gift, or update one (with `_id`). */
export const saveGift = async (body) => {
  await requireRewards()
  const gift = validateGift(body)
  const gifts = getDB().collection(GIFTS)
  if (!body._id) {
    const { insertedId } = await gifts.insertOne({
      ...gift,
      createdAt: new Date(),
    })
    return giftView({ ...gift, _id: insertedId })
  }
  const result = await gifts.findOneAndUpdate(
    { _id: toObjectId(body._id), ...liveGift },
    { $set: { ...gift, updatedAt: new Date() } },
    { returnDocument: 'after' },
  )
  const saved = findOneAndUpdateResult(result)
  if (!saved) throwError('Gift not found')
  return giftView(saved)
}

// Kept, only hidden: the redemptions of it still name it.
export const deleteGift = async (body) => {
  await requireRewards()
  if (!body?._id) throwError('Gift is required')
  const result = await getDB()
    .collection(GIFTS)
    .updateOne(
      { _id: toObjectId(body._id), ...liveGift },
      { $set: { deletedAt: new Date() } },
    )
  if (result.matchedCount === 0) throwError('Gift not found')
  return { success: true }
}

// ==================== members ====================

const hasAccountOrPoints = {
  $or: [
    { password: { $nin: [null, ''] } },
    { googleId: { $exists: true, $nin: [null, ''] } },
    { points: { $gt: 0 } },
  ],
}

/**
 * Who a gift can be redeemed for: members with an account (or points), with
 * their club id and points, for the admin's redeem dialog.
 */
export const getRewardMembers = async () => {
  await requireRewards()
  const players = await getDB()
    .collection(PLAYERS)
    .find(hasAccountOrPoints, {
      projection: { firstName: 1, lastName: 1, points: 1 },
    })
    .sort({ firstName: 1, lastName: 1 })
    .toArray()
  return players.map((p) => ({
    _id: p._id.toString(),
    name: playerName(p),
    clubId: clubIdOf(p._id),
    points: p.points || 0,
  }))
}

// ==================== redeeming ====================

const validateRedeem = (body) => {
  if (!body) throwError('Choose a gift and a member')
  const errors = []
  if (!body.giftId) errors.push('Gift is required')
  if (!body.playerId) errors.push('Member is required')
  if (!isValidRedeemQuantity(Number(body.quantity))) {
    errors.push(`Number of items must be 1 to ${MAX_REDEEM_QUANTITY}`)
  }
  throwErrors(errors)
}

// Who handed the gift over: the admin's own name when they sign in as a
// player, otherwise the club's admin login.
const redeemedByName = async (auth) => {
  if (!auth?.playerId) return 'Club admin'
  const admin = await getDB()
    .collection(PLAYERS)
    .findOne(
      { _id: toObjectId(auth.playerId) },
      { projection: { firstName: 1, lastName: 1 } },
    )
  return playerName(admin) || 'Club admin'
}

/**
 * An admin redeems a gift for a member: the points are taken only if the
 * member has them all, then the redemption is recorded.
 */
export const redeemGift = async (body, auth) => {
  await requireRewards()
  validateRedeem(body)
  const db = getDB()
  const gift = await db
    .collection(GIFTS)
    .findOne({ _id: toObjectId(body.giftId), ...liveGift })
  if (!gift) throwError('Gift not found')
  const player = await db
    .collection(PLAYERS)
    .findOne({ _id: toObjectId(body.playerId) })
  if (!player) throwError('Member not found')

  const quantity = Number(body.quantity)
  const points = redemptionPoints(gift.points, quantity)
  const pointsAfter = await spendPoints(player._id, points)
  if (pointsAfter === null) throwError('Not enough points')

  const redemption = {
    playerId: player._id,
    playerName: playerName(player),
    clubId: clubIdOf(player._id),
    giftId: gift._id,
    giftName: gift.name,
    giftPoints: gift.points,
    quantity,
    points,
    pointsAfter,
    redeemedBy: await redeemedByName(auth),
    ...(auth?.playerId ? { redeemedById: toObjectId(auth.playerId) } : {}),
    createdAt: new Date(),
  }
  const { insertedId } = await db.collection(REDEMPTIONS).insertOne(redemption)
  await recordPoints({
    playerId: player._id,
    points: -points,
    pointsAfter,
    kind: 'redemption',
    redemptionId: insertedId,
  })
  return {
    redemption: redemptionView({ ...redemption, _id: insertedId }),
    points: pointsAfter,
  }
}

// ==================== history ====================

const redemptionView = (r) => ({
  _id: r._id.toString(),
  playerId: r.playerId.toString(),
  playerName: r.playerName,
  clubId: r.clubId,
  giftName: r.giftName,
  giftPoints: r.giftPoints,
  quantity: r.quantity,
  points: r.points,
  pointsAfter: r.pointsAfter,
  redeemedBy: r.redeemedBy,
  createdAt: r.createdAt,
})

const HISTORY_LIMIT = 500

/** The signed-in member's points and their redemptions, newest first. */
export const getMyRedemptions = async (_params, auth) => {
  await requireRewards()
  if (!auth?.playerId)
    throwError('Sign in with a player account to see your rewards')
  const db = getDB()
  const player = await db
    .collection(PLAYERS)
    .findOne({ _id: toObjectId(auth.playerId) }, { projection: { points: 1 } })
  if (!player) throwError('Player not found')
  const redemptions = await db
    .collection(REDEMPTIONS)
    .find({ playerId: player._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .toArray()
  return {
    points: player.points || 0,
    redemptions: redemptions.map(redemptionView),
  }
}

/** Every member's redemptions, newest first — the club's history. */
export const getRedemptions = async () => {
  await requireRewards()
  const redemptions = await getDB()
    .collection(REDEMPTIONS)
    .find({})
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .toArray()
  return redemptions.map(redemptionView)
}
