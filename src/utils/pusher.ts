import Pusher from 'pusher-js'
import type { Channel, PresenceChannel } from 'pusher-js'
import { apiPost } from './api'

let cachedClient: Pusher | null = null

// One id per page load, so the two tablets on a table are distinct members
// of its presence channel even when they are signed in as the same person.
const DEVICE_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// The table channel is a presence channel and has to be signed. Our API
// takes a `type` and a JSON body rather than Pusher's form post, so the
// signature is fetched through the normal client instead of Pusher's
// built-in transport.
const channelAuthorization = {
  customHandler: (
    params: { socketId: string; channelName: string },
    callback: (error: Error | null, auth: unknown) => void,
  ) => {
    apiPost('pusherAuth', {
      socketId: params.socketId,
      channelName: params.channelName,
      deviceId: DEVICE_ID,
    })
      .then((auth) => callback(null, auth))
      .catch((error) => callback(error as Error, null))
  },
} as const

const getClient = (): Pusher | null => {
  if (cachedClient) return cachedClient
  const key = import.meta.env.VITE_PUSHER_KEY as string | undefined
  const cluster = import.meta.env.VITE_PUSHER_CLUSTER as string | undefined
  if (!key || !cluster) return null
  cachedClient = new Pusher(key, {
    cluster,
    channelAuthorization: channelAuthorization as never,
  })
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

// A live-score broadcast names the event that changed, or `null` when a
// coalesced burst spanned several events (meaning: everyone should refetch).
export interface LiveScoreUpdate {
  eventId?: string | null
}

export const subscribeToLiveScoreUpdates = (
  onUpdate: (data?: LiveScoreUpdate) => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channel = client.subscribe('live-score')
  const handler = (data: LiveScoreUpdate) => onUpdate(data)
  channel.bind('updated', handler)
  return {
    unsubscribe: () => channel.unbind('updated', handler),
  }
}

export interface TableAssignedNotification {
  tableNumber: number
  eventId: string
  matchId: string
}

// Subscribe a logged-in player to their personal channel to receive
// table-assignment push notifications for their own matches.
export const subscribeToUserNotifications = (
  playerId: string,
  onTableAssigned: (data: TableAssignedNotification) => void,
): EventSubscription => {
  const client = getClient()
  if (!client) {
    return { unsubscribe: () => {} }
  }
  const channel = client.subscribe(`user-${playerId}`)
  channel.bind('table-assigned', onTableAssigned)
  return {
    unsubscribe: () => channel.unbind('table-assigned', onTableAssigned),
  }
}

// ==================== Paired tablets ====================

// The Scorer and the Mirror on one table talk directly to each other with
// Pusher *client events*: device -> Pusher -> device, never touching our
// API. A point scored therefore costs no function invocation, no database
// write and no broadcast to anyone else. See specs/rules/tablet mirror.md.
//
// Client events must be enabled on the Pusher app (dashboard only, no API).
// Without that they are silently dropped, and the Mirror simply never
// updates.
const STATE_EVENT = 'client-state'
const HELLO_EVENT = 'client-hello'

/** Everything the Mirror needs to draw the Scorer's screen. */
export interface TabletMirrorState {
  matchId: string
  currentGameIndex: number
  score1: number
  score2: number
  gamesWon1: number
  gamesWon2: number
  servingSide: 1 | 2
  leftSide: 1 | 2
  timeout1: boolean
  timeout2: boolean
  lastScoredSide: 1 | 2 | null
  matchSubmitted: boolean
  /** Whether the umpire has pressed Start — before that the ends are not
   *  settled, and the Mirror shows no names. */
  setupConfirmed: boolean
}

export interface TablePairing {
  /** Whether the other tablet is currently on the channel. */
  hasSister: () => boolean
  /** Scorer -> Mirror. A no-op when nobody is listening. */
  publishState: (state: TabletMirrorState) => void
  /** Mirror -> Scorer, on join, asking for a first snapshot. */
  publishHello: () => void
  unsubscribe: () => void
}

const NO_PAIRING: TablePairing = {
  hasSister: () => false,
  publishState: () => {},
  publishHello: () => {},
  unsubscribe: () => {},
}

export const joinTableChannel = (
  tableNumber: number,
  handlers: {
    onState?: (state: TabletMirrorState) => void
    onHello?: () => void
    onSisterChange?: (present: boolean) => void
  },
): TablePairing => {
  const client = getClient()
  if (!client) return NO_PAIRING

  const name = `presence-table-${tableNumber}`
  const channel = client.subscribe(name) as PresenceChannel

  const sisterCount = () => Math.max(0, (channel.members?.count ?? 1) - 1)
  const announce = () => handlers.onSisterChange?.(sisterCount() > 0)

  const onState = (data: TabletMirrorState) => handlers.onState?.(data)
  const onHello = () => handlers.onHello?.()
  channel.bind(STATE_EVENT, onState)
  channel.bind(HELLO_EVENT, onHello)
  channel.bind('pusher:subscription_succeeded', announce)
  channel.bind('pusher:member_added', announce)
  channel.bind('pusher:member_removed', announce)

  const trigger = (event: string, data: unknown) => {
    // Client events are refused on a channel that has not finished
    // subscribing, and they are pointless with nobody to hear them.
    if (sisterCount() === 0) return
    try {
      ;(channel as Channel).trigger(event, data)
    } catch {
      // Rate limit, or client events not enabled on the Pusher app. The
      // next snapshot carries the whole state, so a dropped one costs
      // nothing but a moment of staleness.
    }
  }

  return {
    hasSister: () => sisterCount() > 0,
    publishState: (state) => trigger(STATE_EVENT, state),
    publishHello: () => trigger(HELLO_EVENT, {}),
    unsubscribe: () => {
      channel.unbind(STATE_EVENT, onState)
      channel.unbind(HELLO_EVENT, onHello)
      channel.unbind('pusher:subscription_succeeded', announce)
      channel.unbind('pusher:member_added', announce)
      channel.unbind('pusher:member_removed', announce)
      client.unsubscribe(name)
    },
  }
}
