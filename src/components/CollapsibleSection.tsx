import { Show, type JSX } from 'solid-js'
import { themed } from '../site/themed'
import '../pages/booking.css'

// A titled section that opens and closes from its header. `summary` sits
// beside the title so a closed section can still say something useful (a
// balance, a count); `actions` sit at the right edge, outside the toggle, so
// pressing one never opens or closes the section. On a club with its own
// website each section is a card in the site's look (booking.css).
const CollapsibleSection = (props: {
  title: string
  open: boolean
  onToggle: () => void
  summary?: JSX.Element
  actions?: JSX.Element
  children: JSX.Element
}) => (
  <section {...themed(sectionStyle, 'cs-card')}>
    <div style={headerStyle}>
      <button
        type="button"
        style={toggleStyle}
        onClick={() => props.onToggle()}
        aria-expanded={props.open}
      >
        <span style={chevronStyle(props.open)}>
          <ChevronIcon />
        </span>
        <span {...themed(titleStyle, 'cs-title')}>{props.title}</span>
        <Show when={props.summary}>
          <span style={summaryStyle}>{props.summary}</span>
        </Show>
      </button>
      <Show when={props.actions}>
        <div style={actionsStyle}>{props.actions}</div>
      </Show>
    </div>
    <Show when={props.open}>
      <div style={bodyStyle}>{props.children}</div>
    </Show>
  </section>
)

const ChevronIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="9 6 15 12 9 18" />
  </svg>
)

const sectionStyle: JSX.CSSProperties = {
  'border-bottom': '1px solid #e5e7eb',
}

const headerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'min-height': '56px',
}

const toggleStyle: JSX.CSSProperties = {
  flex: '1 1 auto',
  'min-width': 0,
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  padding: '14px 0',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  'text-align': 'left',
  color: '#333',
}

const chevronStyle = (open: boolean): JSX.CSSProperties => ({
  width: '20px',
  height: '20px',
  'box-sizing': 'border-box',
  padding: 0,
  flex: 'none',
  display: 'grid',
  'place-items': 'center',
  color: '#888',
  transform: open ? 'rotate(90deg)' : 'none',
  transition: 'transform 0.15s ease',
})

const titleStyle: JSX.CSSProperties = {
  'font-size': '1.17em',
  'font-weight': 700,
}

const summaryStyle: JSX.CSSProperties = {
  'margin-left': 'auto',
  'font-size': '14px',
  color: '#666',
  'white-space': 'nowrap',
}

const actionsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  flex: 'none',
}

const bodyStyle: JSX.CSSProperties = {
  'padding-bottom': '20px',
}

export default CollapsibleSection
