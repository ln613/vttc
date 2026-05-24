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

  const handleLiveScoreClick = () => {
    navigate('/live-score')
  }

  const handleEventsClick = () => {
    navigate('/events')
  }

  const handlePlayersClick = () => {
    navigate('/players')
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
        <div style={navLeftStyle}>
          <button style={liveScoreButtonStyle} onClick={handleLiveScoreClick}>
            <LiveScoreIcon />
          </button>
          <button style={navLinkStyle} onClick={handleEventsClick}>
            Events
          </button>
          <button style={navLinkStyle} onClick={handlePlayersClick}>
            Players
          </button>
        </div>
        <button style={accountButtonStyle} onClick={handleAccountClick}>
          <AccountIcon />
        </button>
      </div>
    </div>
  )
}

const LiveScoreIcon = () => (
  <span style={liveBadgeStyle}>
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="2" fill="#fff" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49" />
      <path d="M7.76 16.24a6 6 0 0 1 0-8.49" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
    <span style={liveTextStyle}>LIVE</span>
  </span>
)

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

const navLeftStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '4px',
}

const liveScoreButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
}

const liveBadgeStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '4px',
  'background-color': '#e53935',
  'border-radius': '6px',
  padding: '4px 8px',
}

const liveTextStyle: JSX.CSSProperties = {
  color: '#fff',
  'font-size': '12px',
  'font-weight': 800,
  'letter-spacing': '0.5px',
  'line-height': 1,
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
