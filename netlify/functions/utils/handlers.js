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
  deletePlayerFromTeam,
  editParticipant,
  paymentReceived,
  registerForEvent,
  getPartialTeams,
  getPlayerUnpaidFees,
  changeTeam,
  generateGroups,
  generateKnockout,
  finishMatch,
  confirmMatch,
  updateGame,
  saveMatchSetup,
  resetMatch,
  resetEvent,
} from './eventHandlers.js'
import {
  signIn,
  updateProfile,
  changePassword,
  sendVerificationCode,
  verifyCode,
  signUp,
} from './accountHandlers.js'
import { getLiveScore, rebuildMatchQueue } from './liveScoreHandlers.js'
import { notifyEventUpdate, notifyLiveScoreUpdate } from './pusher.js'

const withEventNotify = (fn) => async (body) => {
  const result = await fn(body)
  const eventId = body?._id || result?._id
  await notifyEventUpdate(eventId)
  await notifyLiveScoreUpdate()
  return result
}

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
    saveEvent: withEventNotify(saveEvent),
    addParticipant: withEventNotify(addParticipant),
    deleteParticipant: withEventNotify(deleteParticipant),
    deletePlayerFromTeam: withEventNotify(deletePlayerFromTeam),
    editParticipant: withEventNotify(editParticipant),
    paymentReceived: withEventNotify(paymentReceived),
    generateGroups: withEventNotify(generateGroups),
    generateKnockout: withEventNotify(generateKnockout),
    finishMatch: withEventNotify(finishMatch),
    confirmMatch: withEventNotify(confirmMatch),
    updateGame: withEventNotify(updateGame),
    saveMatchSetup: withEventNotify(saveMatchSetup),
    resetMatch: withEventNotify(resetMatch),
    resetEvent: withEventNotify(resetEvent),
    registerForEvent: withEventNotify(registerForEvent),
    getPartialTeams: (body) => getPartialTeams(body),
    getPlayerUnpaidFees: (body) => getPlayerUnpaidFees(body),
    changeTeam: withEventNotify(changeTeam),
    signIn: (body) => signIn(body),
    signUp: (body) => signUp(body),
    sendVerificationCode: (body) => sendVerificationCode(body),
    verifyCode: (body) => verifyCode(body),
    updateProfile: (body) => updateProfile(body),
    changePassword: (body) => changePassword(body),
    rebuildMatchQueue: async () => {
      const result = await rebuildMatchQueue()
      await notifyLiveScoreUpdate()
      return result
    },
  },
}
