import { get } from './db.js'

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
      password: 1,
      _id: 1,
    },
  )
  return players.map(({ password, ...rest }) => ({
    ...rest,
    hasAccount: !!password,
  }))
}
