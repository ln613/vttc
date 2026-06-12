import { For, type JSX } from 'solid-js'

const POSTPONE_OPTIONS: { label: string; minutes: number }[] = [
  { label: '5 Minutes', minutes: 5 },
  { label: '10 Minutes', minutes: 10 },
  { label: '30 Minutes', minutes: 30 },
  { label: '1 Hour', minutes: 60 },
]

const PostponeDialog = (props: {
  onSelect: (minutes: number) => void
  onClose: () => void
}) => (
  <div style={overlayStyle} onClick={props.onClose}>
    <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
      <h3 style={titleStyle}>Postpone Match</h3>
      <div style={buttonsStyle}>
        <For each={POSTPONE_OPTIONS}>
          {(opt) => (
            <button
              type="button"
              style={optionButtonStyle}
              onClick={() => props.onSelect(opt.minutes)}
            >
              {opt.label}
            </button>
          )}
        </For>
      </div>
      <button type="button" style={cancelButtonStyle} onClick={props.onClose}>
        Cancel
      </button>
    </div>
  </div>
)

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': 1000,
  padding: '16px',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: '100%',
  'max-width': '320px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '1.2rem',
  'font-weight': 700,
  'margin-top': 0,
  'margin-bottom': '12px',
  color: '#333',
  'text-align': 'center',
}

const buttonsStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': '1fr 1fr',
  gap: '8px',
  'margin-bottom': '12px',
}

const optionButtonStyle: JSX.CSSProperties = {
  padding: '12px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #f39c12',
  'border-radius': '8px',
  'background-color': '#f39c12',
  color: '#fff',
  cursor: 'pointer',
}

const cancelButtonStyle: JSX.CSSProperties = {
  width: '100%',
  padding: '10px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #ddd',
  'border-radius': '8px',
  'background-color': '#fff',
  color: '#333',
  cursor: 'pointer',
}

export default PostponeDialog
