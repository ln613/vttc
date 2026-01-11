import { getPlayers } from './playerHandlers.js'
import {
  saveTournament,
  getTournaments,
  getTournament,
} from './tournamentHandlers.js'
import {
  saveEvent,
  getEvents,
  getEvent,
  addParticipant,
  deleteParticipant,
  generateGroups,
  generateKnockout,
  finishMatch,
} from './eventHandlers.js'

export const apiHandlers = {
  get: {
    players: () => getPlayers(),
    tournaments: () => getTournaments(),
    tournament: (params) => getTournament(params),
    events: (params) => getEvents(params),
    event: (params) => getEvent(params),
  },
  post: {
    saveTournament: (body) => saveTournament(body),
    saveEvent: (body) => saveEvent(body),
    addParticipant: (body) => addParticipant(body),
    deleteParticipant: (body) => deleteParticipant(body),
    generateGroups: (body) => generateGroups(body),
    generateKnockout: (body) => generateKnockout(body),
    finishMatch: (body) => finishMatch(body),
  },
}
