import Pusher from 'pusher'

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
  try {
    await Promise.race([
      client.trigger(channel, eventName, data),
      new Promise((resolve) => setTimeout(resolve, TRIGGER_TIMEOUT_MS)),
    ])
  } catch {
    // Swallow — realtime delivery is not critical to the request.
  }
}

export const notifyEventUpdate = async (eventId) => {
  if (!eventId) return
  await triggerSafely(`event-${eventId}`, 'updated', {})
}

export const notifyMatchReset = async (eventId, matchId) => {
  if (!eventId || !matchId) return
  await triggerSafely(`event-${eventId}`, 'match-reset', { matchId })
}

export const notifyLiveScoreUpdate = async () => {
  await triggerSafely('live-score', 'updated', {})
}
