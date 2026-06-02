import { Show, onMount, onCleanup, type JSX } from 'solid-js'
import { useNavigate, useParams } from '@solidjs/router'
import { Header } from '../components/Header'
import Input from '../components/Input'
import Select from '../components/Select'
import DatePicker from '../components/DatePicker'
import PasswordRules from '../components/PasswordRules'
import Button from '../components/Button'
import { parseLocalDate, formatLocalDate } from '../utils/date'
import { accountPageState, accountPageActions } from '../stores/accountPageStore'
import { authState, authActions } from '../stores/authStore'

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
  'margin-top': '20px',
}

const Account = () => {
  const navigate = useNavigate()
  const params = useParams()

  onMount(() => {
    accountPageActions.init(params.playerId)
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
        <h1 style={titleStyle}>
          {accountPageState.targetDisplayName || 'Account'}
        </h1>
        <ProfileSection />
        <Show
          when={!accountPageState.editing && !accountPageState.targetPlayerId}
        >
          <div style={signOutContainerStyle}>
            <Button color="#e74c3c" onClick={handleSignOut}>
              Sign Out
            </Button>
          </div>
        </Show>
      </div>
      <Show when={accountPageState.showChangePasswordDialog}>
        <ChangePasswordDialog />
      </Show>
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

const ProfileActionIcons = () => (
  <Show when={!isAdminOrSuperAdmin() || accountPageState.targetPlayerId}>
    <div style={actionIconsStyle}>
      <Show when={accountPageState.saving}>
        <div style={spinnerStyle} />
      </Show>
      <Show when={!accountPageState.saving}>
        <Show when={!accountPageState.editing}>
          <button
            style={iconButtonStyle}
            onClick={accountPageActions.enterEditMode}
            title="Edit"
          >
            <EditIcon />
          </button>
        </Show>
        <Show when={accountPageState.editing}>
          <button
            style={cancelIconStyle}
            onClick={accountPageActions.exitEditMode}
            title="Cancel"
          >
            <CancelIcon />
          </button>
          <button
            style={saveIconStyle}
            onClick={accountPageActions.save}
            title="Save"
          >
            <SaveIcon />
          </button>
        </Show>
      </Show>
    </div>
  </Show>
)

const ProfileSection = () => (
  <>
    <div style={sectionHeaderStyle}>
      <h3 style={sectionTitleStyle}>Profile</h3>
      <ProfileActionIcons />
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
    <Select
      label="Sex"
      name="sex"
      value={accountPageState.formData.sex}
      onChange={(value) =>
        accountPageActions.setField('sex', value as 'male' | 'female')
      }
      options={[
        { value: 'male', label: 'Male' },
        { value: 'female', label: 'Female' },
      ]}
      disabled={!accountPageState.editing}
    />
    <DatePicker
      label="Birth Date"
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
    <Show
      when={
        !isAdminOrSuperAdmin() &&
        !accountPageState.editing &&
        !accountPageState.targetPlayerId
      }
    >
      <div style={changePasswordButtonContainerStyle}>
        <Button color="#3498db" onClick={accountPageActions.showChangePassword}>
          Change Password
        </Button>
      </div>
    </Show>
  </>
)

const ChangePasswordDialog = () => (
  <div style={overlayStyle}>
    <div style={dialogStyle}>
      <h3 style={dialogTitleStyle}>Change Password</h3>
      <Show when={!authState.user?.pending}>
        <Input
          label="Current Password"
          name="oldPassword"
          type="password"
          value={accountPageState.changePasswordData.oldPassword}
          onChange={(value) =>
            accountPageActions.setChangePasswordField('oldPassword', value)
          }
        />
      </Show>
      <Input
        label="New Password"
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
        label="Confirm Password"
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
      <div style={dialogButtonContainerStyle}>
        <Button
          color="#e74c3c"
          onClick={accountPageActions.hideChangePassword}
        >
          Cancel
        </Button>
        <Button
          color="#27ae60"
          onClick={accountPageActions.changePassword}
          disabled={accountPageState.changingPassword}
        >
          {accountPageState.changingPassword ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  </div>
)

export default Account
