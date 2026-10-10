import type { JSX } from 'solid-js'
import Button from './Button'
import { hasSite } from '../site/siteContent'
import '../pages/booking.css'

// A button in the page's look: the club website's pill buttons (booking.css)
// for a club that has a site, the app's usual Button for everyone else.

type Variant = 'primary' | 'secondary' | 'danger' | 'accent'

const PLAIN_COLORS: Record<Variant, string> = {
  primary: '#27ae60',
  secondary: '#888888',
  danger: '#e74c3c',
  accent: '#3498db',
}

const ThemeButton = (props: {
  variant: Variant
  onClick: () => void
  disabled?: boolean
  fill?: boolean
  small?: boolean
  /** The plain look's colour, where it differs from the variant's. */
  plainColor?: string
  children: JSX.Element
}) =>
  hasSite() ? (
    <button
      type="button"
      class={`bk-btn bk-btn-${props.variant}${props.fill ? ' bk-btn-fill' : ''}${props.small ? ' bk-btn-small' : ''}`}
      onClick={() => props.onClick()}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  ) : (
    <Button
      color={props.plainColor ?? PLAIN_COLORS[props.variant]}
      onClick={() => props.onClick()}
      disabled={props.disabled}
      fill={props.fill}
      size={props.small ? 'small' : undefined}
    >
      {props.children}
    </Button>
  )

export default ThemeButton
