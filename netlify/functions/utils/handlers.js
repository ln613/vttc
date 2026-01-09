import { getPlayers } from './playerHandlers.js'
import {
  createTournament,
  getTournaments,
  getTournament,
  addParticipant,
  deleteParticipant,
  generateGroups,
  generateKnockout,
  finishMatch,
} from './tournamentHandlers.js'

export const apiHandlers = {
  get: {
    players: () => getPlayers(),
    tournaments: () => getTournaments(),
    tournament: (params) => getTournament(params),
  },
  post: {
    createTournament: (body) => createTournament(body),
    addParticipant: (body) => addParticipant(body),
    deleteParticipant: (body) => deleteParticipant(body),
    generateGroups: (body) => generateGroups(body),
    generateKnockout: (body) => generateKnockout(body),
    finishMatch: (body) => finishMatch(body),
  },
}
