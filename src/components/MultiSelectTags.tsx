import { Show, For, type JSX } from 'solid-js'

interface MultiSelectTagsProps {
  label?: string
  options: string[]
  selectedValues: string[]
  onChange: (selectedValues: string[]) => void
  singleSelect?: boolean
  vertical?: boolean
  class?: string
}

const containerStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
}

const labelStyle: JSX.CSSProperties = {
  display: 'block',
  'font-weight': 700,
  'font-size': '14px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const MultiSelectTags = (props: MultiSelectTagsProps) => {
  const tagsContainerStyle = (): JSX.CSSProperties =>
    props.vertical
      ? {
          display: 'flex',
          'flex-direction': 'column',
          gap: '8px',
        }
      : {
          display: 'flex',
          'flex-wrap': 'wrap',
          gap: '8px',
          'max-height': '140px',
          'overflow-y': 'auto',
        }

  const handleTagClick = (option: string) => {
    const isSelected = props.selectedValues.includes(option)
    if (props.singleSelect) {
      if (!isSelected) {
        props.onChange([option])
      }
    } else {
      if (isSelected) {
        props.onChange(props.selectedValues.filter((v) => v !== option))
      } else {
        props.onChange([...props.selectedValues, option])
      }
    }
  }

  const getTagStyle = (option: string): JSX.CSSProperties => {
    const isSelected = props.selectedValues.includes(option)
    return {
      padding: '8px 16px',
      'border-radius': '4px',
      cursor: props.singleSelect && isSelected ? 'default' : 'pointer',
      'background-color': isSelected ? '#3498db' : 'transparent',
      color: isSelected ? '#fff' : '#333',
      border: isSelected ? 'none' : '1px solid #ddd',
      'font-size': '14px',
      transition: 'all 0.2s ease',
      'user-select': 'none',
      'text-align': 'center',
    }
  }

  return (
    <div style={containerStyle} class={props.class ?? ''}>
      <Show when={props.label}>
        <label style={labelStyle}>{props.label}</label>
      </Show>
      <div style={tagsContainerStyle()}>
        <For each={props.options}>
          {(option) => (
            <span style={getTagStyle(option)} onClick={() => handleTagClick(option)}>
              {option}
            </span>
          )}
        </For>
      </div>
    </div>
  )
}

export default MultiSelectTags
