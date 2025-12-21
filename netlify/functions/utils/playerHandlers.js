import { get } from './db.js'

export const getPlayers = async () => {
  return get('players', {}, { firstName: 1, lastName: 1, rating: 1, id: 1 })
}
