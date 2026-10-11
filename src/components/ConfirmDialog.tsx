import { Show, onMount } from 'solid-js'
import type { JSX } from 'solid-js'
import Button from './Button'
import ThemeButton from './ThemeButton'
import {
  confirmDialogState,
  confirmDialogActions,
} from '../stores/confirmDialogStore'
import { langActions } from '../stores/langStore'
import { hasSite, loadSiteFonts } from '../site/siteContent'
import '../pages/booking.css'

// The app's confirm/alert box (customConfirm). A club with its own website
// gets it in the site's look and language, over whatever page it opens on;
// every other club the plain box.
const ConfirmDialog = () => (
  <Show when={confirmDialogState.open}>
    <Show when={hasSite()} fallback={<PlainConfirm />}>
      <SiteConfirm />
    </Show>
  </Show>
)

// In modal mode the umpire must tap an explicit button — overlay clicks are
// swallowed.
const dismissOnOverlay = (e: MouseEvent) => {
  e.stopPropagation()
  e.preventDefault()
  if (confirmDialogState.modal) return
  confirmDialogActions.cancel()
}

// A red confirm (delete, reset) is the site's danger button; anything else
// its primary one.
const isDanger = () => /^#e74c3c$/i.test(confirmDialogState.confirmColor)

// The store's default labels are English; the site shows its own.
const confirmLabel = () =>
  confirmDialogState.confirmLabel === 'OK'
    ? langActions.t('common.ok')
    : confirmDialogState.confirmLabel

const cancelLabel = () =>
  !confirmDialogState.cancelLabel || confirmDialogState.cancelLabel === 'Cancel'
    ? langActions.t('common.cancel')
    : confirmDialogState.cancelLabel

const SiteConfirm = () => {
  onMount(loadSiteFonts)
  return (
    <div class="bk-site bk-overlay is-confirm" onClick={dismissOnOverlay}>
      <div
        class="bk-dialog bk-dialog-padded"
        role="alertdialog"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="bk-confirm-message">{confirmDialogState.message}</p>
        <div class="bk-actions">
          <Show when={confirmDialogState.mode === 'confirm'}>
            <ThemeButton
              variant="secondary"
              fill
              onClick={() => confirmDialogActions.cancel()}
            >
              {cancelLabel()}
            </ThemeButton>
          </Show>
          <ThemeButton
            variant={isDanger() ? 'danger' : 'primary'}
            fill
            onClick={() => confirmDialogActions.confirm()}
          >
            {confirmLabel()}
          </ThemeButton>
        </div>
      </div>
    </div>
  )
}

const PlainConfirm = () => (
  <>
    <div
      style={overlayStyle}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        // In modal mode the umpire must tap an explicit button —
        // overlay clicks are swallowed.
        if (confirmDialogState.modal) return
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
  </>
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
