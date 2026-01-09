import React from 'react'

interface MultiSelectTagsProps {
  label?: string
  options: string[]
  selectedValues: string[]
  onChange: (selectedValues: string[]) => void
  singleSelect?: boolean
  className?: string
}

const MultiSelectTags: React.FC<MultiSelectTagsProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  singleSelect = false,
  className = '',
}) => {
  const containerStyle: React.CSSProperties = {
    marginBottom: '16px',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontWeight: 700,
    fontSize: '14px',
    marginBottom: '8px',
    color: '#333',
    textAlign: 'left',
  }

  const tagsContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    maxHeight: '140px',
    overflowY: 'auto',
  }

  const handleTagClick = (option: string) => {
    const isSelected = selectedValues.includes(option)
    if (singleSelect) {
      if (!isSelected) {
        onChange([option])
      }
    } else {
      if (isSelected) {
        onChange(selectedValues.filter((v) => v !== option))
      } else {
        onChange([...selectedValues, option])
      }
    }
  }

  const getTagStyle = (option: string): React.CSSProperties => {
    const isSelected = selectedValues.includes(option)
    return {
      padding: '8px 16px',
      borderRadius: '2px',
      cursor: singleSelect && isSelected ? 'default' : 'pointer',
      backgroundColor: isSelected ? '#3498db' : 'transparent',
      color: isSelected ? '#fff' : '#333',
      border: isSelected ? 'none' : '1px solid #ddd',
      fontSize: '14px',
      transition: 'all 0.2s ease',
      userSelect: 'none',
    }
  }

  return (
    <div style={containerStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={tagsContainerStyle}>
        {options.map((option) => (
          <span
            key={option}
            style={getTagStyle(option)}
            onClick={() => handleTagClick(option)}
          >
            {option}
          </span>
        ))}
      </div>
    </div>
  )
}

export default MultiSelectTags
