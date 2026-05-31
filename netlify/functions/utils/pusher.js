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

export const notifyEventUpdate = async (eventId) => {
  if (!eventId) return
  const client = getClient()
  if (!client) return
  try {
    await client.trigger(`event-${eventId}`, 'updated', {})
  } catch {
    // Realtime is best-effort; never fail the request because of it.
  }
}

export const notifyLiveScoreUpdate = async () => {
  const client = getClient()
  if (!client) return
  try {
    await client.trigger('live-score', 'updated', {})
  } catch {
    // Realtime is best-effort; never fail the request because of it.
  }
}
