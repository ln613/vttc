import React from 'react'
import MultiSelectTags from './MultiSelectTags'

interface SingleSelectTagsProps {
  label?: string
  options: string[]
  selectedValue: string | null
  onChange: (selectedValue: string) => void
  className?: string
}

const SingleSelectTags: React.FC<SingleSelectTagsProps> = ({
  label,
  options,
  selectedValue,
  onChange,
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
      className={className}
    />
  )
}

export default SingleSelectTags
