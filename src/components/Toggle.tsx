import { Show, type JSX } from 'solid-js'

interface ToggleProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  noMargin?: boolean
}

const labelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 600,
  color: '#333',
}

const toggleContainerStyle: JSX.CSSProperties = {
  position: 'relative',
  width: '48px',
  height: '24px',
  cursor: 'pointer',
}

const Toggle = (props: ToggleProps) => {
  const containerStyle = (): JSX.CSSProperties => ({
    display: 'flex',
    'align-items': 'center',
    gap: '12px',
    'margin-bottom': props.noMargin ? '0' : '16px',
  })

  const toggleTrackStyle = (): JSX.CSSProperties => ({
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
    'background-color': props.value ? '#3498db' : '#ccc',
    'border-radius': '12px',
    transition: 'background-color 0.2s ease',
  })

  const toggleThumbStyle = (): JSX.CSSProperties => ({
    position: 'absolute',
    top: '2px',
    left: props.value ? '26px' : '2px',
    width: '20px',
    height: '20px',
    'background-color': '#fff',
    'border-radius': '50%',
    'box-shadow': '0 2px 4px rgba(0, 0, 0, 0.2)',
    transition: 'left 0.2s ease',
  })

  const handleToggle = () => {
    props.onChange(!props.value)
  }

  return (
    <div style={containerStyle()}>
      <Show when={props.label}>
        <span style={labelStyle}>{props.label}</span>
      </Show>
      <div style={toggleContainerStyle} onClick={handleToggle}>
        <div style={toggleTrackStyle()} />
        <div style={toggleThumbStyle()} />
      </div>
    </div>
  )
}

export default Toggle
