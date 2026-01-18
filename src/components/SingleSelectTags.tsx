import React from 'react'
import MultiSelectTags from './MultiSelectTags'

interface SingleSelectTagsProps {
  label?: string
  options: string[]
  selectedValue: string | null
  onChange: (selectedValue: string) => void
  vertical?: boolean
  className?: string
}

const SingleSelectTags: React.FC<SingleSelectTagsProps> = ({
  label,
  options,
  selectedValue,
  onChange,
  vertical = false,
  className = '',
}) => {
  const handleChange = (selectedValues: string[]) => {
    if (selectedValues.length > 0) {
      onChange(selectedValues[0])
    }
  }

  return (
    <MultiSelectTags
      label={label}
      options={options}
      selectedValues={selectedValue ? [selectedValue] : []}
      onChange={handleChange}
      singleSelect
      vertical={vertical}
      className={className}
    />
  )
}

export default SingleSelectTags
