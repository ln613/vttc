// The club's liability waiver — see specs/rules/waiver.md.
//
// A club that requires one asks every member to accept its current version
// before they use their account. The acceptance (version and when) is kept
// on the player, with every earlier one in waiverHistory, so the club can
// show who agreed to what and when.

import { getDB, toObjectId } from './db.js'
import { club } from './club.js'
import { hasAcceptedWaiver, requiredWaiver } from '../../../shared/rules/waiver.js'

const PLAYERS = 'players'

const throwError = (message) => {
  throw new Error(message)
}

const findPlayer = (playerId) =>
  getDB()
    .collection(PLAYERS)
    .findOne({ _id: toObjectId(playerId) }, { projection: { waiver: 1 } })

/**
 * Whether the signed-in member still has to accept the waiver. The admin
 * and tablet logins have no player behind them, so nothing is asked of them.
 */
export const getMyWaiver = async (_params, auth) => {
  const required = requiredWaiver(club)
  if (!required || !auth?.playerId) return { required: false }
  const player = await findPlayer(auth.playerId)
  if (!player) throwError('Player not found')
  return {
    required: true,
    version: required.version,
    accepted: hasAcceptedWaiver(club, player),
    acceptedAt: player.waiver?.acceptedAt ?? null,
  }
}

const validateAccept = (body, auth, required) => {
  if (!required) throwError('This club has no waiver to accept')
  if (!auth?.playerId) throwError('Sign in with a player account to accept the waiver')
  // Accepting is for the text that was on screen: if the club has since
  // changed it, the member reads the new one first.
  if (body?.version !== required.version) {
    throwError('The waiver has changed. Please read the new version.')
  }
}

/** The signed-in member accepts the current waiver; when is recorded. */
export const acceptWaiver = async (body, auth) => {
  const required = requiredWaiver(club)
  validateAccept(body, auth, required)
  const acceptance = { version: required.version, acceptedAt: new Date() }
  const result = await getDB()
    .collection(PLAYERS)
    .updateOne(
      { _id: toObjectId(auth.playerId) },
      { $set: { waiver: acceptance }, $push: { waiverHistory: acceptance } },
    )
  if (result.matchedCount === 0) throwError('Player not found')
  return { accepted: true, ...acceptance }
}

/**
 * For endpoints a member may only use once they have accepted it. Returns
 * their acceptance, which a booking keeps a copy of (the receipt shows it),
 * or null when the club requires no waiver.
 */
export const requireWaiverAccepted = async (playerId) => {
  if (!requiredWaiver(club) || !playerId) return null
  const player = await findPlayer(playerId)
  if (!hasAcceptedWaiver(club, player)) {
    throwError('Please accept the liability waiver first')
  }
  return player.waiver
}

/**
 * A guest accepts the waiver in the booking dialog, before paying: the
 * booking records that they accepted this version, and when. A signed-in
 * member booking by card has already accepted, so theirs is used.
 */
export const guestWaiverAcceptance = async (body, auth) => {
  const required = requiredWaiver(club)
  if (!required) return null
  if (auth?.playerId) {
    const player = await findPlayer(auth.playerId)
    if (hasAcceptedWaiver(club, player)) return player.waiver
  }
  if (body?.waiverVersion !== required.version) {
    throwError(
      body?.waiverVersion
        ? 'The waiver has changed. Please read the new version.'
        : 'Please accept the liability waiver first',
    )
  }
  return { version: required.version, acceptedAt: new Date() }
}
