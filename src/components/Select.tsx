import React from 'react'

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
  className?: string
}

const Select: React.FC<SelectProps> = ({
  label,
  name,
  value,
  onChange,
  options,
  placeholder = '-- Select --',
  required = false,
  disabled = false,
  className = '',
}) => {
  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 700,
    fontSize: '14px',
    marginBottom: '8px',
    color: '#333',
    textAlign: 'left',
  }

  const requiredStyle: React.CSSProperties = {
    color: '#e74c3c',
    marginLeft: '4px',
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 40px 12px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box',
    backgroundColor: disabled ? '#f5f5f5' : '#fff',
    color: value ? '#333' : '#999',
    cursor: disabled ? 'not-allowed' : 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 16px center',
  }

  const containerStyle: React.CSSProperties = {
    marginBottom: '16px',
  }

  const handleFocus = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#3498db'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)'
  }

  const handleBlur = (e: React.FocusEvent<HTMLSelectElement>) => {
    e.currentTarget.style.borderColor = '#ddd'
    e.currentTarget.style.boxShadow = 'none'
  }

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  return (
    <div style={containerStyle} className={className}>
      <label htmlFor={name} style={labelStyle}>
        {label}
        {required && <span style={requiredStyle}>*</span>}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        style={selectStyle}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default Select
