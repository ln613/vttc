import React from 'react'

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
  className?: string
}

const Input: React.FC<InputProps> = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  required = false,
  multiline = false,
  rows = 6,
  type = 'text',
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
    boxSizing: 'border-box',
    backgroundColor: disabled ? '#f5f5f5' : '#fff',
    color: '#333',
    cursor: disabled ? 'not-allowed' : 'text',
  }

  const containerStyle: React.CSSProperties = {
    marginBottom: '16px',
  }

  const handleFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = '#3498db'
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52, 152, 219, 0.1)'
  }

  const handleBlur = (
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    e.currentTarget.style.borderColor = '#ddd'
    e.currentTarget.style.boxShadow = 'none'
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    onChange(e.target.value)
  }

  return (
    <div style={containerStyle} className={className}>
      <label htmlFor={name} style={labelStyle}>
        {label}
        {required && <span style={requiredStyle}>*</span>}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          disabled={disabled}
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      )}
    </div>
  )
}

export default Input
