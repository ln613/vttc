import type { JSX } from 'solid-js'

// The ways to sign up or sign in, as bare icons in a row: no label, no
// circle, no box — the icon is the button. Each has its name as a tooltip
// and for screen readers.

const ICON_SIZE = 40
// The app's own blue, for the icons that are ours (Google's G keeps its own
// colours).
const ICON_BLUE = '#2185d0'

// Google's own "G", in its four colours (Google branding guidelines).
export const GoogleLogo = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
    />
  </svg>
)

export const EmailIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill={ICON_BLUE}
      d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
    />
  </svg>
)

export const PhoneIcon = () => (
  <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill={ICON_BLUE}
      d="M17 1.01 7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"
    />
  </svg>
)

// Named `label` rather than drawn: the icon carries the meaning on screen,
// the label carries it for a tooltip and a screen reader.
export const IconButton = (props: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: JSX.Element
}) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    onClick={() => props.onClick()}
    disabled={props.disabled}
    class="vttc-icon-btn"
    style={iconButtonStyle(!!props.disabled)}
  >
    {props.children}
  </button>
)

// A fixed square hit area around the icon, with nothing drawn: no border,
// no background, no radius — so a flex row can never stretch it into a
// visible shape either.
const iconButtonStyle = (disabled: boolean): JSX.CSSProperties => ({
  width: '52px',
  height: '52px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  border: 'none',
  background: 'transparent',
  cursor: disabled ? 'default' : 'pointer',
  opacity: disabled ? 0.5 : 1,
})

export const iconRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'center',
  'align-items': 'center',
  gap: '36px',
}
