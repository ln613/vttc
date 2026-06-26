import { getPlayers, getPlayerRatingHistory } from './playerHandlers.js'
import {
  saveTournament,
  getTournaments,
  getTournament,
} from './tournamentHandlers.js'
import {
  saveEvent,
  simulateEvent,
  cloneEvent,
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
  startTeamMatchSide,
  markTeamMatchSideOpened,
  saveTeamMatchAssignment,
  resetTeamMatch,
  resetMatch,
  resetEvent,
  deleteEvent,
  setParticipantDefault,
} from './eventHandlers.js'
import {
  signIn,
  updateProfile,
  changePassword,
  sendVerificationCode,
  verifyCode,
  signUp,
  registerPlayerByAdmin,
  removePlayerFromEvent,
} from './accountHandlers.js'
import {
  getLiveScore,
  rebuildMatchQueue,
  postponeMatch,
  cancelMatch,
  assignMatchToTable,
} from './liveScoreHandlers.js'
import {
  acquireMatchSession,
  heartbeatMatchSession,
  releaseMatchSession,
} from './matchSessionHandlers.js'
import { getSettings, saveSettings } from './settingsHandlers.js'
import {
  getRevenue,
  getRevenueTemplates,
  saveRevenueTemplate,
} from './revenueHandlers.js'
import { savePushToken, removePushToken } from './push.js'
import { notifyEventUpdate, notifyLiveScoreUpdate } from './pusher.js'

const withEventNotify = (fn) => async (body) => {
  const result = await fn(body)
  const eventId = body?._id || result?._id
  // Realtime notifications are best-effort and must never delay (or hang)
  // the response. Fire them without awaiting — Pusher can be slow or
  // unreachable, and triggerSafely already bounds each call. The response
  // returns as soon as the DB write completes.
  void notifyEventUpdate(eventId)
  void notifyLiveScoreUpdate()
  return result
}

export const apiHandlers = {
  get: {
    players: () => getPlayers(),
    playerRatingHistory: (params) => getPlayerRatingHistory(params),
    tournaments: () => getTournaments(),
    tournament: (params) => getTournament(params),
    events: (params) => getEvents(params),
    event: (params) => getEvent(params),
    eventSeries: () => getEventSeries(),
    liveScore: (params) => getLiveScore(params),
    settings: () => getSettings(),
    revenue: () => getRevenue(),
    revenueTemplates: () => getRevenueTemplates(),
  },
  post: {
    saveTournament: (body) => saveTournament(body),
    saveEvent: withEventNotify(saveEvent),
    simulateEvent: withEventNotify(simulateEvent),
    cloneEvent: withEventNotify(cloneEvent),
    addParticipant: withEventNotify(addParticipant),
    deleteParticipant: withEventNotify(deleteParticipant),
    deletePlayerFromTeam: withEventNotify(deletePlayerFromTeam),
    editParticipant: withEventNotify(editParticipant),
    paymentReceived: withEventNotify(paymentReceived),
    generateGroups: withEventNotify(generateGroups),
    generateKnockout: withEventNotify(generateKnockout),
    finishMatch: withEventNotify(finishMatch),
    confirmMatch: withEventNotify(confirmMatch),
    // updateGame fires on every ~3s score save and is by far the highest
    // frequency write. A point scored doesn't change the queue or any
    // other table, so it deliberately does NOT broadcast — this avoids a
    // realtime fan-out (Pusher + every client re-fetching) per point.
    // Spectators' live scores refresh on the next queue-changing event
    // (assign/finish/confirm), which still go through withEventNotify.
    updateGame: (body) => updateGame(body),
    saveMatchSetup: withEventNotify(saveMatchSetup),
    startTeamMatchSide: withEventNotify(startTeamMatchSide),
    markTeamMatchSideOpened: withEventNotify(markTeamMatchSideOpened),
    saveTeamMatchAssignment: withEventNotify(saveTeamMatchAssignment),
    resetTeamMatch: withEventNotify(resetTeamMatch),
    resetMatch: withEventNotify(resetMatch),
    resetEvent: withEventNotify(resetEvent),
    deleteEvent: withEventNotify(deleteEvent),
    setParticipantDefault: withEventNotify(setParticipantDefault),
    saveSettings: (body) => saveSettings(body),
    registerForEvent: withEventNotify(registerForEvent),
    getPartialTeams: (body) => getPartialTeams(body),
    getPlayerUnpaidFees: (body) => getPlayerUnpaidFees(body),
    changeTeam: withEventNotify(changeTeam),
    registerPushToken: (body) => savePushToken(body),
    unregisterPushToken: (body) => removePushToken(body),
    saveRevenueTemplate: (body) => saveRevenueTemplate(body),
    signIn: (body) => signIn(body),
    signUp: (body) => signUp(body),
    sendVerificationCode: (body) => sendVerificationCode(body),
    verifyCode: (body) => verifyCode(body),
    updateProfile: (body) => updateProfile(body),
    changePassword: (body) => changePassword(body),
    registerPlayerByAdmin: (body) => registerPlayerByAdmin(body),
    removePlayerFromEvent: withEventNotify(removePlayerFromEvent),
    rebuildMatchQueue: async () => {
      const result = await rebuildMatchQueue()
      await notifyLiveScoreUpdate()
      return result
    },
    postponeMatch: withEventNotify(postponeMatch),
    cancelMatch: withEventNotify(cancelMatch),
    assignMatchToTable: withEventNotify(assignMatchToTable),
    acquireMatchSession: async (body) => {
      const result = await acquireMatchSession(body)
      await notifyLiveScoreUpdate()
      return result
    },
    heartbeatMatchSession: (body) => heartbeatMatchSession(body),
    releaseMatchSession: async (body) => {
      const result = await releaseMatchSession(body)
      await notifyLiveScoreUpdate()
      return result
    },
  },
}
