import { Show, type JSX } from 'solid-js'

interface InputProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  multiline?: boolean
  rows?: number
  type?: 'text' | 'email' | 'tel' | 'password' | 'number'
  disabled?: boolean
  class?: string
  endAdornment?: JSX.Element
}

const labelStyle: JSX.CSSProperties = {
  display: 'block',
  'font-weight': 700,
  'font-size': '14px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const requiredStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'margin-left': '4px',
}

const containerStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
}

const inputWrapperStyle: JSX.CSSProperties = {
  position: 'relative',
}

const endAdornmentStyle: JSX.CSSProperties = {
  position: 'absolute',
  right: '12px',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
  'align-items': 'center',
  'pointer-events': 'none',
}

const Input = (props: InputProps) => {
  const inputStyle = (): JSX.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    'font-size': '16px',
    border: '1px solid #ddd',
    'border-radius': '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    'box-sizing': 'border-box',
    'background-color': props.disabled ? '#f5f5f5' : '#fff',
    color: '#333',
    cursor: props.disabled ? 'not-allowed' : 'text',
  })

  const handleFocus = (e: FocusEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.borderColor = '#3498db'
    target.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)'
  }

  const handleBlur = (e: FocusEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.borderColor = '#ddd'
    target.style.boxShadow = 'none'
  }

  const handleChange = (e: Event) => {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement
    props.onChange(target.value)
  }

  return (
    <div style={containerStyle} class={props.class ?? ''}>
      <label for={props.name} style={labelStyle}>
        {props.label}
        <Show when={props.required}>
          <span style={requiredStyle}>*</span>
        </Show>
      </label>
      <Show
        when={props.multiline}
        fallback={
          <div style={inputWrapperStyle}>
            <input
              id={props.name}
              name={props.name}
              type={props.type ?? 'text'}
              value={props.value}
              onInput={handleChange}
              placeholder={props.placeholder ?? ''}
              disabled={props.disabled}
              style={inputStyle()}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <Show when={props.endAdornment}>
              <div style={endAdornmentStyle}>{props.endAdornment}</div>
            </Show>
          </div>
        }
      >
        <textarea
          id={props.name}
          name={props.name}
          value={props.value}
          onInput={handleChange}
          placeholder={props.placeholder ?? ''}
          disabled={props.disabled}
          rows={props.rows ?? 6}
          style={{ ...inputStyle(), resize: 'vertical', 'min-height': '120px' }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </Show>
    </div>
  )
}

export default Input
