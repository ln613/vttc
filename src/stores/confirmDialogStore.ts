import { createStore } from 'solid-js/store'

interface ConfirmDialogState {
  open: boolean
  message: string
  confirmLabel: string
  cancelLabel: string
  confirmColor: string
  mode: 'confirm' | 'alert'
  // When true, clicking the overlay outside the dialog does NOT
  // dismiss it — used for prompts that must get an explicit choice
  // from the umpire (e.g. "Switch sides?").
  modal: boolean
}

const getInitialState = (): ConfirmDialogState => ({
  open: false,
  message: '',
  confirmLabel: 'OK',
  cancelLabel: 'Cancel',
  confirmColor: '#27ae60',
  mode: 'confirm',
  modal: false,
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
  // When true, the overlay won't dismiss the dialog — the umpire
  // must tap one of the explicit buttons.
  modal?: boolean
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
      modal: !!options.modal,
    })
  })
}

// In-page replacement for window.alert.
export const customAlert = (
  message: string,
  options: { modal?: boolean } = {},
): Promise<void> => {
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
      modal: !!options.modal,
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
