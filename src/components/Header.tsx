import { Show, Switch, Match, createSignal, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { authState, authActions } from '../stores/authStore'
import { signUpState, signUpActions } from '../stores/signUpStore'
import Input from './Input'
import Button from './Button'
import Select from './Select'
import DatePicker from './DatePicker'
import { parseLocalDate, formatLocalDate } from '../utils/date'

export const Header = () => (
  <header>
    <img
      src="https://res.cloudinary.com/vttc/image/upload/v1767957616/banner.jpg"
      alt="VTTC Banner"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
    <TopBar />
    <AuthDialog />
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
  const [emailOrPhone, setEmailOrPhone] = createSignal('')
  const [password, setPassword] = createSignal('')

  const handleSignIn = () => {
    authActions.signIn(emailOrPhone(), password())
  }

  const handleGoToSignUp = () => {
    signUpActions.reset()
    authActions.showSignUpDialog()
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
      <div style={linkContainerStyle}>
        <span style={linkStyle} onClick={handleGoToSignUp}>
          Sign up
        </span>
      </div>
    </>
  )
}

// Sign Up Dialog Content

const SignUpDialogContent = () => {
  const handleGoToSignIn = () => {
    signUpActions.reset()
    authActions.showSignInDialog()
  }

  return (
    <>
      <h1 style={dialogTitleStyle}>Sign up</h1>
      <ExistingPlayerCheckbox />
      <Show when={signUpState.existingPlayer}>
        <PlayerDropdown />
      </Show>
      <Show when={signUpActions.playerAlreadySignedUp()}>
        <div style={infoMsgStyle}>
          You already signed up, please sign in.
        </div>
      </Show>
      <Show when={!signUpActions.playerAlreadySignedUp()}>
        <SignUpFormFields />
        <Show when={signUpState.error}>
          <div style={errorStyle}>{signUpState.error}</div>
        </Show>
        <div style={buttonContainerStyle}>
          <Button
            onClick={signUpActions.signUp}
            color="#27ae60"
            disabled={!signUpActions.isSignUpEnabled() || signUpState.loading}
          >
            {signUpState.loading ? 'Signing up...' : 'Sign up'}
          </Button>
        </div>
      </Show>
      <div style={linkContainerStyle}>
        <span style={linkStyle} onClick={handleGoToSignIn}>
          Sign in
        </span>
      </div>
    </>
  )
}

const ExistingPlayerCheckbox = () => {
  const handleChange = () => {
    signUpActions.setExistingPlayer(!signUpState.existingPlayer)
  }

  return (
    <div style={checkboxContainerStyle}>
      <input
        type="checkbox"
        id="existingPlayer"
        checked={signUpState.existingPlayer}
        onChange={handleChange}
        style={checkboxStyle}
      />
      <label for="existingPlayer" style={checkboxLabelStyle}>
        Existing Player
      </label>
    </div>
  )
}

const PlayerDropdown = () => (
  <Select
    label="Player"
    name="player"
    value={signUpState.selectedPlayerId}
    onChange={signUpActions.selectPlayer}
    options={signUpActions.playerOptions()}
    placeholder="-- Select a player --"
  />
)

const SignUpFormFields = () => (
  <>
    <Input
      label="First Name"
      name="signUpFirstName"
      value={signUpState.firstName}
      onChange={signUpActions.setFirstName}
      disabled={signUpState.existingPlayer}
    />
    <Input
      label="Last Name"
      name="signUpLastName"
      value={signUpState.lastName}
      onChange={signUpActions.setLastName}
      disabled={signUpState.existingPlayer}
    />
    <Input
      label="Email"
      name="signUpEmail"
      value={signUpState.email}
      onChange={signUpActions.setEmail}
      type="email"
      disabled={signUpActions.isEmailDisabled()}
    />
    <EmailVerificationSection />
    <Input
      label="Phone"
      name="signUpPhone"
      value={signUpState.phone}
      onChange={signUpActions.setPhone}
      type="tel"
    />
    <DateOfBirthSection />
    <PasswordSection />
  </>
)

const EmailVerificationSection = () => (
  <Show when={!signUpState.emailVerified}>
    <div style={verificationContainerStyle}>
      <SendVerificationCodeLink />
      <VerificationCodeInput />
      <Show when={signUpState.verificationError}>
        <div style={verificationErrorStyle}>
          {signUpState.verificationError}
        </div>
      </Show>
    </div>
  </Show>
)

const SendVerificationCodeLink = () => {
  const isDisabled = () =>
    signUpActions.isVerificationDisabled() ||
    signUpState.verificationSending ||
    signUpState.verificationCountdown > 0

  const label = () => {
    if (signUpState.verificationSending) return 'Sending...'
    if (signUpState.verificationCountdown > 0)
      return `Resend in ${signUpState.verificationCountdown}s`
    return 'Send verification code'
  }

  return (
    <span
      style={{
        ...verificationLinkStyle,
        opacity: isDisabled() ? 0.5 : 1,
        cursor: isDisabled() ? 'default' : 'pointer',
      }}
      onClick={() => !isDisabled() && signUpActions.sendVerificationCode()}
    >
      {label()}
    </span>
  )
}

const VerificationCodeInput = () => {
  const isDisabled = () => signUpActions.isVerificationDisabled()

  return (
    <div style={verificationCodeRowStyle}>
      <div style={verificationCodeInputWrapperStyle}>
        <Input
          label=""
          name="verificationCode"
          value={signUpState.verificationCode}
          onChange={signUpActions.setVerificationCode}
          placeholder="Verification code"
          disabled={isDisabled()}
        />
      </div>
      <Button
        onClick={signUpActions.verifyCode}
        color="#2185d0"
        size="small"
        disabled={isDisabled() || !signUpState.verificationCode}
      >
        Verify
      </Button>
    </div>
  )
}

const DateOfBirthSection = () => (
  <div>
    <DatePicker
      label="Date of Birth"
      value={
        signUpState.dateOfBirth
          ? parseLocalDate(signUpState.dateOfBirth)
          : null
      }
      onChange={(date) =>
        signUpActions.setDateOfBirth(date ? formatLocalDate(date) : '')
      }
      minYear={new Date().getFullYear() - 100}
      maxYear={new Date().getFullYear()}
    />
    <div style={dateOfBirthNoteStyle}>
      Date of birth is required if you want to register age-restricted events
    </div>
  </div>
)

const PasswordSection = () => (
  <div>
    <Input
      label="Password"
      name="signUpPassword"
      value={signUpState.password}
      onChange={signUpActions.setPassword}
      type="password"
    />
    <Show when={signUpState.password.length > 0}>
      <div style={passwordRulesStyle}>
        <PasswordRule
          met={signUpActions.passwordHasMinLength(signUpState.password)}
          label="At least 8 characters"
        />
        <PasswordRule
          met={signUpActions.passwordHasNumber(signUpState.password)}
          label="Contains at least 1 number"
        />
        <PasswordRule
          met={signUpActions.passwordHasUppercase(signUpState.password)}
          label="Contains at least 1 uppercase"
        />
        <PasswordRule
          met={signUpActions.passwordHasLowercase(signUpState.password)}
          label="Contains at least 1 lowercase"
        />
      </div>
    </Show>
  </div>
)

const PasswordRule = (props: { met: boolean; label: string }) => (
  <div
    style={{
      ...passwordRuleStyle,
      color: props.met ? '#27ae60' : '#e74c3c',
    }}
  >
    <span>{props.met ? '✓' : '✗'}</span>
    <span>{props.label}</span>
  </div>
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

const checkboxContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
  'margin-bottom': '16px',
}

const checkboxStyle: JSX.CSSProperties = {
  width: '18px',
  height: '18px',
  cursor: 'pointer',
}

const checkboxLabelStyle: JSX.CSSProperties = {
  'font-size': '14px',
  'font-weight': 600,
  color: '#333',
  cursor: 'pointer',
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

const verificationContainerStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
}

const verificationLinkStyle: JSX.CSSProperties = {
  color: '#2185d0',
  'font-size': '13px',
  'text-decoration': 'underline',
  display: 'inline-block',
  'margin-bottom': '8px',
}

const verificationCodeRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
}

const verificationCodeInputWrapperStyle: JSX.CSSProperties = {
  flex: '1',
}

const verificationErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '12px',
  'margin-top': '4px',
}

const passwordRulesStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '2px',
  'margin-top': '-8px',
  'margin-bottom': '8px',
}

const passwordRuleStyle: JSX.CSSProperties = {
  'font-size': '12px',
  display: 'flex',
  'align-items': 'center',
  gap: '6px',
}

const dateOfBirthNoteStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: '#666',
  'margin-top': '-8px',
  'margin-bottom': '8px',
  'text-align': 'left',
}
