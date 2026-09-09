import { getDB, toObjectId, get } from './db.js'

// The full list is public — the sign-up and registration flows read it
// before anyone is signed in — so it carries only what those need. Contact
// details go out to admins alone; this endpoint used to hand every member's
// email, phone and date of birth to anyone who asked.
const PUBLIC_PLAYER_PROJECTION = {
  _id: 1,
  firstName: 1,
  lastName: 1,
  sex: 1,
  rating: 1,
  host: 1,
  password: 1, // reduced to hasAccount below, never returned
}

const ADMIN_ONLY_FIELDS = { email: 1, phone: 1, dateOfBirth: 1 }

export const getPlayers = async (_params, auth) => {
  const isAdmin = !!auth?.isAdmin
  const projection = isAdmin
    ? { ...PUBLIC_PLAYER_PROJECTION, ...ADMIN_ONLY_FIELDS }
    : PUBLIC_PLAYER_PROJECTION

  const players = await get('players', {}, projection)
  return players.map(({ password, ...rest }) => ({
    ...rest,
    hasAccount: !!password,
  }))
}

// Returns the player's rating change history (newest first). Used by
// the Account page's rating-history dialog (admin only — caller gates).
export const getPlayerRatingHistory = async (params = {}) => {
  if (!params.playerId) throw new Error('Player ID is required')
  const db = getDB()
  const player = await db
    .collection('players')
    .findOne(
      { _id: toObjectId(params.playerId) },
      { projection: { ratingHistory: 1 } },
    )
  const history = Array.isArray(player?.ratingHistory)
    ? [...player.ratingHistory]
    : []
  history.sort((a, b) => (b.changedAt || '').localeCompare(a.changedAt || ''))
  return history
}
