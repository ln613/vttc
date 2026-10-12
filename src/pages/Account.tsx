import { Show, For, onMount, onCleanup, type JSX } from 'solid-js'
import { useNavigate, useParams, useSearchParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import PasswordRules from '../components/PasswordRules'
import ThemeButton from '../components/ThemeButton'
import TopUpDialog from '../components/TopUpDialog'
import CollapsibleSection from '../components/CollapsibleSection'
import MyBookingsList from '../components/MyBookingsList'
import { parseLocalDate, formatLocalDate } from '../utils/date'
import {
  accountPageState,
  accountPageActions,
} from '../stores/accountPageStore'
import { authState, authActions } from '../stores/authStore'
import { creditsState, creditsActions } from '../stores/creditsStore'
import { modulesActions } from '../stores/modulesStore'
import {
  accountSectionsState,
  accountSectionsActions,
} from '../stores/accountSectionsStore'
import { formatCredits } from '../../shared/rules/booking'
import { clubIdOf } from '../../shared/rules/wallet'
import {
  formatBalance,
  formatPoints,
  pointsModel,
  walletT,
} from '../i18n/wallet'
import { langActions } from '../stores/langStore'
import { hasSiteLook, loadSiteFonts } from '../site/siteContent'
import { themed } from '../site/themed'
import './booking.css'

// A club with its own website shows this page in its site's look (heading
// band, card sections, site buttons — booking.css) and in its languages.
const t = langActions.t

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

const actionIconsStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'center',
  gap: '8px',
}

const iconButtonStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: '4px',
  display: 'flex',
  'align-items': 'center',
  'justify-content': 'center',
  color: '#3498db',
}

const cancelIconStyle: JSX.CSSProperties = {
  ...iconButtonStyle,
  color: '#e74c3c',
}

const saveIconStyle: JSX.CSSProperties = {
  ...iconButtonStyle,
  color: '#27ae60',
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

const spinnerStyle: JSX.CSSProperties = {
  display: 'inline-block',
  width: '20px',
  height: '20px',
  border: '2px solid #ddd',
  'border-top-color': '#3498db',
  'border-radius': '50%',
  animation: 'spin 0.8s linear infinite',
}

const dialogStyle: JSX.CSSProperties = {
  'background-color': '#fff',
  padding: '24px',
  'border-radius': '12px',
  width: '90%',
  'max-width': '400px',
  'box-shadow': '0 4px 20px rgba(0, 0, 0, 0.15)',
}

const dialogTitleStyle: JSX.CSSProperties = {
  'font-size': '1.2rem',
  'font-weight': 700,
  'margin-top': '0',
  'margin-bottom': '16px',
  color: '#333',
}

const dialogButtonContainerStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '12px',
  'margin-top': '20px',
  'justify-content': 'flex-end',
}

const changePasswordButtonContainerStyle: JSX.CSSProperties = {
  'margin-top': '4px',
}

const passwordLinkStyle: JSX.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: '#2185d0',
  'font-size': '15px',
  'text-decoration': 'underline',
  cursor: 'pointer',
}

// Rating row mirrors the sign-up dialog's verification-code field:
// bare input + attached button sharing borders, so they read as a
// single control. Label sits above like all other Input components.
const ratingFieldStyle: JSX.CSSProperties = {
  'margin-bottom': '16px',
}

const ratingLabelStyle: JSX.CSSProperties = {
  display: 'block',
  'font-weight': 700,
  'font-size': '14px',
  'margin-bottom': '8px',
  color: '#333',
  'text-align': 'left',
}

const ratingRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'stretch',
}

const ratingInputBoxStyle = (disabled: boolean): JSX.CSSProperties => ({
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

const ratingHistoryButtonStyle: JSX.CSSProperties = {
  padding: '0 20px',
  'font-size': '14px',
  'font-weight': 600,
  border: '1px solid #2185d0',
  'border-radius': '0 8px 8px 0',
  'background-color': '#2185d0',
  color: '#fff',
  cursor: 'pointer',
  'white-space': 'nowrap',
}

const Account = () => {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()

  onMount(() => {
    loadSiteFonts()
    accountPageActions.init(params.playerId)
    accountSectionsActions.init(searchParams.open)
    void creditsActions.fetchBalance()
  })

  onCleanup(() => {
    accountPageActions.reset()
    accountSectionsActions.reset()
  })

  const handleSignOut = () => {
    authActions.signOut()
    navigate('/')
  }

  return (
    <div {...themed(containerStyle, 'bk bk-site')}>
      <Header />
      <SavingOverlay />
      <SavedOverlay />
      <Show when={hasSiteLook()}>
        <header class="bk-head">
          <div class="bk-head-inner">
            <p class="bk-kicker">{t('account.kicker')}</p>
            <h1 class="bk-title">{accountPageActions.getTitle()}</h1>
          </div>
        </header>
      </Show>
      <div {...themed(contentStyle, 'bk-wrap')}>
        <Show when={!hasSiteLook()}>
          <h1 style={titleStyle}>{accountPageActions.getTitle()}</h1>
        </Show>
        <div {...themed(sectionsStyle, 'bk-sections')}>
          <ProfileSection />
          <CreditsSection />
          <MyBookingsSection />
        </div>
        <Show
          when={!accountPageState.editing && !accountPageState.targetPlayerId}
        >
          <div style={signOutContainerStyle}>
            <ThemeButton variant="danger" onClick={handleSignOut}>
              {t('account.signOut')}
            </ThemeButton>
          </div>
        </Show>
      </div>
      <Show when={accountPageState.showChangePasswordDialog}>
        <ChangePasswordDialog />
      </Show>
      <Show when={accountPageState.showRatingHistoryDialog}>
        <RatingHistoryDialog />
      </Show>
      <TopUpDialog />
      <SpinnerKeyframes />
    </div>
  )
}

const SpinnerKeyframes = () => (
  <style>{`
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `}</style>
)

const SavingOverlay = () => (
  <Show when={accountPageState.saving}>
    <div style={overlayStyle}>
      <div style={overlayMessageStyle}>{t('common.saving')}</div>
    </div>
  </Show>
)

const SavedOverlay = () => (
  <Show when={accountPageState.saved}>
    <div style={overlayStyle}>
      <div style={savedMessageStyle}>{t('account.saved')}</div>
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

const CancelIcon = () => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const SaveIcon = () => (
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
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const isAdminOrSuperAdmin = () => authState.isAdmin || authState.isSuperAdmin

// Anyone can edit their own profile if they have one — a player who is also
// an admin included. The shared admin logins have no profile of their own;
// they edit other players' (targetPlayerId).
const canEditProfile = () =>
  authActions.hasPlayerRecord() || !!accountPageState.targetPlayerId

const ProfileActionIcons = () => (
  <Show when={canEditProfile()}>
    <div style={actionIconsStyle}>
      <Show when={accountPageState.saving}>
        <div style={spinnerStyle} />
      </Show>
      <Show when={!accountPageState.saving}>
        <Show when={!accountPageState.editing}>
          <button
            class="vttc-tap"
            style={iconButtonStyle}
            onClick={accountPageActions.enterEditMode}
            title={t('common.edit')}
          >
            <EditIcon />
          </button>
        </Show>
        <Show when={accountPageState.editing}>
          <button
            class="vttc-tap"
            style={cancelIconStyle}
            onClick={() => void accountPageActions.exitEditMode()}
            title={t('common.cancel')}
          >
            <CancelIcon />
          </button>
          <button
            style={saveIconStyle}
            onClick={accountPageActions.save}
            title={t('common.save')}
          >
            <SaveIcon />
          </button>
        </Show>
      </Show>
    </div>
  </Show>
)

const ProfileSection = () => (
  <CollapsibleSection
    title={t('account.profile')}
    open={accountSectionsState.profile}
    onToggle={() => accountSectionsActions.toggle('profile')}
    actions={
      <Show when={accountSectionsState.profile}>
        <ProfileActionIcons />
      </Show>
    }
  >
    <Input
      label={t('account.firstName')}
      name="firstName"
      value={accountPageState.formData.firstName}
      onChange={(value) => accountPageActions.setField('firstName', value)}
      disabled={!accountPageState.editing}
    />
    <Input
      label={t('account.lastName')}
      name="lastName"
      value={accountPageState.formData.lastName}
      onChange={(value) => accountPageActions.setField('lastName', value)}
      disabled={!accountPageState.editing}
    />
    <Select
      label={t('account.sex')}
      name="sex"
      value={accountPageState.formData.sex}
      onChange={(value) =>
        accountPageActions.setField('sex', value as 'male' | 'female')
      }
      options={[
        { value: 'male', label: t('account.male') },
        { value: 'female', label: t('account.female') },
      ]}
      disabled={!accountPageState.editing}
    />
    <DatePicker
      label={t('account.birthDate')}
      value={
        accountPageState.formData.dateOfBirth
          ? parseLocalDate(accountPageState.formData.dateOfBirth)
          : null
      }
      onChange={(date) =>
        accountPageActions.setField(
          'dateOfBirth',
          date ? formatLocalDate(date) : '',
        )
      }
      minYear={new Date().getFullYear() - 100}
      maxYear={new Date().getFullYear()}
      disabled={!accountPageState.editing}
    />
    <Input
      label={t('account.email')}
      name="email"
      type="email"
      value={accountPageState.formData.email}
      onChange={(value) => accountPageActions.setField('email', value)}
      disabled={!accountPageState.editing}
    />
    <Input
      label={t('account.phone')}
      name="phone"
      type="tel"
      value={accountPageState.formData.phone}
      onChange={(value) => accountPageActions.setField('phone', value)}
      disabled={!accountPageState.editing}
    />
    <Show when={isAdminOrSuperAdmin() && modulesActions.on('rating')}>
      <div style={ratingFieldStyle}>
        <label for="rating" style={ratingLabelStyle}>
          {t('account.rating')}
        </label>
        <div style={ratingRowStyle}>
          <input
            id="rating"
            name="rating"
            type="text"
            value={accountPageState.formData.rating}
            onInput={(e) =>
              accountPageActions.setField('rating', e.currentTarget.value)
            }
            disabled={!accountPageState.editing}
            style={ratingInputBoxStyle(!accountPageState.editing)}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              void accountPageActions.showRatingHistory()
            }}
            style={ratingHistoryButtonStyle}
          >
            {t('account.history')}
          </button>
        </div>
      </div>
    </Show>
    <Show when={accountPageState.error}>
      <div style={errorMessageStyle}>{accountPageState.error}</div>
    </Show>
    <Show
      when={
        authActions.hasPlayerRecord() &&
        !accountPageState.editing &&
        !accountPageState.targetPlayerId
      }
    >
      <div style={changePasswordButtonContainerStyle}>
        <button
          type="button"
          {...themed(passwordLinkStyle, 'bk-link')}
          onClick={accountPageActions.showChangePassword}
        >
          {accountPageActions.isSettingPassword()
            ? t('account.setPassword')
            : t('account.changePassword')}
        </button>
      </div>
    </Show>
  </CollapsibleSection>
)

// Court-booking credits and bookings, on the player's own account at a club
// that takes bookings — not the admin or tablet logins, which have no player
// record, and not someone else's account viewed by an admin.
const isOwnPlayerAccount = () =>
  creditsActions.isPlayer() && !accountPageState.targetPlayerId

// Each follows its module (specs/rules/modules.md).
const showCredits = () => isOwnPlayerAccount() && creditsActions.isCreditOn()

const showMyBookings = () =>
  isOwnPlayerAccount() && modulesActions.on('myBooking')

// The balance shows in the header, so it can be read with the section closed.
const creditsSummary = () =>
  creditsState.balance !== null ? formatBalance(creditsState.balance) : ''

// Credits: "3,000 credits". Points model: the dollar balance (its reward
// points are shown under it) — specs/rules/wallet.md.
const BalanceAmount = () => (
  <Show
    when={pointsModel}
    fallback={
      <>
        <strong style={hasSiteLook() ? undefined : creditsAmountStyle}>
          {formatCredits(creditsState.balance ?? 0)}
        </strong>
        <span style={creditsMutedStyle}>{t('account.creditsUnit')}</span>
      </>
    }
  >
    <strong style={hasSiteLook() ? undefined : creditsAmountStyle}>
      {formatBalance(creditsState.balance ?? 0)}
    </strong>
  </Show>
)

const CreditsSection = () => (
  <Show when={showCredits()}>
    <CollapsibleSection
      title={walletT('title')}
      open={accountSectionsState.credits}
      onToggle={() => accountSectionsActions.toggle('credits')}
      summary={creditsSummary()}
    >
      <div {...themed(creditsBalanceStyle, 'bk-balance-big')}>
        <Show
          when={creditsState.balance !== null}
          fallback={
            <span style={creditsMutedStyle}>
              {creditsState.error || t('common.loading')}
            </span>
          }
        >
          <BalanceAmount />
        </Show>
      </div>
      <ThemeButton variant="primary" onClick={creditsActions.openTopUp}>
        {t('account.topUp')}
      </ThemeButton>
      <Show when={pointsModel}>
        <RewardPoints />
      </Show>
    </CollapsibleSection>
  </Show>
)

// Points model: the member's reward points, the club id the desk asks for
// when they redeem, and where to see the gifts and what they've redeemed.
const RewardPoints = () => {
  const navigate = useNavigate()
  return (
    <div style={rewardPointsStyle}>
      <div class="rw-points">
        <span>
          {t('account.points')}:{' '}
          <strong>{formatPoints(creditsState.points ?? 0)}</strong>
        </span>
        <span class="rw-meta">
          {t('account.clubId')}: {clubIdOf(authState.user?._id)}
        </span>
      </div>
      <div {...themed(rewardLinksStyle, 'bk-links')}>
        <button
          type="button"
          class="bk-link"
          onClick={() => navigate('/rewards')}
        >
          {t('account.rewards')}
        </button>
        <button
          type="button"
          class="bk-link"
          onClick={() => navigate('/redemptions')}
        >
          {t('account.redemptionHistory')}
        </button>
      </div>
    </div>
  )
}

const rewardPointsStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '10px',
  'margin-top': '18px',
}

const rewardLinksStyle: JSX.CSSProperties = {
  display: 'flex',
  gap: '16px',
  'flex-wrap': 'wrap',
}

const MyBookingsSection = () => (
  <Show when={showMyBookings()}>
    <CollapsibleSection
      title={t('account.myBookings')}
      open={accountSectionsState.myBookings}
      onToggle={() => accountSectionsActions.toggle('myBookings')}
    >
      <MyBookingsList />
    </CollapsibleSection>
  </Show>
)

const ChangePasswordDialog = () => (
  <div {...themed(overlayStyle, 'bk-overlay')}>
    <div {...themed(dialogStyle, 'bk-dialog bk-dialog-padded')}>
      <h3 {...themed(dialogTitleStyle, 'bk-section-title')}>
        {accountPageActions.isSettingPassword()
          ? t('account.setPassword')
          : t('account.changePassword')}
      </h3>
      <Show
        when={
          !authState.user?.pending && !accountPageActions.isSettingPassword()
        }
      >
        <Input
          label={t('account.currentPassword')}
          name="oldPassword"
          type="password"
          value={accountPageState.changePasswordData.oldPassword}
          onChange={(value) =>
            accountPageActions.setChangePasswordField('oldPassword', value)
          }
        />
      </Show>
      <Input
        label={t('account.newPassword')}
        name="newPassword"
        type="password"
        value={accountPageState.changePasswordData.newPassword}
        onChange={(value) =>
          accountPageActions.setChangePasswordField('newPassword', value)
        }
      />
      <PasswordRules
        password={accountPageState.changePasswordData.newPassword}
      />
      <Input
        label={t('account.confirmPassword')}
        name="confirmPassword"
        type="password"
        value={accountPageState.changePasswordData.confirmPassword}
        onChange={(value) =>
          accountPageActions.setChangePasswordField('confirmPassword', value)
        }
      />
      <Show when={accountPageState.changePasswordError}>
        <div style={errorMessageStyle}>
          {accountPageState.changePasswordError}
        </div>
      </Show>
      <div {...themed(dialogButtonContainerStyle, 'bk-actions')}>
        <ThemeButton
          variant="secondary"
          plainColor="#e74c3c"
          fill={hasSiteLook()}
          onClick={accountPageActions.hideChangePassword}
        >
          {t('common.cancel')}
        </ThemeButton>
        <ThemeButton
          variant="primary"
          fill={hasSiteLook()}
          onClick={accountPageActions.changePassword}
          disabled={accountPageState.changingPassword}
        >
          {accountPageState.changingPassword
            ? t('common.saving')
            : t('common.save')}
        </ThemeButton>
      </div>
    </div>
  </div>
)

const RatingHistoryDialog = () => (
  <div
    {...themed(overlayStyle, 'bk-overlay')}
    onClick={(e) => {
      e.stopPropagation()
      e.preventDefault()
      accountPageActions.hideRatingHistory()
    }}
  >
    <div
      {...themed(dialogStyle, 'bk-dialog bk-dialog-padded')}
      onClick={(e) => e.stopPropagation()}
    >
      <h3 {...themed(dialogTitleStyle, 'bk-section-title')}>
        {t('account.ratingHistory')}
      </h3>
      <Show
        when={!accountPageState.loadingRatingHistory}
        fallback={
          <div style={ratingHistoryEmptyStyle}>{t('common.loading')}</div>
        }
      >
        <Show
          when={accountPageState.ratingHistory.length > 0}
          fallback={
            <div style={ratingHistoryEmptyStyle}>
              {t('account.noRatingChanges')}
            </div>
          }
        >
          <div style={ratingHistoryListStyle}>
            <For each={accountPageState.ratingHistory}>
              {(entry: {
                rating: number
                previousRating: number | null
                changedAt: string
              }) => (
                <div style={ratingHistoryRowStyle}>
                  <span>{formatRatingChangedAt(entry.changedAt)}</span>
                  <span style={ratingHistoryRatingStyle}>
                    {entry.previousRating != null
                      ? `${entry.previousRating} → ${entry.rating}`
                      : `${entry.rating}`}
                  </span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
      <div {...themed(dialogButtonContainerStyle, 'bk-actions is-center')}>
        <ThemeButton
          variant="accent"
          onClick={accountPageActions.hideRatingHistory}
        >
          {t('common.close')}
        </ThemeButton>
      </div>
    </div>
  </div>
)

const formatRatingChangedAt = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString(langActions.locale())
}

const sectionsStyle: JSX.CSSProperties = {
  'border-top': '1px solid #e5e7eb',
  'text-align': 'left',
}

const creditsBalanceStyle: JSX.CSSProperties = {
  display: 'flex',
  'align-items': 'baseline',
  gap: '8px',
  margin: '0 0 16px',
}

const creditsAmountStyle: JSX.CSSProperties = {
  'font-size': '28px',
  color: '#333',
}

const creditsMutedStyle: JSX.CSSProperties = {
  'font-size': '14px',
  color: '#666',
}

const ratingHistoryListStyle: JSX.CSSProperties = {
  display: 'flex',
  'flex-direction': 'column',
  gap: '8px',
  'max-height': '50vh',
  'overflow-y': 'auto',
  'margin-top': '12px',
}

const ratingHistoryRowStyle: JSX.CSSProperties = {
  display: 'flex',
  'justify-content': 'space-between',
  'align-items': 'center',
  gap: '12px',
  padding: '8px 12px',
  'background-color': '#f5f7fa',
  'border-radius': '6px',
  'font-size': '13px',
  color: '#333',
}

const ratingHistoryRatingStyle: JSX.CSSProperties = {
  'font-weight': 700,
  color: '#2c3e50',
}

const ratingHistoryEmptyStyle: JSX.CSSProperties = {
  padding: '24px',
  color: '#888',
  'text-align': 'center',
}

export default Account
