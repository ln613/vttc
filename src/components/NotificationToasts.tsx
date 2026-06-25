import { For, type JSX } from 'solid-js'
import { notificationState, notificationActions } from '../stores/notificationStore'

// Global, fixed-position stack of in-app toasts. Subscribes directly to
// the notification store; click a toast to dismiss it early.
const NotificationToasts = () => (
  <div style={containerStyle}>
    <For each={notificationState.items}>
      {(n) => (
        <div style={toastStyle} onClick={() => notificationActions.dismiss(n.id)}>
          {n.message}
        </div>
      )}
    </For>
  </div>
)

const containerStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'z-index': 2000,
  'align-items': 'center',
  'pointer-events': 'none',
}

const toastStyle: JSX.CSSProperties = {
  'pointer-events': 'auto',
  cursor: 'pointer',
  padding: '14px 22px',
  'border-radius': '10px',
  'background-color': '#2c3e50',
  color: 'white',
  'font-weight': '600',
  'font-size': '16px',
  'box-shadow': '0 6px 20px rgba(0, 0, 0, 0.35)',
  'max-width': '90vw',
  'text-align': 'center',
}

export default NotificationToasts
