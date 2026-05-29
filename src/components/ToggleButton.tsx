import { type JSX } from 'solid-js'

interface ToggleButtonProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

const ToggleButton = (props: ToggleButtonProps) => {
  const buttonStyle = (): JSX.CSSProperties => ({
    padding: '6px 10px',
    'font-size': '12px',
    'font-weight': 600,
    'white-space': 'nowrap',
    'border-radius': '8px',
    border: props.value ? '1px solid #27ae60' : '1px solid #ddd',
    'background-color': props.value ? '#27ae60' : '#fff',
    color: props.value ? '#fff' : '#000',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease',
  })

  return (
    <button style={buttonStyle()} onClick={() => props.onChange(!props.value)}>
      {props.label}
    </button>
  )
}

export default ToggleButton
