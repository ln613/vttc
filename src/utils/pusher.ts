import Pusher from 'pusher-js'

let cachedClient: Pusher | null = null

const getClient = (): Pusher | null => {
  if (cachedClient) return cachedClient
  const key = import.meta.env.VITE_PUSHER_KEY as string | undefined
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined
  if (!key || !cluster) return null
  cachedClient = new Pusher(key, { cluster })
  return cachedClient
}

export interface EventSubscription {
  unsubscribe: () => void
}

// Pusher channels are shared resources — multiple parts of the app
// can subscribe to the same channel for different events. Calling
// client.unsubscribe(name) kills the channel for EVERYONE bound to
// it. We only unbind our own handler on teardown so other listeners
// stay alive; the channel itself stays subscribed for the lifetime
// of the Pusher client (cheap, since channels are pooled by name).
export const subscribeToEventUpdates = (
  eventId: string,
  onUpdate: () => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channel = client.subscribe(`event-${eventId}`)
  channel.bind('updated', onUpdate)
  return {
    unsubscribe: () => channel.unbind('updated', onUpdate),
  }
}

export const subscribeToMatchReset = (
  eventId: string,
  onReset: (matchId: string) => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channel = client.subscribe(`event-${eventId}`)
  const handler = (data: { matchId: string }) => onReset(data.matchId)
  channel.bind('match-reset', handler)
  return {
    unsubscribe: () => channel.unbind('match-reset', handler),
  }
}

export const subscribeToLiveScoreUpdates = (
  onUpdate: () => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channel = client.subscribe('live-score')
  channel.bind('updated', onUpdate)
  return {
    unsubscribe: () => channel.unbind('updated', onUpdate),
  }
}
