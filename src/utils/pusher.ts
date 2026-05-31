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

export const subscribeToEventUpdates = (
  eventId: string,
  onUpdate: () => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channelName = `event-${eventId}`
  const channel = client.subscribe(channelName)
  channel.bind('updated', onUpdate)
  return {
    unsubscribe: () => {
      channel.unbind('updated', onUpdate)
      client.unsubscribe(channelName)
    },
  }
}

export const subscribeToLiveScoreUpdates = (
  onUpdate: () => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channelName = 'live-score'
  const channel = client.subscribe(channelName)
  channel.bind('updated', onUpdate)
  return {
    unsubscribe: () => {
      channel.unbind('updated', onUpdate)
      client.unsubscribe(channelName)
    },
  }
}
