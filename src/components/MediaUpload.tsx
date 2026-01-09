import React, { useRef, useState } from 'react'

interface MediaUploadProps {
  label?: string
  value: File | string | null
  onChange: (file: File | null) => void
  className?: string
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  label,
  value,
  onChange,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false)

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

  const previewBoxStyle: React.CSSProperties = {
    width: '300px',
    height: '300px',
    border: '2px dashed #ddd',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#fafafa',
  }

  const plusSignStyle: React.CSSProperties = {
    fontSize: '64px',
    color: '#ccc',
    fontWeight: 300,
    userSelect: 'none',
  }

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  }

  const removeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    width: '28px',
    height: '28px',
    padding: 0,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: isHovered ? 'flex' : 'none',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 'bold',
    lineHeight: 1,
    transition: 'opacity 0.2s ease',
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  }

  const overlayImageStyle: React.CSSProperties = {
    maxWidth: '90vw',
    maxHeight: '90vh',
    objectFit: 'contain',
  }

  const getMediaUrl = (): string | null => {
    if (!value) return null
    if (typeof value === 'string') return value
    return URL.createObjectURL(value)
  }

  const handlePreviewBoxClick = () => {
    if (!value) {
      fileInputRef.current?.click()
    } else {
      setShowPreviewOverlay(true)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    onChange(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
  }

  const handleOverlayClick = () => {
    setShowPreviewOverlay(false)
  }

  const handleOverlayKeyDown = (e: React.KeyboardEvent) => {
    setShowPreviewOverlay(false)
  }

  const mediaUrl = getMediaUrl()

  return (
    <div style={containerStyle} className={className}>
      {label && <label style={labelStyle}>{label}</label>}
      <div
        style={previewBoxStyle}
        onClick={handlePreviewBoxClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {mediaUrl ? (
          <>
            <img src={mediaUrl} alt="Preview" style={imageStyle} />
            <button
              style={removeButtonStyle}
              onClick={handleRemoveClick}
              type="button"
            >
              ×
            </button>
          </>
        ) : (
          <span style={plusSignStyle}>+</span>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {showPreviewOverlay && mediaUrl && (
        <div
          style={overlayStyle}
          onClick={handleOverlayClick}
          onKeyDown={handleOverlayKeyDown}
          tabIndex={0}
        >
          <img src={mediaUrl} alt="Full Preview" style={overlayImageStyle} />
        </div>
      )}
    </div>
  )
}

export default MediaUpload
