// Native (Cordova) OS-level push registration via cordova-plugin-firebasex.
// No-ops in a regular browser — web clients get realtime toasts via Pusher
// instead. The FCM token is synced to the server and associated with the
// logged-in player so the server can target the player's devices.
import { apiPost } from './api'
import { notificationActions } from '../stores/notificationStore'

// Minimal shape of the cordova-plugin-firebasex-messaging JS API we use
// (clobbered onto window.FirebasexMessaging).
interface FirebaseMessagingPlugin {
  getToken: (success: (token: string) => void, error: (e: unknown) => void) => void
  onTokenRefresh: (
    success: (token: string) => void,
    error: (e: unknown) => void,
  ) => void
  onMessageReceived: (
    success: (message: Record<string, unknown>) => void,
    error: (e: unknown) => void,
  ) => void
  grantPermission?: (
    success: (granted: boolean) => void,
    error: (e: unknown) => void,
  ) => void
}

interface CordovaGlobal {
  platformId?: string
}

const getCordova = (): CordovaGlobal | undefined =>
  (window as unknown as { cordova?: CordovaGlobal }).cordova

const getFirebasePlugin = (): FirebaseMessagingPlugin | undefined =>
  (window as unknown as { FirebasexMessaging?: FirebaseMessagingPlugin })
    .FirebasexMessaging

export const isNativeApp = (): boolean =>
  typeof window !== 'undefined' && !!getCordova()

const getPlatform = (): string => getCordova()?.platformId || 'unknown'

let registeredPlayerId: string | null = null

const sendTokenToServer = (playerId: string, token: string) => {
  if (!token) return
  void apiPost('registerPushToken', {
    playerId,
    token,
    platform: getPlatform(),
  }).catch(() => {
    // best-effort: a failed sync just means no OS push until next refresh
  })
}

// Show foreground messages as an in-app toast. Background messages and
// taps are handled by the OS, so skip those (msg.tap is set on tap).
const handleMessage = (message: Record<string, unknown>) => {
  if (message?.tap) return
  const body =
    (message?.body as string) ||
    ((message?.aps as { alert?: { body?: string } })?.alert?.body ?? '')
  if (body) notificationActions.push(body)
}

const register = (fb: FirebaseMessagingPlugin, playerId: string) => {
  fb.getToken(
    (token) => sendTokenToServer(playerId, token),
    () => {},
  )
  fb.onTokenRefresh(
    (token) => sendTokenToServer(playerId, token),
    () => {},
  )
  fb.onMessageReceived(handleMessage, () => {})
}

// Initialise native push for a logged-in player. Requests notification
// permission (iOS) and registers the device token. Safe to call repeatedly;
// only acts once per player and only inside the native app.
export const initNativePush = (playerId: string): void => {
  if (!playerId || !isNativeApp()) return
  if (registeredPlayerId === playerId) return

  const start = () => {
    const fb = getFirebasePlugin()
    if (!fb) return
    registeredPlayerId = playerId
    if (typeof fb.grantPermission === 'function') {
      fb.grantPermission((granted) => {
        if (granted) register(fb, playerId)
      }, () => {})
    } else {
      register(fb, playerId)
    }
  }

  // The plugin is only available after Cordova's deviceready.
  if (getFirebasePlugin()) {
    start()
  } else {
    document.addEventListener('deviceready', start, { once: true })
  }
}

// Drop the device token on logout so a shared device stops receiving the
// previous player's notifications.
export const teardownNativePush = (): void => {
  if (!isNativeApp()) return
  registeredPlayerId = null
  const fb = getFirebasePlugin()
  if (!fb) return
  fb.getToken(
    (token) => {
      if (token) void apiPost('unregisterPushToken', { token }).catch(() => {})
    },
    () => {},
  )
}
