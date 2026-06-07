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
      padding: '6px 16px',
      'border-radius': '4px',
      'letter-spacing': '0.5px',
    }
  }
  return {
    'font-size': '16px',
    padding: '12px 40px',
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
    ...sizeStyles(),
  })

  const handleMouseEnter = (e: MouseEvent) => {
    if (!disabled()) {
      const target = e.currentTarget as HTMLButtonElement
      target.style.transform = 'translateY(-2px)'
      target.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.2)'
    }
  }

  const handleMouseLeave = (e: MouseEvent) => {
    const target = e.currentTarget as HTMLButtonElement
    target.style.transform = 'translateY(0)'
    target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.15)'
  }

  return (
    <button
      type={props.type ?? 'button'}
      style={buttonStyle()}
      onClick={props.onClick}
      disabled={disabled()}
      class={props.class ?? ''}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {props.children}
    </button>
  )
}

export default Button
