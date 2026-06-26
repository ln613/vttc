import { Show, onMount, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import { authState } from '../stores/authStore'
import { settingsState, settingsActions } from '../stores/settingsStore'

const Settings = () => {
  onMount(() => {
    if (!authState.isAdmin) return
    void settingsActions.fetchSettings()
  })

  return (
    <div style={containerStyle}>
      <Header />
      <Show when={authState.isAdmin}>
        <div style={contentStyle}>
          <TitleRow />
          <Show when={settingsState.error}>
            <div style={errorStyle}>{settingsState.error}</div>
          </Show>
          <EventSettingSection />
          <RevenueSection />
        </div>
      </Show>
    </div>
  )
}

const RevenueSection = () => {
  const navigate = useNavigate()
  return (
    <div style={sectionStyle}>
      <h4 style={sectionHeaderStyle}>Revenue</h4>
      <div style={linkColumnStyle}>
        <button
          type="button"
          style={linkButtonStyle}
          onClick={() => navigate('/revenue')}
        >
          Revenue
        </button>
        <button
          type="button"
          style={linkButtonStyle}
          onClick={() => navigate('/revenue-calculator')}
        >
          Revenue Calculator
        </button>
      </div>
    </div>
  )
}

const TitleRow = () => (
  <div style={titleRowStyle}>
    <h3 style={titleStyle}>Settings</h3>
    <div style={actionIconsStyle}>
      <Show when={settingsState.saving}>
        <SpinnerIcon />
      </Show>
      <Show
        when={settingsState.editing}
        fallback={
          <Show when={authState.isAdmin && !settingsState.saving}>
            <IconButton
              label="Edit"
              onClick={() => settingsActions.startEditing()}
            >
              <EditGlyph />
            </IconButton>
          </Show>
        }
      >
        <Show when={!settingsState.saving}>
          <IconButton
            label="Cancel"
            onClick={() => settingsActions.cancelEditing()}
          >
            <CancelGlyph />
          </IconButton>
          <IconButton
            label="Save"
            onClick={() => void settingsActions.save()}
          >
            <SaveGlyph />
          </IconButton>
        </Show>
      </Show>
    </div>
  </div>
)

const EventSettingSection = () => {
  const value = () =>
    settingsState.editing
      ? settingsState.draft.ignoreUnpaidInGeneration
      : settingsState.settings.ignoreUnpaidInGeneration
  return (
    <div style={sectionStyle}>
      <h4 style={sectionHeaderStyle}>Event Setting</h4>
      <label style={checkboxRowStyle}>
        <input
          type="checkbox"
          checked={value()}
          disabled={!settingsState.editing}
          onChange={(e) =>
            settingsActions.setDraft(
              'ignoreUnpaidInGeneration',
              (e.target as HTMLInputElement).checked,
            )
          }
          style={checkboxStyle}
        />
        <span style={checkboxLabelStyle}>
          Ignore unpaid players when generating groups, RR or first round
          knockout if no group stage
        </span>
      </label>
    </div>
  )
}

const IconButton = (props: {
  label: string
  onClick: () => void
  children: JSX.Element
}) => (
  <button
    type="button"
    aria-label={props.label}
    title={props.label}
    style={iconButtonStyle}
    onClick={props.onClick}
  >
    {props.children}
  </button>
)

const EditGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
)

const CancelGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
)

const SaveGlyph = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
  </svg>
)

const SpinnerIcon = () => (
  <div style={spinnerStyle} aria-label="Saving">
    <div style={spinnerInnerStyle} />
  </div>
)

const containerStyle: JSX.CSSProperties = {
  'min-height': '100vh',
  'background-color': '#f5f6fa',
}

const contentStyle: JSX.CSSProperties = {
  'max-width': '720px',
  margin: '0 auto',
  padding: '24px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '20px',
}

const titleRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  gap: '12px',
}

const titleStyle: JSX.CSSProperties = {
  margin: 0,
  'font-size': '20px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'left',
}

const actionIconsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
}

const iconButtonStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
  width: '36px',
  height: '36px',
  border: '1px solid #d0d7de',
  'border-radius': '8px',
  background: '#fff',
  color: '#2c3e50',
  cursor: 'pointer',
  padding: 0,
}

const sectionStyle: JSX.CSSProperties = {
  background: '#fff',
  border: '1px solid #e1e4e8',
  'border-radius': '10px',
  padding: '16px 20px',
}

const sectionHeaderStyle: JSX.CSSProperties = {
  margin: '0 0 12px',
  'font-size': '15px',
  'font-weight': 700,
  color: '#2c3e50',
}

const checkboxRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'flex-start',
  gap: '10px',
  cursor: 'pointer',
}

const checkboxStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  'margin-top': '2px',
  'flex-shrink': 0,
}

const checkboxLabelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#333',
  'line-height': '1.4',
}

const linkColumnStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'flex-start',
  gap: '10px',
}

const linkButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#3498db',
  'font-size': '14px',
  'font-weight': 600,
  cursor: 'pointer',
  'text-decoration': 'underline',
}

const errorStyle: JSX.CSSProperties = {
  padding: '10px 14px',
  background: '#fdecea',
  color: '#c0392b',
  'border-radius': '8px',
  'font-size': '13px',
}

const spinnerStyle: JSX.CSSProperties = {
  width: '20px',
  height: '20px',
  display: 'inline-flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const spinnerInnerStyle: JSX.CSSProperties = {
  width: '16px',
  height: '16px',
  border: '2px solid #bdc3c7',
  'border-top-color': '#3498db',
  'border-radius': '50%',
  animation: 'spin 0.8s linear infinite',
}

export default Settings
