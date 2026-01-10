import React from 'react'

interface ToggleProps {
  label: string
  value: boolean
  onChange: (value: boolean) => void
}

const Toggle: React.FC<ToggleProps> = ({ label, value, onChange }) => {
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '16px',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: '#333',
  }

  const toggleContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '48px',
    height: '24px',
    cursor: 'pointer',
  }

  const toggleTrackStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: value ? '#3498db' : '#ccc',
    borderRadius: '12px',
    transition: 'background-color 0.2s ease',
  }

  const toggleThumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: value ? '26px' : '2px',
    width: '20px',
    height: '20px',
    backgroundColor: '#fff',
    borderRadius: '50%',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    transition: 'left 0.2s ease',
  }

  const handleToggle = () => {
    onChange(!value)
  }

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>{label}</span>
      <div style={toggleContainerStyle} onClick={handleToggle}>
        <div style={toggleTrackStyle} />
        <div style={toggleThumbStyle} />
      </div>
    </div>
  )
}

export default Toggle
