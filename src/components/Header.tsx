import {
  Show,
  Switch,
  Match,
  createSignal,
  onMount,
  type JSX,
} from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { authState, authActions } from '../stores/authStore'
import { signUpState, signUpActions } from '../stores/signUpStore'
import {
  liveScoreState,
  liveScoreActions,
} from '../stores/liveScoreStore'
import Input from './Input'
import Button from './Button'
import SignUpWizard from './SignUpWizard'
import GoogleSignInIcon, { GoogleSignInStatus } from './GoogleSignInIcon'
import { iconRowStyle } from './SignInIcons'
import TablePickerDialog, {
  type TableCellStatus,
} from './TablePickerDialog'
import clubConfig from 'club-config'

export const Header = () => (
  <header>
    <Banner />
    <TopBar />
    <AuthDialog />
    <PendingPasswordModal />
  </header>
)

const MOBILE_BANNER_MAX_WIDTH = 768

// A club may supply a second crop for narrow screens. <picture> lets the
// browser pick before it fetches, so a phone never downloads the wide
// banner just to squash it. Without a mobile crop the <source> points at
// the same file as the <img>, which is one request either way — no reason
// to make the element conditional.
const Banner = () => (
  <picture>
    <source
      media={`(max-width: ${MOBILE_BANNER_MAX_WIDTH}px)`}
      srcset={
        clubConfig.branding.bannerUrlMobile || clubConfig.branding.bannerUrl
      }
    />
    <img
      src={clubConfig.branding.bannerUrl}
      alt={clubConfig.branding.bannerAlt}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  </picture>
)

const PendingPasswordModal = () => {
  const navigate = useNavigate()
  const handleConfirm = () => {
    authActions.dismissPendingModal()
    navigate('/account')
  }
  return (
    <Show when={authState.showPendingModal}>
      <div style={overlayStyle}>
        <div style={dialogStyle}>
          <h3 style={dialogTitleStyle}>Change your password</h3>
          <div style={infoMsgStyle}>
            This account was created on your behalf. Please change your
            password on the Account page.
          </div>
          <div style={buttonContainerStyle}>
            <Button color="#27ae60" onClick={handleConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </div>
    </Show>
  )
}

const TopBar = () => {
  const navigate = useNavigate()
  const [showTablePicker, setShowTablePicker] = createSignal(false)
  const [showUmpirePassword, setShowUmpirePassword] = createSignal(false)

  // The button only exists while there is something to umpire, and the
  // header is on every page — so the table state has to be loaded here
  // rather than waiting for a page that happens to need it.
  onMount(() => {
    if (liveScoreState.tables.length === 0) void liveScoreActions.fetchLiveScore()
  })

  // The button is only shown to people with no account, so this always asks
  // for the match-day password.
  const handleUmpireClick = () => {
    void liveScoreActions.fetchLiveScore()
    setShowUmpirePassword(true)
  }

  const handleUmpireAuthenticated = () => {
    setShowUmpirePassword(false)
    setShowTablePicker(true)
  }

  const handleLiveScoreClick = () => {
    if (authState.isTablet) {
      // Tablet role: open the Umpire table-picker. Ensure live-score
      // state is loaded so we have current table assignments.
      void liveScoreActions.fetchLiveScore()
      setShowTablePicker(true)
      return
    }
    navigate('/live-score')
  }

  const handleTablePick = (tableNumber: number) => {
    setShowTablePicker(false)
    // URL identifies the table only — the current match on that table
    // is resolved reactively from live-score state by GamePlay's
    // auto-load effect, so the URL never goes stale when the match
    // assignment changes.
    navigate(`/game-play?tableNumber=${tableNumber}`)
  }

  // Green free, red waiting to start, blue under way — the same colours the
  // Live Score page uses for a table.
  const statusForTable = (n: number): TableCellStatus => {
    const table = liveScoreState.tables.find((t) => t.tableNumber === n)
    if (!table || table.status === 'available') return 'available'
    return table.match?.matchStatus === 'not_started'
      ? 'not_started'
      : 'in_progress'
  }

  const handleEventsClick = () => {
    navigate('/events')
  }

  const handlePlayersClick = () => {
    navigate('/players')
  }

  const handleScheduleClick = () => {
    navigate('/schedule')
  }

  const handleAccountClick = () => {
    if (authActions.isSignedIn()) {
      navigate('/account')
    } else {
      authActions.showSignInDialog()
    }
  }

  const handleSettingsClick = () => {
    navigate('/settings')
  }

  return (
    <div style={topBarStyle}>
      <div style={topBarContentStyle}>
        <div style={navLeftStyle}>
          <button
            style={
              authState.isTablet ? navLinkStyle : liveScoreButtonStyle
            }
            onClick={handleLiveScoreClick}
          >
            <Show when={authState.isTablet} fallback={<LiveScoreIcon />}>
              Tablet
            </Show>
          </button>
          {/* For umpires without an account. Admins reach Game Play from the
              match rows, and the tablet has its own button. */}
          <Show
            when={
              !authState.isTablet &&
              !authState.isAdmin &&
              liveScoreState.allowPublicUmpire &&
              liveScoreActions.hasMatchesToUmpire()
            }
          >
            <button style={umpireButtonStyle} onClick={handleUmpireClick}>
              Umpire
            </button>
          </Show>
          <Show when={showUmpirePassword()}>
            <UmpirePasswordDialog
              onAuthenticated={handleUmpireAuthenticated}
              onClose={() => setShowUmpirePassword(false)}
            />
          </Show>
          <Show when={showTablePicker()}>
            <TablePickerDialog
              statusFor={statusForTable}
              isDisabled={(n) => !liveScoreActions.canEnterTable(n)}
              onPick={handleTablePick}
              onClose={() => setShowTablePicker(false)}
            />
          </Show>
          <button style={navLinkStyle} onClick={handleEventsClick}>
            Events
          </button>
          <button style={navLinkStyle} onClick={handleScheduleClick}>
            Schedule
          </button>
          <button style={navLinkStyle} onClick={handlePlayersClick}>
            Players
          </button>
        </div>
        <div style={navRightStyle}>
          <Show when={authState.isAdmin}>
            <button style={accountButtonStyle} onClick={handleSettingsClick}>
              <SettingsIcon />
            </button>
          </Show>
          <button style={accountButtonStyle} onClick={handleAccountClick}>
            <AccountIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * The match-day password, which anyone running a table can be given. It
 * authenticates as the tablet role — read-only everywhere except umpiring,
 * which is exactly the right for this.
 */
const UmpirePasswordDialog = (props: {
  onAuthenticated: () => void
  onClose: () => void
}) => {
  const [password, setPassword] = createSignal('')
  const [error, setError] = createSignal('')
  const [busy, setBusy] = createSignal(false)

  const submit = async () => {
    if (!password()) {
      setError('Enter the match day password.')
      return
    }
    setBusy(true)
    setError('')
    const ok = await authActions.signInAsUmpire(password())
    setBusy(false)
    if (ok) props.onAuthenticated()
    else setError('That password was not accepted.')
  }

  return (
    <div style={overlayStyle} onClick={props.onClose}>
      <div style={umpireDialogStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={dialogTitleStyle}>Umpire a Match</h2>
        <div style={umpireHintStyle}>
          Enter the match day password to score a match on any table.
        </div>
        <Input
          label="Match Day Password"
          name="matchDayPassword"
          type="password"
          value={password()}
          onChange={setPassword}
        />
        <Show when={error()}>
          <div style={umpireErrorStyle}>{error()}</div>
        </Show>
        <div style={umpireButtonRowStyle}>
          <Button color="#e74c3c" onClick={props.onClose}>
            Cancel
          </Button>
          <Button color="#27ae60" onClick={() => void submit()} disabled={busy()}>
            {busy() ? 'Checking...' : 'Continue'}
          </Button>
        </div>
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

const SettingsIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

// Auth Dialog (switches between sign in and sign up)

const AuthDialog = () => {
  const handleOverlayClick = () => {
    authActions.hideDialog()
    signUpActions.reset()
  }

  const handleDialogClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <Show when={authState.dialogView !== null}>
      <div style={overlayStyle} onClick={handleOverlayClick}>
        <div style={dialogStyle} onClick={handleDialogClick}>
          <Switch>
            <Match when={authState.dialogView === 'signIn'}>
              <SignInDialogContent />
            </Match>
            <Match when={authState.dialogView === 'signUp'}>
              <SignUpDialogContent />
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  )
}

// Sign In Dialog Content

const SignInDialogContent = () => {
  const [emailOrPhone, setEmailOrPhone] = createSignal(authState.signInPrefill)
  const [password, setPassword] = createSignal('')

  const handleSignIn = () => {
    authActions.signIn(emailOrPhone(), password())
  }

  const handleGoToSignUp = () => {
    signUpActions.open()
  }

  return (
    <>
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
          color="#2185d0"
          disabled={authState.loading}
        >
          {authState.loading ? 'Signing in...' : 'Sign in'}
        </Button>
      </div>
      <div style={googleSignInRowStyle}>
        <div style={iconRowStyle}>
          <GoogleSignInIcon />
        </div>
        <GoogleSignInStatus />
      </div>
      <div style={linkContainerStyle}>
        <span style={linkStyle} onClick={handleGoToSignUp}>
          Sign up
        </span>
      </div>
    </>
  )
}

// Sign Up Dialog Content

const SignUpDialogContent = () => (
  <>
    <h1 style={dialogTitleStyle}>
      {signUpState.adminRegisterMode ? 'Register Player' : 'Sign up'}
    </h1>
    <Switch>
      <Match when={signUpState.adminRegisterMode}>
        <AdminRegisterSection />
      </Match>
      <Match when={signUpState.showNewPlayerSuccess}>
        <NewPlayerSuccessSection />
      </Match>
      <Match when={true}>
        <SignUpWizard />
      </Match>
    </Switch>
  </>
)

const AdminRegisterSection = () => (
  <Show
    when={!signUpState.adminRegisterSent}
    fallback={
      <>
        <div style={infoMsgStyle}>
          Sign up email sent to {signUpState.email}.
        </div>
        <div style={buttonContainerStyle}>
          <Button onClick={authActions.hideDialog} color="#27ae60">
            OK
          </Button>
        </div>
      </>
    }
  >
    <div style={infoMsgStyle}>
      Send a sign up email to <strong>{signUpState.firstName} {signUpState.lastName}</strong> ({signUpState.email}).
      A temporary password will be auto-generated; they'll be asked to change
      it on first sign in.
    </div>
    <Show when={signUpState.error}>
      <div style={errorStyle}>{signUpState.error}</div>
    </Show>
    <div style={buttonContainerStyle}>
      <Button
        onClick={authActions.hideDialog}
        color="#e74c3c"
        disabled={signUpState.loading}
      >
        Cancel
      </Button>
      <Button
        onClick={signUpActions.runAdminRegister}
        color="#27ae60"
        disabled={signUpState.loading}
      >
        {signUpState.loading ? 'Sending...' : 'Sign up'}
      </Button>
    </div>
  </Show>
)

const NewPlayerSuccessSection = () => (
  <>
    <div style={infoMsgStyle}>
      Contact {clubConfig.branding.contactName} to get an initial rating
      before you can register for rating-restricted events.
    </div>
    <div style={buttonContainerStyle}>
      <Button onClick={signUpActions.dismissNewPlayerSuccess} color="#27ae60">
        OK
      </Button>
    </div>
  </>
)

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

const navRightStyle: JSX.CSSProperties = {
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

const umpireButtonStyle: JSX.CSSProperties = {
  'background-color': '#27ae60',
  color: '#fff',
  border: 'none',
  'border-radius': '6px',
  padding: '6px 12px',
  'font-size': '14px',
  'font-weight': 700,
  cursor: 'pointer',
  'white-space': 'nowrap',
}

const umpireDialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '24px',
  width: '100%',
  'max-width': '360px',
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
}

const umpireHintStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  'margin-bottom': '4px',
}

const umpireErrorStyle: JSX.CSSProperties = {
  color: '#c0392b',
  'font-size': '13px',
}

const umpireButtonRowStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
  'justify-content': 'flex-end',
  'margin-top': '8px',
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
  'max-height': '85vh',
  'overflow-y': 'auto',
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
  gap: '12px',
}

const googleSignInRowStyle: JSX.CSSProperties = {
  'margin-top': '16px',
}

const linkContainerStyle: JSX.CSSProperties = {
  'margin-top': '16px',
  'text-align': 'center',
}

const linkStyle: JSX.CSSProperties = {
  color: '#2185d0',
  'font-size': '14px',
  cursor: 'pointer',
  'text-decoration': 'underline',
}

const infoMsgStyle: JSX.CSSProperties = {
  color: '#e67e22',
  'font-size': '14px',
  'text-align': 'center',
  'margin-top': '12px',
  'margin-bottom': '12px',
  padding: '8px 12px',
  'background-color': '#fef9e7',
  'border-radius': '6px',
  border: '1px solid #f9e79f',
}


