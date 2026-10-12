import {
  Show,
  Switch,
  Match,
  For,
  createSignal,
  onMount,
  type JSX,
} from 'solid-js'
import { useNavigate, useLocation } from '@solidjs/router'
import { authState, authActions } from '../stores/authStore'
import { signUpState, signUpActions } from '../stores/signUpStore'
import {
  liveScoreState,
  liveScoreActions,
} from '../stores/liveScoreStore'
import Input from './Input'
import SignUpWizard from './SignUpWizard'
import GoogleSignInIcon, { GoogleSignInStatus } from './GoogleSignInIcon'
import { iconRowStyle } from './SignInIcons'
import TablePickerDialog, {
  type TableCellStatus,
} from './TablePickerDialog'
import clubConfig from 'club-config'
import { modulesActions } from '../stores/modulesStore'
import { langState, langActions } from '../stores/langStore'
import { hasSite, hasSiteLook } from '../site/siteContent'
import { hasLanding } from '../site/landingContent'
import { pointsModel } from '../i18n/wallet'
import DialogFrame from './DialogFrame'
import SiteBanner from './SiteBanner'
import ClubBanner from './ClubBanner'
import ThemeButton from './ThemeButton'
import { themed } from '../site/themed'

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
// A club with its own website gets its site's banner (SiteBanner): a
// photo with the logo and name over it, which can't be squashed.
// A club without a website can have a banner built the same way from its
// config (ClubBanner: artwork with its logo and name over it).
const Banner = () => (
  <Switch>
    <Match when={hasSite()}>
      <SiteBanner />
    </Match>
    <Match when={clubConfig.branding.banner}>
      <ClubBanner />
    </Match>
    <Match when={true}>
      <PictureBanner />
    </Match>
  </Switch>
)

const PictureBanner = () => (
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
      <DialogFrame title="Change your password">
        <div style={infoMsgStyle}>
          This account was created on your behalf. Please change your
          password on the Account page.
        </div>
        <div style={buttonContainerStyle}>
          <ThemeButton variant="primary" onClick={handleConfirm}>
            Confirm
          </ThemeButton>
        </div>
      </DialogFrame>
    </Show>
  )
}

const TopBar = () => {
  const navigate = useNavigate()
  const [showTablePicker, setShowTablePicker] = createSignal(false)
  const [showUmpirePassword, setShowUmpirePassword] = createSignal(false)
  const [menuOpen, setMenuOpen] = createSignal(false)

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

  const goTo = (path: string) => () => {
    setMenuOpen(false)
    navigate(path)
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
    <div class="vttc-topbar" style={topBarStyle}>
      <div style={topBarContentStyle}>
        <div class="vttc-nav-left" style={navLeftStyle}>
          {/* A club with its own website has more links than a phone can
              show, so there they fold into a menu (see App.css). */}
          <Show when={hasSite()}>
            <MenuButton open={menuOpen()} onToggle={() => setMenuOpen(!menuOpen())} />
          </Show>
          {/* Each link follows its module (specs/rules/modules.md). The
              tablet's button is Game Play; everyone else's is Live Score. */}
          <Show
            when={modulesActions.on(authState.isTablet ? 'gamePlay' : 'liveScore')}
          >
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
          </Show>
          {/* For umpires without an account. Admins reach Game Play from the
              match rows, and the tablet has its own button. */}
          <Show
            when={
              modulesActions.on('gamePlay') &&
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
          <div class={hasSite() ? 'vttc-nav-links has-menu' : 'vttc-nav-links'}>
            <For each={navItems()}>
              {(item) => (
                <button class="vttc-nav-link" style={navLinkStyle} onClick={goTo(item.path)}>
                  {langActions.t(item.label)}
                </button>
              )}
            </For>
          </div>
        </div>
        <div style={navRightStyle}>
          <Show when={langActions.canToggle()}>
            <LanguageToggle />
          </Show>
          <Show when={authState.isAdmin}>
            <button class="vttc-topbar-icon" style={accountButtonStyle} onClick={handleSettingsClick}>
              <SettingsIcon />
            </button>
          </Show>
          <button class="vttc-topbar-icon" style={accountButtonStyle} onClick={handleAccountClick}>
            <AccountIcon />
          </button>
        </div>
      </div>
      <Show when={menuOpen()}>
        <MenuPanel onPick={goTo} onClose={() => setMenuOpen(false)} />
      </Show>
    </div>
  )
}

// The page links, in order. Each follows its module (specs/rules/modules.md);
// the website's own pages only exist for a club that has one.
const navItems = () =>
  [
    { label: 'nav.home', path: '/', show: hasSite() || hasLanding() },
    { label: 'nav.events', path: '/events', show: modulesActions.on('events') },
    { label: 'nav.schedule', path: '/schedule', show: modulesActions.on('schedule') },
    { label: 'nav.players', path: '/players', show: modulesActions.on('players') },
    { label: 'nav.coaches', path: '/coaches', show: hasSite() },
    { label: 'nav.pricing', path: '/pricing', show: hasSite() },
    {
      label: 'nav.booking',
      path: '/booking',
      show: modulesActions.on('calendar') && !authState.isTablet,
    },
    {
      label: 'nav.rewards',
      path: '/rewards',
      show: pointsModel && modulesActions.on('credit') && !authState.isTablet,
    },
    { label: 'nav.about', path: '/about', show: hasSite() },
  ].filter((item) => item.show)

// The hamburger: three bars, a cross while the menu is open.
const MenuButton = (props: { open: boolean; onToggle: () => void }) => (
  <button
    type="button"
    class="vttc-menu-btn"
    aria-label={langActions.t('nav.menu')}
    aria-expanded={props.open}
    onClick={() => props.onToggle()}
  >
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
      <Show
        when={props.open}
        fallback={
          <>
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </>
        }
      >
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </Show>
    </svg>
  </button>
)

// The links stacked under the top bar, the current page marked. Tapping
// outside closes it.
const MenuPanel = (props: {
  onPick: (path: string) => () => void
  onClose: () => void
}) => {
  const location = useLocation()
  const isCurrent = (path: string) => location.pathname === path
  return (
    <>
      <div class="vttc-menu-backdrop" onClick={() => props.onClose()} />
      <nav class="vttc-menu-panel" style={{ 'background-color': topBarStyle['background-color'] }}>
        <For each={navItems()}>
          {(item) => (
            <button
              type="button"
              class={isCurrent(item.path) ? 'vttc-menu-link is-on' : 'vttc-menu-link'}
              aria-current={isCurrent(item.path) ? 'page' : undefined}
              onClick={props.onPick(item.path)}
            >
              {langActions.t(item.label)}
            </button>
          )}
        </For>
      </nav>
    </>
  )
}

// Switches the top bar and the club's website between its languages. It
// shows the language it switches *to*, the way bilingual sites usually do.
const LanguageToggle = () => (
  <button
    type="button"
    class="vttc-lang-toggle"
    style={languageToggleStyle}
    onClick={langActions.toggle}
    aria-label={langActions.t('language.label')}
    title={langActions.t('language.label')}
    lang={langState.lang === 'en' ? 'zh-Hans' : 'en'}
  >
    <GlobeIcon />
    <span>{langActions.t('language.switchTo')}</span>
  </button>
)

const GlobeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </svg>
)

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
    <DialogFrame title="Umpire a Match" onClose={props.onClose}>
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
        <ThemeButton variant="secondary" plainColor="#e74c3c" onClick={props.onClose}>
          Cancel
        </ThemeButton>
        <ThemeButton
          variant="primary"
          onClick={() => void submit()}
          disabled={busy()}
        >
          {busy() ? 'Checking...' : 'Continue'}
        </ThemeButton>
      </div>
    </DialogFrame>
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

// In the club website's look for a club that has one (DialogFrame).
const AuthDialog = () => (
  <Show when={authState.dialogView !== null}>
    <DialogFrame title={authDialogTitle()} onClose={closeAuthDialog}>
      <Switch>
        <Match when={authState.dialogView === 'signIn'}>
          <SignInDialogContent />
        </Match>
        <Match when={authState.dialogView === 'signUp'}>
          <SignUpWizardSection />
        </Match>
      </Switch>
    </DialogFrame>
  </Show>
)

const closeAuthDialog = () => {
  authActions.hideDialog()
  signUpActions.reset()
}

const authDialogTitle = () => {
  if (authState.dialogView === 'signIn') return 'Sign in'
  return signUpState.adminRegisterMode ? 'Register Player' : 'Sign up'
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
        <ThemeButton
          variant="primary"
          plainColor="#2185d0"
          fill={hasSiteLook()}
          onClick={handleSignIn}
          disabled={authState.loading}
        >
          {authState.loading ? 'Signing in...' : 'Sign in'}
        </ThemeButton>
      </div>
      <div style={googleSignInRowStyle}>
        <div style={iconRowStyle}>
          <GoogleSignInIcon />
        </div>
        <GoogleSignInStatus />
      </div>
      <div style={linkContainerStyle}>
        <span {...themed(linkStyle, 'bk-link')} onClick={handleGoToSignUp}>
          Sign up
        </span>
      </div>
    </>
  )
}

// Sign Up Dialog Content

const SignUpWizardSection = () => (
  <>
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
          <ThemeButton variant="primary" onClick={authActions.hideDialog}>
            OK
          </ThemeButton>
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
      <ThemeButton
        variant="secondary"
        plainColor="#e74c3c"
        onClick={authActions.hideDialog}
        disabled={signUpState.loading}
      >
        Cancel
      </ThemeButton>
      <ThemeButton
        variant="primary"
        onClick={signUpActions.runAdminRegister}
        disabled={signUpState.loading}
      >
        {signUpState.loading ? 'Sending...' : 'Sign up'}
      </ThemeButton>
    </div>
  </Show>
)

const NewPlayerSuccessSection = () => (
  <>
    <div style={infoMsgStyle}>
      <Show
        when={modulesActions.on('rating')}
        fallback={<>You're signed up. Welcome!</>}
      >
        Contact {clubConfig.branding.contactName} to get an initial rating
        before you can register for rating-restricted events.
      </Show>
    </div>
    <div style={buttonContainerStyle}>
      <ThemeButton
        variant="primary"
        onClick={signUpActions.dismissNewPlayerSuccess}
      >
        OK
      </ThemeButton>
    </div>
  </>
)

// Styles
const topBarStyle: JSX.CSSProperties = {
  'background-color': clubConfig.branding.topBarColor || '#2185d0',
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

// Shrinks before the account icon does; past that it scrolls within itself
// rather than pushing the page wider than the phone.
const navLeftStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '4px',
  'min-width': 0,
  'overflow-x': 'auto',
  'scrollbar-width': 'none',
}

const navRightStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '4px',
  flex: 'none',
}

const liveScoreButtonStyle: JSX.CSSProperties = {
  flex: 'none',
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
  'white-space': 'nowrap',
  flex: 'none',
}

const languageToggleStyle: JSX.CSSProperties = {
  display: 'inline-flex',
  'align-items': 'center',
  gap: '5px',
  height: '32px',
  'box-sizing': 'border-box',
  flex: 'none',
  padding: '0 10px',
  border: '1px solid rgba(255, 255, 255, 0.55)',
  'border-radius': '16px',
  background: 'none',
  color: '#fff',
  'font-size': '14px',
  'font-weight': 600,
  cursor: 'pointer',
  'white-space': 'nowrap',
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


