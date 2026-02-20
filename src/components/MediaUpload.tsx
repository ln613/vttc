import { createSignal, Show, type JSX } from 'solid-js'

interface MediaUploadProps {
  label?: string
  value: File | string | null
  onChange: (file: File | null) => void
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

const previewBoxStyle: JSX.CSSProperties = {
  width: '300px',
  height: '300px',
  border: '2px dashed #ddd',
  'border-radius': '4px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  cursor: 'pointer',
  position: 'relative',
  overflow: 'hidden',
  'background-color': '#fafafa',
}

const plusSignStyle: JSX.CSSProperties = {
  'font-size': '64px',
  color: '#ccc',
  'font-weight': 300,
  'user-select': 'none',
}

const imageStyle: JSX.CSSProperties = {
  width: '100%',
  height: '100%',
  'object-fit': 'contain',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '100vw',
  height: '100vh',
  'background-color': 'rgba(0, 0, 0, 0.8)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
}

const overlayImageStyle: JSX.CSSProperties = {
  'max-width': '90vw',
  'max-height': '90vh',
  'object-fit': 'contain',
}

const MediaUpload = (props: MediaUploadProps) => {
  const [isHovered, setIsHovered] = createSignal(false)
  const [showPreviewOverlay, setShowPreviewOverlay] = createSignal(false)

  let fileInputRef: HTMLInputElement | undefined

  const removeButtonStyle = (): JSX.CSSProperties => ({
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    padding: '0',
    'border-radius': '50%',
    'background-color': 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: isHovered() ? 'flex' : 'none',
    'align-items': 'center',
    'justify-content': 'center',
    'font-size': '16px',
    'font-weight': 'bold',
    'line-height': '1',
    transition: 'opacity 0.2s ease',
  })

  const getMediaUrl = (): string | null => {
    if (!props.value) return null
    if (typeof props.value === 'string') return props.value
    return URL.createObjectURL(props.value)
  }

  const handlePreviewBoxClick = () => {
    if (!props.value) {
      fileInputRef?.click()
    } else {
      setShowPreviewOverlay(true)
    }
  }

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    const file = target.files?.[0] || null
    props.onChange(file)
    if (fileInputRef) {
      fileInputRef.value = ''
    }
  }

  const handleRemoveClick = (e: MouseEvent) => {
    e.stopPropagation()
    props.onChange(null)
  }

  const handleOverlayClick = () => {
    setShowPreviewOverlay(false)
  }

  const handleOverlayKeyDown = () => {
    setShowPreviewOverlay(false)
  }

  return (
    <div style={containerStyle} class={props.class ?? ''}>
      <Show when={props.label}>
        <label style={labelStyle}>{props.label}</label>
      </Show>
      <div
        style={previewBoxStyle}
        onClick={handlePreviewBoxClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Show
          when={getMediaUrl()}
          fallback={<span style={plusSignStyle}>+</span>}
        >
          {(url) => (
            <>
              <img src={url()} alt="Preview" style={imageStyle} />
              <button
                style={removeButtonStyle()}
                onClick={handleRemoveClick}
                type="button"
              >
                ×
              </button>
            </>
          )}
        </Show>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Show when={showPreviewOverlay() && getMediaUrl()}>
        {(url) => (
          <div
            style={overlayStyle}
            onClick={handleOverlayClick}
            onKeyDown={handleOverlayKeyDown}
            tabIndex={0}
          >
            <img src={url()} alt="Full Preview" style={overlayImageStyle} />
          </div>
        )}
      </Show>
    </div>
  )
}

export default MediaUpload
