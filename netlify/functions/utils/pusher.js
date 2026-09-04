import Pusher from 'pusher'
import { recordPusherSent, recordPusherSuppressed } from './metrics.js'

let cachedClient = null

const getClient = () => {
  if (cachedClient) return cachedClient
  const {
    PUSHER_APP_ID,
    PUSHER_SECRET,
    VITE_PUSHER_KEY,
    VITE_PUSHER_CLUSTER,
  } = process.env
  if (!PUSHER_APP_ID || !PUSHER_SECRET || !VITE_PUSHER_KEY || !VITE_PUSHER_CLUSTER) {
    return null
  }
  cachedClient = new Pusher({
    appId: PUSHER_APP_ID,
    key: VITE_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: VITE_PUSHER_CLUSTER,
    useTLS: true,
  })
  return cachedClient
}

// Realtime notifications are best-effort: they must never block or fail
// the request. Pusher's trigger() has no built-in timeout, so a hung
// network call would stall the whole function invocation (and the local
// dev server behind it) indefinitely. Cap each trigger so it always
// settles quickly.
const TRIGGER_TIMEOUT_MS = 3000

const triggerSafely = async (channel, eventName, data) => {
  const client = getClient()
  if (!client) return
  // Attach the catch up front so the trigger's eventual rejection is
  // always handled — even after the timeout wins the race and this
  // function has already returned (avoids an unhandled rejection).
  recordPusherSent(channel)
  const attempt = Promise.resolve(client.trigger(channel, eventName, data)).catch(
    () => {},
  )
  await Promise.race([
    attempt,
    new Promise((resolve) => setTimeout(resolve, TRIGGER_TIMEOUT_MS)),
  ])
}

export const notifyEventUpdate = async (eventId) => {
  if (!eventId) return
  await triggerSafely(`event-${eventId}`, 'updated', {})
}

export const notifyMatchReset = async (eventId, matchId) => {
  if (!eventId || !matchId) return
  await triggerSafely(`event-${eventId}`, 'match-reset', { matchId })
}

// Live-score broadcasts fan out to every connected client on the shared
// `live-score` channel, so bursts (confirming several matches, generating a
// round) are coalesced: the first call in a window goes out immediately and
// any further calls inside it merge into one trailing broadcast.
//
// Serverless caveat: the trailing timer only fires while the instance stays
// warm. That's best-effort by design — the client's 60s live-score heartbeat
// is the backstop, and the leading edge means the first change is never
// delayed.
const LIVE_SCORE_WINDOW_MS = 1500
const ALL_EVENTS = '*'
let liveScoreLastSentAt = 0
let liveScorePendingIds = null
let liveScoreTimer = null

const sendLiveScore = async (eventId) =>
  triggerSafely('live-score', 'updated', { eventId: eventId || null })

const flushLiveScore = async () => {
  const ids = liveScorePendingIds ? [...liveScorePendingIds] : []
  liveScorePendingIds = null
  liveScoreTimer = null
  liveScoreLastSentAt = Date.now()
  // A burst spanning several events can't name one — tell every client to
  // refetch rather than silently skipping the ones we didn't name.
  const only = ids.length === 1 && ids[0] !== ALL_EVENTS ? ids[0] : null
  await sendLiveScore(only)
}

export const notifyLiveScoreUpdate = async (eventId = null) => {
  const id = eventId ? String(eventId) : null
  const now = Date.now()
  if (now - liveScoreLastSentAt >= LIVE_SCORE_WINDOW_MS) {
    liveScoreLastSentAt = now
    await sendLiveScore(id)
    return
  }
  recordPusherSuppressed()
  if (!liveScorePendingIds) liveScorePendingIds = new Set()
  liveScorePendingIds.add(id || ALL_EVENTS)
  if (!liveScoreTimer) {
    const wait = Math.max(0, LIVE_SCORE_WINDOW_MS - (now - liveScoreLastSentAt))
    liveScoreTimer = setTimeout(() => {
      void flushLiveScore()
    }, wait)
  }
}

// Notify a single player (by their player/account id) that a table has
// been assigned to one of their matches. Delivered on a per-user channel
// the logged-in client subscribes to.
export const notifyTableAssigned = async (playerId, data) => {
  if (!playerId) return
  await triggerSafely(`user-${playerId}`, 'table-assigned', data || {})
}
