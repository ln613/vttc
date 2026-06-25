import { createStore } from 'solid-js/store'

export interface AppNotification {
  id: number
  message: string
}

interface NotificationState {
  items: AppNotification[]
}

const getInitialState = (): NotificationState => ({ items: [] })

const [notificationState, setNotificationState] = createStore<NotificationState>(
  getInitialState(),
)

let nextId = 1

export { notificationState }

export const notificationActions = {
  // Show a transient in-app toast. Auto-dismisses after `autoDismissMs`
  // (pass 0 to keep it until clicked).
  push: (message: string, autoDismissMs = 6000) => {
    if (!message) return
    const id = nextId++
    setNotificationState('items', (items) => [...items, { id, message }])
    if (autoDismissMs > 0) {
      setTimeout(() => notificationActions.dismiss(id), autoDismissMs)
    }
  },
  dismiss: (id: number) => {
    setNotificationState('items', (items) => items.filter((n) => n.id !== id))
  },
}
