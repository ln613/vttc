import { get } from './db.js'

export const getPlayers = async () => {
  return get(
    'players',
    {},
    {
      firstName: 1,
      lastName: 1,
      sex: 1,
      rating: 1,
      email: 1,
      phone: 1,
      _id: 1,
    },
  )
}
