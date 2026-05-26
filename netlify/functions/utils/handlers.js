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
  getEventSeries,
  addParticipant,
  deleteParticipant,
  editParticipant,
  paymentReceived,
  generateGroups,
  generateKnockout,
  finishMatch,
  confirmMatch,
  updateGame,
  saveMatchSetup,
  resetMatch,
  resetEvent,
} from './eventHandlers.js'
import { signIn, updateProfile, changePassword } from './accountHandlers.js'
import { getLiveScore, rebuildMatchQueue } from './liveScoreHandlers.js'

export const apiHandlers = {
  get: {
    players: () => getPlayers(),
    tournaments: () => getTournaments(),
    tournament: (params) => getTournament(params),
    events: (params) => getEvents(params),
    event: (params) => getEvent(params),
    eventSeries: () => getEventSeries(),
    liveScore: () => getLiveScore(),
  },
  post: {
    saveTournament: (body) => saveTournament(body),
    saveEvent: (body) => saveEvent(body),
    addParticipant: (body) => addParticipant(body),
    deleteParticipant: (body) => deleteParticipant(body),
    editParticipant: (body) => editParticipant(body),
    paymentReceived: (body) => paymentReceived(body),
    generateGroups: (body) => generateGroups(body),
    generateKnockout: (body) => generateKnockout(body),
    finishMatch: (body) => finishMatch(body),
    confirmMatch: (body) => confirmMatch(body),
    updateGame: (body) => updateGame(body),
    saveMatchSetup: (body) => saveMatchSetup(body),
    resetMatch: (body) => resetMatch(body),
    resetEvent: (body) => resetEvent(body),
    signIn: (body) => signIn(body),
    updateProfile: (body) => updateProfile(body),
    changePassword: (body) => changePassword(body),
    rebuildMatchQueue: () => rebuildMatchQueue(),
  },
}
