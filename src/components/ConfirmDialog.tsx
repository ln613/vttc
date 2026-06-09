import { Show } from 'solid-js'
import type { JSX } from 'solid-js'
import Button from './Button'
import {
  confirmDialogState,
  confirmDialogActions,
} from '../stores/confirmDialogStore'

const ConfirmDialog = () => (
  <Show when={confirmDialogState.open}>
    <div
      style={overlayStyle}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        confirmDialogActions.cancel()
      }}
    >
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <p style={messageStyle}>{confirmDialogState.message}</p>
        <div style={footerStyle}>
          <Show when={confirmDialogState.mode === 'confirm'}>
            <Button
              color="#999"
              onClick={(e) => {
                e?.stopPropagation()
                e?.preventDefault()
                confirmDialogActions.cancel()
              }}
            >
              {confirmDialogState.cancelLabel || 'Cancel'}
            </Button>
          </Show>
          <Button
            color={confirmDialogState.confirmColor}
            onClick={(e) => {
              e?.stopPropagation()
              e?.preventDefault()
              confirmDialogActions.confirm()
            }}
          >
            {confirmDialogState.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  </Show>
)

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '2000',
  'touch-action': 'manipulation',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '20px 24px',
  'border-radius': '12px',
  // Auto-size to content (with caps) so short prompts render compactly
  // instead of stretching to a fixed wide rectangle.
  'max-width': 'min(420px, 90vw)',
  'min-width': '240px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
  'touch-action': 'manipulation',
}

const messageStyle: JSX.CSSProperties = {
  'font-size': '15px',
  color: '#333',
  'line-height': '1.5',
  'margin-top': '0',
  'margin-bottom': '20px',
  'white-space': 'pre-wrap',
}

const footerStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'flex-end',
  'align-items': 'center',
  gap: '12px',
}

export default ConfirmDialog
