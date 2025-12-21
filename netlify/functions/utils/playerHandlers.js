import { get } from './db.js'

export const getPlayers = async () => {
  return get('players', {}, { fullName: 1, rating: 1, id: 1 })
}
