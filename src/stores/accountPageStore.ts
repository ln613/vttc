import { createStore } from 'solid-js/store'
import { authState, authActions } from './authStore'
import { apiPost } from '../utils/api'

interface AccountProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface ChangePasswordData {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

interface AccountPageState {
  formData: AccountProfileData
  initialFormData: AccountProfileData
  editing: boolean
  saving: boolean
  saved: boolean
  error: string | null
  showChangePasswordDialog: boolean
  changePasswordData: ChangePasswordData
  changingPassword: boolean
  changePasswordError: string | null
}

const getInitialChangePasswordData = (): ChangePasswordData => ({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const getInitialState = (): AccountPageState => ({
  formData: { firstName: '', lastName: '', email: '', phone: '' },
  initialFormData: { firstName: '', lastName: '', email: '', phone: '' },
  editing: false,
  saving: false,
  saved: false,
  error: null,
  showChangePasswordDialog: false,
  changePasswordData: getInitialChangePasswordData(),
  changingPassword: false,
  changePasswordError: null,
})

const [accountPageState, setAccountPageState] =
  createStore<AccountPageState>(getInitialState())

export { accountPageState }

export const accountPageActions = {
  init: () => {
    const profile = buildProfileFromAuth()
    setAccountPageState({
      formData: { ...profile },
      initialFormData: { ...profile },
      editing: false,
      saving: false,
      saved: false,
      error: null,
    })
  },

  enterEditMode: () => {
    setAccountPageState({ editing: true, error: null, saved: false })
  },

  exitEditMode: () => {
    if (!hasFormChanged()) {
      setAccountPageState({
        formData: { ...accountPageState.initialFormData },
        editing: false,
        error: null,
      })
      return
    }
    if (!confirm('Discard unsaved changes?')) return
    setAccountPageState({
      formData: { ...accountPageState.initialFormData },
      editing: false,
      error: null,
    })
  },

  setField: <K extends keyof AccountProfileData>(
    field: K,
    value: AccountProfileData[K],
  ) => {
    setAccountPageState('formData', field, value)
  },

  save: async () => {
    const { formData } = accountPageState

    const validationError = validateProfile(formData)
    if (validationError) {
      setAccountPageState({ error: validationError })
      return
    }

    setAccountPageState({ saving: true, error: null })

    try {
      await apiPost('updateProfile', buildSavePayload(formData))
      authActions.updateUser({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
      })
      setAccountPageState({
        initialFormData: { ...formData },
        saving: false,
        saved: true,
        editing: false,
      })
      setTimeout(() => setAccountPageState({ saved: false }), 1500)
    } catch (err) {
      setAccountPageState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save profile',
      })
    }
  },

  showChangePassword: () => {
    setAccountPageState({
      showChangePasswordDialog: true,
      changePasswordData: getInitialChangePasswordData(),
      changePasswordError: null,
    })
  },

  hideChangePassword: () => {
    setAccountPageState({
      showChangePasswordDialog: false,
      changePasswordData: getInitialChangePasswordData(),
      changePasswordError: null,
    })
  },

  setChangePasswordField: <K extends keyof ChangePasswordData>(
    field: K,
    value: ChangePasswordData[K],
  ) => {
    setAccountPageState('changePasswordData', field, value)
  },

  changePassword: async () => {
    const { changePasswordData } = accountPageState
    const validationError = validateChangePasswordInput(changePasswordData)
    if (validationError) {
      setAccountPageState({ changePasswordError: validationError })
      return
    }

    setAccountPageState({ changingPassword: true, changePasswordError: null })
    try {
      await apiPost('changePassword', {
        _id: authState.user?._id,
        oldPassword: changePasswordData.oldPassword || undefined,
        newPassword: changePasswordData.newPassword,
        confirmPassword: changePasswordData.confirmPassword,
      })
      setAccountPageState({
        changingPassword: false,
        showChangePasswordDialog: false,
        changePasswordData: getInitialChangePasswordData(),
      })
    } catch (err) {
      setAccountPageState({
        changingPassword: false,
        changePasswordError:
          err instanceof Error ? err.message : 'Failed to change password',
      })
    }
  },

  reset: () => setAccountPageState(getInitialState()),
}

const hasFormChanged = (): boolean => {
  const { formData, initialFormData } = accountPageState
  return (
    formData.firstName !== initialFormData.firstName ||
    formData.lastName !== initialFormData.lastName ||
    formData.email !== initialFormData.email ||
    formData.phone !== initialFormData.phone
  )
}

const isValidPassword = (password: string): boolean =>
  password.length >= 8 &&
  /[0-9]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password)

const getPasswordErrors = (password: string): string[] => {
  const errors: string[] = []
  if (password.length < 8) errors.push('Password must be at least 8 characters')
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least 1 number')
  if (!/[A-Z]/.test(password))
    errors.push('Password must contain at least 1 uppercase letter')
  if (!/[a-z]/.test(password))
    errors.push('Password must contain at least 1 lowercase letter')
  return errors
}

const validateChangePasswordInput = (
  data: ChangePasswordData,
): string | null => {
  const errors: string[] = []
  if (!data.newPassword) {
    errors.push('New password is required')
  } else if (!isValidPassword(data.newPassword)) {
    errors.push(...getPasswordErrors(data.newPassword))
  }
  if (data.newPassword !== data.confirmPassword)
    errors.push('Passwords do not match')
  return errors.length > 0 ? errors.join('\n') : null
}

const buildProfileFromAuth = (): AccountProfileData => ({
  firstName: authState.user?.firstName ?? '',
  lastName: authState.user?.lastName ?? '',
  email: authState.user?.email ?? '',
  phone: authState.user?.phone ?? '',
})

const buildSavePayload = (formData: AccountProfileData) => ({
  _id: authState.user?._id,
  firstName: formData.firstName,
  lastName: formData.lastName,
  email: formData.email,
  phone: formData.phone,
})

const validateProfile = (data: AccountProfileData): string | null => {
  const errors: string[] = []

  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email address')
  }

  if (data.phone && !isValidCanadianPhone(data.phone)) {
    errors.push('Invalid Canadian phone number')
  }

  return errors.length > 0 ? errors.join('\n') : null
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const isValidCanadianPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  return false
}
