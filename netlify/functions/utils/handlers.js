import { getPlayers } from './playerHandlers.js'

export const apiHandlers = {
  get: {
    players: () => getPlayers(),
  },
  post: {},
}
