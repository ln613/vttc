import { createEffect, onCleanup } from 'solid-js'
import { authState } from '../stores/authStore'
import { notificationActions } from '../stores/notificationStore'
import { initNativePush, teardownNativePush, isNativeApp } from '../utils/push'
import {
  subscribeToUserNotifications,
  type EventSubscription,
  type TableAssignedNotification,
} from '../utils/pusher'

// Ask once for OS notification permission (best-effort; browsers may
// require a user gesture, in which case this no-ops and the in-app toast
// is still shown).
const requestNotificationPermission = () => {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'default') {
    void Notification.requestPermission().catch(() => {})
  }
}

// Show an OS notification when permission has been granted. Best-effort.
const showOsNotification = (message: string) => {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted') return
  try {
    new Notification('VTTC Live', { body: message })
  } catch {
    // ignore — the in-app toast already covers delivery
  }
}

const handleTableAssigned = (data: TableAssignedNotification) => {
  const message = `Your match has been assigned to table ${data.tableNumber}`
  // In-app toast is the guaranteed delivery (no permission needed); the OS
  // notification is an enhancement for when the tab is in the background.
  notificationActions.push(message)
  showOsNotification(message)
}

// Global, headless component: subscribes the logged-in player to their
// personal Pusher channel so they receive a notification whenever a table
// is assigned to one of their matches. Re-subscribes on login, tears down
// on logout.
const UserNotifications = () => {
  createEffect(() => {
    const playerId = authState.user?._id
    if (!playerId) return
    // Native app: FCM/APNs delivers OS push (background) and in-app toasts
    // (foreground) on its own — no Pusher user-channel needed.
    if (isNativeApp()) {
      initNativePush(playerId)
      // On logout / player switch, drop this device's token.
      onCleanup(() => teardownNativePush())
      return
    }
    // Browser: deliver via Pusher (realtime toast) + Web Notification.
    requestNotificationPermission()
    const subscription: EventSubscription = subscribeToUserNotifications(
      playerId,
      handleTableAssigned,
    )
    onCleanup(() => subscription.unsubscribe())
  })
  return null
}

export default UserNotifications
