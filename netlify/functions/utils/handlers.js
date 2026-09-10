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
  startEvent,
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
  markQueueDirty,
  syncCachedMatch,
} from './liveScoreHandlers.js'
import {
  acquireMatchSession,
  heartbeatMatchSession,
  releaseMatchSession,
} from './matchSessionHandlers.js'
import { getSettings, saveSettings } from './settingsHandlers.js'
import { updateRatings, getPlayerHistory } from './rating.js'
import {
  getRevenue,
  getRevenueTemplates,
  saveRevenueTemplate,
} from './revenueHandlers.js'
import { savePushToken, removePushToken } from './push.js'
import { notifyLiveScoreUpdate } from './pusher.js'

const withEventNotify = (fn) => async (body) => {
  const result = await fn(body)
  const eventId = body?._id || result?._id
  // Any of these can move a match through the queue, so the cached live
  // tables/queue must be rebuilt on the next read. Awaited (unlike the
  // broadcast) because the clients this wakes will read straight after.
  await markQueueDirty()
  // Awaited, not fired and forgotten. These run on Lambda: once the handler
  // returns, the instance is frozen and any promise still in flight is
  // suspended until the same instance happens to serve another request. On
  // a busy site that is soon enough to go unnoticed; on a quiet one the
  // next request is the 60s heartbeat, so the broadcast arrives with it and
  // the app looks like it has no realtime at all.
  //
  // triggerSafely already bounds this at 3s and swallows failures, so the
  // response can be delayed but never blocked.
  // One broadcast on the shared `live-score` channel, carrying the eventId.
  // Event-detail clients filter on it, so we no longer double-fire a second
  // message on `event-{id}` for the same change.
  await notifyLiveScoreUpdate(eventId)
  return result
}

export const apiHandlers = {
  get: {
    players: (params, auth) => getPlayers(params, auth),
    playerRatingHistory: (params) => getPlayerRatingHistory(params),
    playerHistory: (params) => getPlayerHistory(params),
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
    // other table, so a real match deliberately does NOT broadcast — that
    // would mean a Pusher fan-out and every client re-fetching, per point.
    //
    // Simulated events are the exception. They exist to try the app out —
    // create one, then umpire it by hand — and that only demonstrates
    // anything if the other screens keep up: Live Score, Schedule and
    // Event Detail follow the score as it is entered instead of waiting
    // for the 60s heartbeat. The volume is a person tapping, not a
    // tournament, and broadcasts are still coalesced (pusher.js), so a
    // burst of points becomes roughly one message per 1.5s.
    // Spectators' live scores refresh on the next queue-changing event
    // (assign/finish/confirm), which still go through withEventNotify.
    updateGame: async (body) => {
      const { match, ...result } = await updateGame(body)
      // Keep the cached live-score copy of this match in step, or the
      // score on the Live Score page stops moving until something forces
      // a rebuild. Awaited so a client refetching on the broadcast below
      // cannot beat the update.
      if (match) await syncCachedMatch(match)
      // Awaited for the same reason as withEventNotify: a promise left in
      // flight when the Lambda returns is frozen, and on a quiet site it
      // only resumes on the next request — which is the heartbeat.
      if (result?.simulated) await notifyLiveScoreUpdate(body?._id)
      return result
    },
    saveMatchSetup: withEventNotify(saveMatchSetup),
    startTeamMatchSide: withEventNotify(startTeamMatchSide),
    markTeamMatchSideOpened: withEventNotify(markTeamMatchSideOpened),
    saveTeamMatchAssignment: withEventNotify(saveTeamMatchAssignment),
    resetTeamMatch: withEventNotify(resetTeamMatch),
    resetMatch: withEventNotify(resetMatch),
    resetEvent: withEventNotify(resetEvent),
    startEvent: withEventNotify(startEvent),
    deleteEvent: withEventNotify(deleteEvent),
    setParticipantDefault: withEventNotify(setParticipantDefault),
    saveSettings: (body) => saveSettings(body),
    updateRatings: () => updateRatings(),
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
      await notifyLiveScoreUpdate(body?._id)
      return result
    },
    heartbeatMatchSession: (body) => heartbeatMatchSession(body),
    releaseMatchSession: async (body) => {
      const result = await releaseMatchSession(body)
      await notifyLiveScoreUpdate(body?._id)
      return result
    },
  },
}
