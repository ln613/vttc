import { Show, For, createSignal, type JSX } from 'solid-js'

interface InputDropdownProps {
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  required?: boolean
  disabled?: boolean
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
  position: 'relative',
}

const dropdownContainerStyle: JSX.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: '0',
  right: '0',
  'max-height': '200px',
  'overflow-y': 'auto',
  'background-color': '#fff',
  border: '1px solid #ddd',
  'border-top': 'none',
  'border-radius': '0 0 8px 8px',
  'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.1)',
  'z-index': '100',
}

const optionStyle: JSX.CSSProperties = {
  padding: '10px 16px',
  'font-size': '16px',
  cursor: 'pointer',
  color: '#333',
}

const optionHoverStyle: JSX.CSSProperties = {
  ...optionStyle,
  'background-color': '#f0f7ff',
}

const InputDropdown = (props: InputDropdownProps) => {
  const [isOpen, setIsOpen] = createSignal(false)
  const [hoveredIndex, setHoveredIndex] = createSignal(-1)

  const filteredOptions = () =>
    filterOptionsByValue(props.options, props.value)

  const inputStyle = (): JSX.CSSProperties => ({
    width: '100%',
    padding: '12px 16px',
    'font-size': '16px',
    border: '1px solid #ddd',
    'border-radius': isOpen() && filteredOptions().length > 0 ? '8px 8px 0 0' : '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    'box-sizing': 'border-box',
    'background-color': props.disabled ? '#f5f5f5' : '#fff',
    color: '#333',
    cursor: props.disabled ? 'not-allowed' : 'text',
  })

  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    props.onChange(target.value)
    setIsOpen(true)
  }

  const handleFocus = (e: FocusEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.borderColor = '#3498db'
    target.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)'
    setIsOpen(true)
  }

  const handleBlur = (e: FocusEvent) => {
    const target = e.currentTarget as HTMLElement
    target.style.borderColor = '#ddd'
    target.style.boxShadow = 'none'
    // Delay closing so click on option registers
    setTimeout(() => setIsOpen(false), 200)
  }

  const handleSelectOption = (option: string) => {
    props.onChange(option)
    setIsOpen(false)
  }

  return (
    <div style={containerStyle}>
      <Show when={props.label}>
        <label for={props.name} style={labelStyle}>
          {props.label}
          <Show when={props.required}>
            <span style={requiredStyle}>*</span>
          </Show>
        </label>
      </Show>
      <input
        id={props.name}
        name={props.name}
        type="text"
        value={props.value}
        onInput={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={props.placeholder ?? ''}
        disabled={props.disabled}
        style={inputStyle()}
        autocomplete="off"
      />
      <Show when={isOpen() && filteredOptions().length > 0}>
        <div style={dropdownContainerStyle}>
          <For each={filteredOptions()}>
            {(option, index) => (
              <div
                style={hoveredIndex() === index() ? optionHoverStyle : optionStyle}
                onMouseEnter={() => setHoveredIndex(index())}
                onMouseLeave={() => setHoveredIndex(-1)}
                onMouseDown={() => handleSelectOption(option)}
              >
                {option}
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}

const filterOptionsByValue = (options: string[], value: string): string[] => {
  if (!value) return options
  const lower = value.toLowerCase()
  return options.filter((o) => o.toLowerCase().includes(lower))
}

export default InputDropdown
