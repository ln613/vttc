import { Show, Switch, Match, For, createSignal, type JSX } from 'solid-js'
import { useNavigate } from '@solidjs/router'
import { authState, authActions } from '../stores/authStore'
import { signUpState, signUpActions } from '../stores/signUpStore'
import {
  liveScoreState,
  liveScoreActions,
} from '../stores/liveScoreStore'
import type { TableAssignment } from '../../shared/types/Table'
import Input from './Input'
import Button from './Button'
import Select from './Select'
import DatePicker from './DatePicker'
import PasswordRules from './PasswordRules'
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
    <PendingPasswordModal />
  </header>
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

  const handleTablePick = (t: TableAssignment) => {
    setShowTablePicker(false)
    // URL identifies the table only — the current match on that table
    // is resolved reactively from live-score state by GamePlay's
    // auto-load effect, so the URL never goes stale when the match
    // assignment changes.
    navigate(`/game-play?tableNumber=${t.tableNumber}`)
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
          <Show when={showTablePicker()}>
            <TablePickerDialog
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

// Tablet table picker — same visual language as the AssignTableDialog
// on EventDetail (4-wide grid in 5,6,7,8 / 1,2,3,4 order, live-score
// palette: green=available, red=not_started, blue=in_progress).
// Every cell is clickable; the GamePlay page handles the no-match
// case by showing just the big table number.
const TABLE_GRID_ORDER = [5, 6, 7, 8, 1, 2, 3, 4]

const TablePickerDialog = (props: {
  onPick: (t: TableAssignment) => void
  onClose: () => void
}) => {
  const tableFor = (n: number) =>
    liveScoreState.tables.find((t) => t.tableNumber === n)
  const statusFor = (
    n: number,
  ): 'available' | 'not_started' | 'in_progress' => {
    const t = tableFor(n)
    if (!t || t.status === 'available') return 'available'
    return t.match?.matchStatus === 'not_started' ? 'not_started' : 'in_progress'
  }
  // A table whose current match already has an active umpiring session is
  // being run by another tablet/device. Disable it so picking a table can
  // never take over (kick out) an in-progress umpire.
  const isTakenByAnotherUmpire = (n: number): boolean => {
    const matchId = tableFor(n)?.match?.matchId
    return !!matchId && liveScoreActions.isMatchSessionActive(matchId.toString())
  }
  const handleClick = (n: number) => {
    if (isTakenByAnotherUmpire(n)) return
    const t = tableFor(n) ?? ({
      tableNumber: n as TableAssignment['tableNumber'],
      status: 'available',
    } as TableAssignment)
    props.onPick(t)
  }

  return (
    <div style={tablePickerOverlayStyle} onClick={props.onClose}>
      <div style={tablePickerDialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={tablePickerTitleStyle}>Pick a table</div>
        <div style={tablePickerGridStyle}>
          <For each={TABLE_GRID_ORDER}>
            {(n) => {
              const taken = () => isTakenByAnotherUmpire(n)
              return (
                <button
                  type="button"
                  style={tablePickerCellStyle(statusFor(n), taken())}
                  onClick={() => handleClick(n)}
                  disabled={taken()}
                >
                  {n}
                </button>
              )
            }}
          </For>
        </div>
      </div>
    </div>
  )
}

const tablePickerOverlayStyle: JSX.CSSProperties = {
  position: 'fixed',
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  'background-color': 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  'z-index': '2000',
  padding: '16px',
}

const tablePickerDialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  'border-radius': '12px',
  padding: '20px',
  width: 'auto',
  'max-width': '360px',
  display: 'flex',
  'flex-direction': 'column',
  'align-items': 'center',
  gap: '14px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const tablePickerTitleStyle: JSX.CSSProperties = {
  'font-size': '18px',
  'font-weight': 700,
  color: '#2c3e50',
  'text-align': 'center',
}

const tablePickerGridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(4, 64px)',
  'grid-auto-rows': '64px',
  gap: '8px',
}

const tablePickerCellStyle = (
  status: 'available' | 'not_started' | 'in_progress',
  disabled = false,
): JSX.CSSProperties => {
  const bg =
    status === 'available'
      ? '#27ae60'
      : status === 'not_started'
        ? '#c0392b'
        : '#2980b9'
  return {
    width: '64px',
    height: '64px',
    'border-radius': '10px',
    'font-size': '24px',
    'font-weight': 900,
    color: '#f1c40f',
    'background-color': bg,
    border: '3px solid transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    'text-shadow': '2px 2px 4px rgba(0,0,0,0.3)',
    padding: 0,
    opacity: disabled ? 0.4 : 1,
  }
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
        <Match when={signUpState.showMatchDialog}>
          <MatchedPlayersSection />
        </Match>
        <Match when={true}>
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
                disabled={
                  signUpState.loading
                }
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
        </Match>
      </Switch>
    </>
  )
}

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
      Contact VTTC to get an initial rating before you can register for
      rating-restricted events.
    </div>
    <div style={buttonContainerStyle}>
      <Button onClick={signUpActions.dismissNewPlayerSuccess} color="#27ae60">
        OK
      </Button>
    </div>
  </>
)

const MatchedPlayersSection = () => {
  const players = () => signUpState.matchedPlayers
  const showCol = (key: 'sex' | 'email' | 'phone' | 'rating'): boolean =>
    players().some((p) => !!p[key])

  return (
    <>
      <div style={infoMsgStyle}>
        Player(s) with the same name already exist. Select one to sign up as,
        or create a new player.
      </div>
      <div style={matchTableWrapperStyle}>
      <table style={matchTableStyle}>
        <thead>
          <tr>
            <th style={matchThStyle}></th>
            <th style={matchThStyle}>First Name</th>
            <th style={matchThStyle}>Last Name</th>
            <Show when={showCol('sex')}>
              <th style={matchThStyle}>Sex</th>
            </Show>
            <Show when={showCol('email')}>
              <th style={matchThStyle}>Email</th>
            </Show>
            <Show when={showCol('phone')}>
              <th style={matchThStyle}>Phone</th>
            </Show>
            <Show when={showCol('rating')}>
              <th style={matchThStyle}>Rating</th>
            </Show>
          </tr>
        </thead>
        <tbody>
          <For each={players()}>
            {(player) => {
              const id = player._id.toString()
              const selected = () =>
                signUpState.selectedMatchedPlayerId === id
              return (
                <tr
                  style={selected() ? matchRowSelectedStyle : matchRowStyle}
                  onClick={() => signUpActions.selectMatchedPlayer(id)}
                >
                  <td style={matchTdStyle}>
                    <input
                      type="radio"
                      checked={selected()}
                      onChange={() => signUpActions.selectMatchedPlayer(id)}
                    />
                  </td>
                  <td style={matchTdStyle}>{player.firstName}</td>
                  <td style={matchTdStyle}>{player.lastName}</td>
                  <Show when={showCol('sex')}>
                    <td style={matchTdStyle}>{player.sex ?? ''}</td>
                  </Show>
                  <Show when={showCol('email')}>
                    <td style={matchTdStyle}>{player.email ?? ''}</td>
                  </Show>
                  <Show when={showCol('phone')}>
                    <td style={matchTdStyle}>{player.phone ?? ''}</td>
                  </Show>
                  <Show when={showCol('rating')}>
                    <td style={matchTdStyle}>{player.rating || ''}</td>
                  </Show>
                </tr>
              )
            }}
          </For>
        </tbody>
      </table>
      </div>
      <Show when={signUpState.error}>
        <div style={errorStyle}>{signUpState.error}</div>
      </Show>
      <div style={buttonContainerStyle}>
        <Button
          onClick={signUpActions.chooseNewPlayer}
          color="#888"
          disabled={signUpState.loading}
        >
          New Player
        </Button>
        <Button
          onClick={signUpActions.confirmMatchedPlayer}
          color="#27ae60"
          disabled={
            !signUpState.selectedMatchedPlayerId || signUpState.loading
          }
        >
          Confirm
        </Button>
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

const FieldError = (props: { error?: string }) => (
  <Show when={props.error}>
    <div style={fieldErrorStyle}>{props.error}</div>
  </Show>
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
    <FieldError error={signUpState.fieldErrors.firstName} />
    <Input
      label="Last Name"
      name="signUpLastName"
      value={signUpState.lastName}
      onChange={signUpActions.setLastName}
      disabled={signUpState.existingPlayer}
    />
    <FieldError error={signUpState.fieldErrors.lastName} />
    <Select
      label="Sex"
      name="signUpSex"
      value={signUpState.sex}
      onChange={(value) =>
        signUpActions.setSex(value as 'male' | 'female')
      }
      options={[
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
      ]}
      disabled={signUpState.existingPlayer}
    />
    <FieldError error={signUpState.fieldErrors.sex} />
    <Input
      label="Email"
      name="signUpEmail"
      value={signUpState.email}
      onChange={signUpActions.setEmail}
      type="email"
      disabled={signUpActions.isEmailDisabled()}
      endAdornment={
        signUpState.emailVerified ? <EmailVerifiedCheckmark /> : undefined
      }
    />
    <FieldError error={signUpState.fieldErrors.email} />
    <EmailVerificationSection />
    <Input
      label="Phone"
      name="signUpPhone"
      value={signUpState.phone}
      onChange={signUpActions.setPhone}
      type="tel"
    />
    <FieldError error={signUpState.fieldErrors.phone} />
    <DateOfBirthSection />
    <PasswordSection />
    <FieldError error={signUpState.fieldErrors.password} />
  </>
)

const EmailVerifiedCheckmark = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#27ae60"
    stroke-width="3"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
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
  const inputDisabled = () => signUpActions.isVerificationDisabled()
  const buttonDisabled = () =>
    inputDisabled() || !signUpState.verificationCode

  return (
    <div style={verificationCodeRowStyle}>
      <input
        type="text"
        name="verificationCode"
        value={signUpState.verificationCode}
        onInput={(e) =>
          signUpActions.setVerificationCode(e.currentTarget.value)
        }
        placeholder="Verification code"
        disabled={inputDisabled()}
        style={verificationCodeInputStyle(inputDisabled())}
      />
      <button
        type="button"
        onClick={signUpActions.verifyCode}
        disabled={buttonDisabled()}
        style={verifyButtonStyle(buttonDisabled())}
      >
        Verify
      </button>
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
      Date of birth is required if you want to register for age-restricted
      events
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
    <PasswordRules password={signUpState.password} />
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

const fieldErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '12px',
  'margin-top': '-12px',
  'margin-bottom': '8px',
  'text-align': 'left',
}

const buttonContainerStyle: JSX.CSSProperties = {
  'margin-top': '20px',
  display: 'flex',
  'justify-content': 'center',
  gap: '12px',
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
  'align-items': 'stretch',
}

const verificationCodeInputStyle = (
  disabled: boolean,
): JSX.CSSProperties => ({
  flex: '1',
  padding: '12px 16px',
  'font-size': '16px',
  border: '1px solid #ddd',
  'border-right': 'none',
  'border-radius': '8px 0 0 8px',
  outline: 'none',
  'box-sizing': 'border-box',
  'background-color': disabled ? '#f5f5f5' : '#fff',
  color: '#333',
  cursor: disabled ? 'not-allowed' : 'text',
})

const verifyButtonStyle = (disabled: boolean): JSX.CSSProperties => ({
  padding: '0 20px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #2185d0',
  'border-radius': '0 8px 8px 0',
  'background-color': '#2185d0',
  color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  'white-space': 'nowrap',
})

const verificationErrorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '12px',
  'margin-top': '4px',
}


const dateOfBirthNoteStyle: JSX.CSSProperties = {
  'font-size': '12px',
  color: '#666',
  'margin-top': '-8px',
  'margin-bottom': '8px',
  'text-align': 'left',
}

const matchTableWrapperStyle: JSX.CSSProperties = {
  'overflow-x': 'auto',
  'margin-bottom': '12px',
}

const matchTableStyle: JSX.CSSProperties = {
  width: '100%',
  'border-collapse': 'collapse',
}

const matchThStyle: JSX.CSSProperties = {
  padding: '8px',
  'text-align': 'left',
  'font-size': '13px',
  'font-weight': 600,
  'border-bottom': '2px solid #ddd',
  color: '#333',
}

const matchTdStyle: JSX.CSSProperties = {
  padding: '8px',
  'text-align': 'left',
  'font-size': '13px',
  color: '#333',
  'border-bottom': '1px solid #f0f0f0',
}

const matchRowStyle: JSX.CSSProperties = {
  cursor: 'pointer',
}

const matchRowSelectedStyle: JSX.CSSProperties = {
  cursor: 'pointer',
  'background-color': '#e8f5e9',
}
