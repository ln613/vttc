import { Show, onMount, type JSX } from 'solid-js'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import '../pages/booking.css'

// A modal dialog with a title. A club with its own website gets its site's
// dialog (booking.css: the heading band, its fonts and colours, which apply
// on whatever page the dialog opens over); every other club the plain white
// box it always had. Clicking outside calls `onClose`, when given.
const DialogFrame = (props: {
  title: string
  onClose?: () => void
  children: JSX.Element
}) => (
  <Show when={hasSiteLook()} fallback={<PlainFrame {...props} />}>
    <SiteFrame {...props} />
  </Show>
)

const close = (onClose?: () => void) => () => onClose?.()

const stop = (e: MouseEvent) => e.stopPropagation()

const SiteFrame = (props: {
  title: string
  onClose?: () => void
  children: JSX.Element
}) => {
  onMount(loadSiteFonts)
  return (
    <div class="bk-site bk-overlay" onClick={close(props.onClose)}>
      <div class="bk-dialog" role="dialog" aria-label={props.title} onClick={stop}>
        <div class="bk-dialog-head">
          <h2 class="bk-dialog-title">{props.title}</h2>
        </div>
        <div class="bk-dialog-body bk-auth">{props.children}</div>
      </div>
    </div>
  )
}

const PlainFrame = (props: {
  title: string
  onClose?: () => void
  children: JSX.Element
}) => (
  <div style={overlayStyle} onClick={close(props.onClose)}>
    <div style={dialogStyle} role="dialog" aria-label={props.title} onClick={stop}>
      <h1 style={titleStyle}>{props.title}</h1>
      {props.children}
    </div>
  </div>
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
  'z-index': '1000',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '32px',
  'min-width': '360px',
  'max-width': '420px',
  'max-height': '85vh',
  'overflow-y': 'auto',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.2)',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '24px',
  'font-weight': 700,
  color: '#333',
  'margin-bottom': '20px',
  'text-align': 'center',
}

export default DialogFrame
