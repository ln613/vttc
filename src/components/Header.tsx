import { Show, createSignal, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { authState, authActions } from '../stores/authStore'
import Input from './Input'
import Button from './Button'

export const Header = () => (
  <header>
    <img
      src="https://res.cloudinary.com/vttc/image/upload/v1767957616/banner.jpg"
      alt="VTTC Banner"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
    <TopBar />
    <SignInDialog />
  </header>
)

const TopBar = () => {
  const navigate = useNavigate()

  const handleEventsClick = () => {
    navigate('/events')
  }

  const handleAccountClick = () => {
    if (authActions.isSignedIn()) {
      navigate('/account')
    } else {
      authActions.showSignInDialog()
    }
  }

  return (
    <div style={topBarStyle}>
      <div style={topBarContentStyle}>
        <button style={navLinkStyle} onClick={handleEventsClick}>
          Events
        </button>
        <button style={accountButtonStyle} onClick={handleAccountClick}>
          <AccountIcon />
        </button>
      </div>
    </div>
  )
}

const AccountIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const SignInDialog = () => {
  const [emailOrPhone, setEmailOrPhone] = createSignal('')
  const [password, setPassword] = createSignal('')

  const handleSignIn = () => {
    authActions.signIn(emailOrPhone(), password())
  }

  const handleOverlayClick = () => {
    authActions.hideSignInDialog()
  }

  const handleDialogClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <Show when={authState.showSignInDialog}>
      <div style={overlayStyle} onClick={handleOverlayClick}>
        <div style={dialogStyle} onClick={handleDialogClick}>
          <h1 style={dialogTitleStyle}>Sign in</h1>
          <Input
            label="Email / Phone"
            name="emailOrPhone"
            value={emailOrPhone()}
            onChange={setEmailOrPhone}
          />
          <Input
            label="Password"
            name="password"
            value={password()}
            onChange={setPassword}
            type="password"
          />
          <Show when={authState.error}>
            <div style={errorStyle}>{authState.error}</div>
          </Show>
          <div style={buttonContainerStyle}>
            <Button
              onClick={handleSignIn}
              color="#27ae60"
              disabled={authState.loading}
            >
              {authState.loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}

// Styles
const topBarStyle: JSX.CSSProperties = {
  'background-color': '#2185d0',
  padding: '0 20px',
  display: 'flex',
  'align-items': 'center',
  'min-height': '48px',
}

const topBarContentStyle: JSX.CSSProperties = {
  'max-width': '1200px',
  width: '100%',
  margin: '0 auto',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'space-between',
}

const navLinkStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fff',
  'font-size': '15px',
  'font-weight': 500,
  cursor: 'pointer',
  padding: '12px 8px',
  'letter-spacing': '0.3px',
}

const accountButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fff',
  cursor: 'pointer',
  padding: '8px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'border-radius': '50%',
  transition: 'background-color 0.2s ease',
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

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '32px',
  'min-width': '360px',
  'max-width': '420px',
  'box-shadow': '0 8px 32px rgba(0, 0, 0, 0.2)',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '24px',
  'font-weight': 700,
  color: '#333',
  'margin-bottom': '20px',
  'text-align': 'center',
}

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '14px',
  'margin-top': '8px',
  'text-align': 'center',
}

const buttonContainerStyle: JSX.CSSProperties = {
  'margin-top': '20px',
  display: 'flex',
  'justify-content': 'center',
}
