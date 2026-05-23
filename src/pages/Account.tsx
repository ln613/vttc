import { Show, onMount, onCleanup, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Button from '../components/Button'
import { accountPageState, accountPageActions } from '../stores/accountPageStore'
import { authActions } from '../stores/authStore'

const containerStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  'min-height': '100vh',
}

const contentStyle: JSX.CSSProperties = {
  padding: '16px 24px 24px',
}

const titleStyle: JSX.CSSProperties = {
  'font-size': '2rem',
  'font-weight': 700,
  'text-align': 'left',
  'margin-top': '0',
  'margin-bottom': '24px',
  color: '#333',
}

const sectionHeaderStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
  'margin-bottom': '16px',
}

const sectionTitleStyle: JSX.CSSProperties = {
  'font-size': '1.17em',
  'font-weight': 700,
  color: '#333',
  margin: '0',
  'text-align': 'left',
}

const editIconButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  color: '#3498db',
}

const buttonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '16px',
  'margin-top': '24px',
}

const signOutContainerStyle: JSX.CSSProperties = {
  'margin-top': '32px',
}

const errorMessageStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'font-weight': 500,
  'margin-top': '16px',
  'text-align': 'left',
  'white-space': 'pre-line',
}

const overlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '1000',
}

const overlayMessageStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '32px 48px',
  'border-radius': '12px',
  'font-size': '18px',
  'font-weight': 600,
  color: '#333',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
  'text-align': 'center',
}

const savedMessageStyle: JSX.CSSProperties = {
  ...overlayMessageStyle,
  color: '#27ae60',
}

const Account = () => {
  const navigate = useNavigate()

  onMount(() => {
    accountPageActions.init()
  })

  onCleanup(() => {
    accountPageActions.reset()
  })

  const handleSignOut = () => {
    authActions.signOut()
    navigate('/events')
  }

  return (
    <div style={containerStyle}>
      <Header />
      <SavingOverlay />
      <SavedOverlay />
      <div style={contentStyle}>
        <h1 style={titleStyle}>Account</h1>
        <ProfileSection />
        <div style={signOutContainerStyle}>
          <Button color="#e74c3c" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  )
}

const SavingOverlay = () => (
  <Show when={accountPageState.saving}>
    <div style={overlayStyle}>
      <div style={overlayMessageStyle}>Saving...</div>
    </div>
  </Show>
)

const SavedOverlay = () => (
  <Show when={accountPageState.saved}>
    <div style={overlayStyle}>
      <div style={savedMessageStyle}>Saved!</div>
    </div>
  </Show>
)

const EditIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const ProfileSection = () => (
  <>
    <div style={sectionHeaderStyle}>
      <h3 style={sectionTitleStyle}>Profile</h3>
      <Show when={!accountPageState.editing}>
        <button style={editIconButtonStyle} onClick={accountPageActions.enterEditMode}>
          <EditIcon />
        </button>
      </Show>
    </div>
    <Input
      label="First Name"
      name="firstName"
      value={accountPageState.formData.firstName}
      onChange={(value) => accountPageActions.setField('firstName', value)}
      disabled={!accountPageState.editing}
    />
    <Input
      label="Last Name"
      name="lastName"
      value={accountPageState.formData.lastName}
      onChange={(value) => accountPageActions.setField('lastName', value)}
      disabled={!accountPageState.editing}
    />
    <Input
      label="Email"
      name="email"
      type="email"
      value={accountPageState.formData.email}
      onChange={(value) => accountPageActions.setField('email', value)}
      disabled={!accountPageState.editing}
    />
    <Input
      label="Phone"
      name="phone"
      type="tel"
      value={accountPageState.formData.phone}
      onChange={(value) => accountPageActions.setField('phone', value)}
      disabled={!accountPageState.editing}
    />
    <Show when={accountPageState.error}>
      <div style={errorMessageStyle}>{accountPageState.error}</div>
    </Show>
    <Show when={accountPageState.editing}>
      <div style={buttonContainerStyle}>
        <Button color="#e74c3c" onClick={accountPageActions.exitEditMode}>
          Cancel
        </Button>
        <Button
          color="#27ae60"
          onClick={accountPageActions.save}
          disabled={accountPageState.saving}
        >
          Save
        </Button>
      </div>
    </Show>
  </>
)

export default Account
