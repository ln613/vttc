import type { JSX } from 'solid-js'

interface ButtonProps {
  children: JSX.Element
  color?: string
  onClick?: (e?: MouseEvent) => void
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  class?: string
  size?: 'small' | 'medium'
}

const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { h: 0, s: 0, l: 0 }

  const r = parseInt(result[1], 16) / 255
  const g = parseInt(result[2], 16) / 255
  const b = parseInt(result[3], 16) / 255

  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 }
}

const getDarkerColor = (hex: string): string => {
  const { h, s, l } = hexToHsl(hex)
  const darkerL = Math.max(l - 15, 0)
  const darkerH = h - 10 < 0 ? h : h - 10
  return `hsl(${darkerH}, ${s}%, ${darkerL}%)`
}

const getSizeStyles = (size: 'small' | 'medium'): JSX.CSSProperties => {
  if (size === 'small') {
    return {
      'font-size': '12px',
      padding: '4px 16px',
      'border-radius': '4px',
      'letter-spacing': '0.5px',
    }
  }
  return {
    'font-size': '16px',
    padding: '8px 40px',
    'border-radius': '8px',
    'letter-spacing': '1px',
  }
}

const Button = (props: ButtonProps) => {
  const color = () => props.color ?? '#e67e22'
  const disabled = () => props.disabled ?? false
  const size = () => props.size ?? 'medium'

  const darkerColor = () => getDarkerColor(color())
  const sizeStyles = () => getSizeStyles(size())

  const buttonStyle = (): JSX.CSSProperties => ({
    background: `linear-gradient(to right, ${color()}, ${darkerColor()})`,
    color: '#ffffff',
    'font-weight': 700,
    border: 'none',
    cursor: disabled() ? 'not-allowed' : 'pointer',
    'box-shadow': '0 4px 6px rgba(0, 0, 0, 0.15)',
    transition: 'all 0.2s ease',
    opacity: disabled() ? 0.6 : 1,
    // touch-action: manipulation suppresses iOS's 300ms double-tap zoom
    // and stops the OS from re-classifying small taps as scroll gestures.
    'touch-action': 'manipulation',
    ...sizeStyles(),
  })

  // No JS mouseenter/mouseleave: those fire as synthesized events between
  // touchend and click on iOS, physically shifting the button under the
  // finger and making the synthesized click miss. The :hover effect lives
  // in App.css inside @media (hover: hover) so only real pointer devices
  // see it.
  return (
    <button
      type={props.type ?? 'button'}
      style={buttonStyle()}
      onClick={props.onClick}
      disabled={disabled()}
      class={`vttc-btn ${props.class ?? ''}`}
    >
      {props.children}
    </button>
  )
}

export default Button
