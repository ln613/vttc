import { createStore } from 'solid-js/store'

interface ConfirmDialogState {
  open: boolean
  message: string
  confirmLabel: string
  cancelLabel: string
  confirmColor: string
  mode: 'confirm' | 'alert'
}

const getInitialState = (): ConfirmDialogState => ({
  open: false,
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  confirmColor: '#27ae60',
  mode: 'confirm',
})

const [confirmDialogState, setConfirmDialogState] = createStore<ConfirmDialogState>(
  getInitialState(),
)

export { confirmDialogState }

let resolver: ((value: boolean) => void) | null = null

interface ConfirmOptions {
  confirmLabel?: string
  cancelLabel?: string
  confirmColor?: string
}

// In-page replacement for window.confirm — returns a Promise that
// resolves to true on confirm, false on cancel/dismiss. Safe to call
// from any context (async store actions, click handlers, etc.).
export const customConfirm = (
  message: string,
  options: ConfirmOptions = {},
): Promise<boolean> => {
  if (resolver) resolver(false)
  return new Promise((resolve) => {
    resolver = resolve
    setConfirmDialogState({
      open: true,
      message,
      mode: 'confirm',
      confirmLabel: options.confirmLabel || 'OK',
      cancelLabel: options.cancelLabel || 'Cancel',
      confirmColor: options.confirmColor || '#27ae60',
    })
  })
}

// In-page replacement for window.alert.
export const customAlert = (message: string): Promise<void> => {
  if (resolver) resolver(false)
  return new Promise((resolve) => {
    resolver = () => resolve()
    setConfirmDialogState({
      open: true,
      message,
      mode: 'alert',
      confirmLabel: 'OK',
      cancelLabel: '',
      confirmColor: '#27ae60',
    })
  })
}

export const confirmDialogActions = {
  confirm: () => {
    const r = resolver
    resolver = null
    setConfirmDialogState({ open: false })
    r?.(true)
  },
  cancel: () => {
    const r = resolver
    resolver = null
    setConfirmDialogState({ open: false })
    r?.(false)
  },
}
