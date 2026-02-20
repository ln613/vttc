import MultiSelectTags from './MultiSelectTags'

interface SingleSelectTagsProps {
  label?: string
  options: string[]
  selectedValue: string | null
  onChange: (selectedValue: string) => void
  vertical?: boolean
  class?: string
}

const SingleSelectTags = (props: SingleSelectTagsProps) => {
  const handleChange = (selectedValues: string[]) => {
    if (selectedValues.length > 0) {
      props.onChange(selectedValues[0])
    }
  }

  return (
    <MultiSelectTags
      label={props.label}
      options={props.options}
      selectedValues={props.selectedValue ? [props.selectedValue] : []}
      onChange={handleChange}
      singleSelect
      vertical={props.vertical}
      class={props.class}
    />
  )
}

export default SingleSelectTags
