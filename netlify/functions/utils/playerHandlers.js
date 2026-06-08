import { getDB, toObjectId, get } from './db.js'

export const getPlayers = async () => {
  const players = await get(
    'players',
    {},
    {
      firstName: 1,
      lastName: 1,
      sex: 1,
      rating: 1,
      email: 1,
      phone: 1,
      dateOfBirth: 1,
      password: 1,
      host: 1,
      _id: 1,
    },
  )
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
