import { Show, For, type JSX } from 'solid-js'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
  class?: string
  noMargin?: boolean
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

const Select = (props: SelectProps) => {
  const selectStyle = (): JSX.CSSProperties => ({
    width: '100%',
    padding: '12px 40px 12px 16px',
    'font-size': '16px',
    border: '1px solid #ddd',
    'border-radius': '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    'box-sizing': 'border-box',
    'background-color': props.disabled ? '#f5f5f5' : '#fff',
    color: props.value ? '#333' : '#999',
    cursor: props.disabled ? 'not-allowed' : 'pointer',
    appearance: 'none',
    '-webkit-appearance': 'none',
    'background-image': `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    'background-repeat': 'no-repeat',
    'background-position': 'right 16px center',
  })

  const containerStyle = (): JSX.CSSProperties => ({
    'margin-bottom': props.noMargin ? '0' : '16px',
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
    const target = e.target as HTMLSelectElement
    props.onChange(target.value)
  }

  return (
    <div style={containerStyle()} class={props.class ?? ''}>
      <Show when={props.label}>
        <label for={props.name} style={labelStyle}>
          {props.label}
          <Show when={props.required}>
            <span style={requiredStyle}>*</span>
          </Show>
        </label>
      </Show>
      <select
        id={props.name}
        name={props.name}
        value={props.value}
        onChange={handleChange}
        disabled={props.disabled}
        style={selectStyle()}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="" disabled>
          {props.placeholder ?? '-- Select --'}
        </option>
        <For each={props.options}>
          {(option) => (
            <option value={option.value} selected={option.value === props.value}>
              {option.label}
            </option>
          )}
        </For>
      </select>
    </div>
  )
}

export default Select
