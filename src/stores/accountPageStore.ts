import { createStore } from 'solid-js/store'
import { authState, authActions } from './authStore'
import { apiPost } from '../utils/api'

interface AccountProfileData {
  firstName: string
  lastName: string
  email: string
  phone: string
}

interface AccountPageState {
  formData: AccountProfileData
  initialFormData: AccountProfileData
  editing: boolean
  saving: boolean
  saved: boolean
  error: string | null
}

const getInitialState = (): AccountPageState => ({
  formData: { firstName: '', lastName: '', email: '', phone: '' },
  initialFormData: { firstName: '', lastName: '', email: '', phone: '' },
  editing: false,
  saving: false,
  saved: false,
  error: null,
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

  reset: () => setAccountPageState(getInitialState()),
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
