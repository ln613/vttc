import { createStore } from 'solid-js/store'
import { authState, authActions } from './authStore'
import { apiGet, apiPost } from '../utils/api'
import { normalizeSex, toDbSex } from '../../shared/rules/sex'
import { playerState, playerActions } from './playerStore'
import { customConfirm } from './confirmDialogStore'
import type { Player } from '../../shared/types/Player'

interface AccountProfileData {
  firstName: string
  lastName: string
  sex: 'male' | 'female' | ''
  dateOfBirth: string
  email: string
  phone: string
  rating: string
}

interface ChangePasswordData {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}

interface RatingHistoryEntry {
  rating: number
  previousRating: number | null
  changedAt: string
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
  targetPlayerId: string | null
  targetDisplayName: string
  showRatingHistoryDialog: boolean
  ratingHistory: RatingHistoryEntry[]
  loadingRatingHistory: boolean
}

const getInitialChangePasswordData = (): ChangePasswordData => ({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const getInitialState = (): AccountPageState => ({
  formData: {
    firstName: '',
    lastName: '',
    sex: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    rating: '',
  },
  initialFormData: {
    firstName: '',
    lastName: '',
    sex: '',
    dateOfBirth: '',
    email: '',
    phone: '',
    rating: '',
  },
  editing: false,
  saving: false,
  saved: false,
  error: null,
  showChangePasswordDialog: false,
  changePasswordData: getInitialChangePasswordData(),
  changingPassword: false,
  changePasswordError: null,
  targetPlayerId: null,
  targetDisplayName: '',
  showRatingHistoryDialog: false,
  ratingHistory: [],
  loadingRatingHistory: false,
})

const [accountPageState, setAccountPageState] =
  createStore<AccountPageState>(getInitialState())

export { accountPageState }

export const accountPageActions = {
  init: async (playerId?: string) => {
    if (playerId) {
      if (!playerState.data) await playerActions.fetchPlayers()
      const player = playerState.data?.find(
        (p) => p._id.toString() === playerId,
      )
      const profile = buildProfileFromPlayer(player)
      setAccountPageState({
        formData: { ...profile },
        initialFormData: { ...profile },
        editing: false,
        saving: false,
        saved: false,
        error: null,
        targetPlayerId: playerId,
        targetDisplayName: player
          ? `${player.firstName} ${player.lastName}`
          : '',
      })
      return
    }
    const profile = buildProfileFromAuth()
    setAccountPageState({
      formData: { ...profile },
      initialFormData: { ...profile },
      editing: false,
      saving: false,
      saved: false,
      error: null,
      targetPlayerId: null,
      targetDisplayName: '',
    })
  },

  // Title shows "{name} ({rating})" for the targeted player (or the
  // signed-in user when there is no target). Falls back gracefully when
  // either piece is missing.
  getTitle: (): string => {
    const data = accountPageState.initialFormData
    const name = [data.firstName, data.lastName].filter(Boolean).join(' ')
    const rating = data.rating
    if (name && rating !== '') return `${name} (${rating})`
    return name || 'Account'
  },

  enterEditMode: () => {
    setAccountPageState({ editing: true, error: null, saved: false })
  },

  exitEditMode: async () => {
    if (!hasFormChanged()) {
      setAccountPageState({
        formData: { ...accountPageState.initialFormData },
        editing: false,
        error: null,
      })
      return
    }
    if (!(await customConfirm('Discard unsaved changes?', { confirmColor: '#e74c3c' }))) return
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
      // First pass: server returns the list of future events the player
      // would no longer qualify for; nothing is persisted yet.
      const firstResult = await apiPost<{
        success: boolean
        needsConfirm?: boolean
        affectedEvents?: AffectedEvent[]
      }>('updateProfile', buildSavePayload(formData))

      let payload = buildSavePayload(formData)
      if (firstResult.needsConfirm && (firstResult.affectedEvents || []).length > 0) {
        const confirmed = await askConfirmAffected(firstResult.affectedEvents!)
        if (!confirmed) {
          // Admin chose to keep player in those events — abort the
          // save entirely, per spec.
          setAccountPageState({ saving: false })
          return
        }
        // Second pass: include confirmRemove flag so the server removes
        // the player from those events, then saves the profile and
        // propagates the new rating to remaining future events.
        payload = { ...payload, confirmRemove: true }
        await apiPost('updateProfile', payload)
      }

      // Only mirror updates back to the signed-in user when editing self.
      if (!accountPageState.targetPlayerId) {
        authActions.updateUser({
          firstName: formData.firstName,
          lastName: formData.lastName,
          sex: toDbSex(formData.sex),
          dateOfBirth: formData.dateOfBirth || undefined,
          email: formData.email,
          phone: formData.phone,
        })
      } else if (playerState.data) {
        // Refresh the players list so the Players page reflects edits.
        playerActions.fetchPlayers()
      }
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

  // Show the rating-change history dialog and load entries lazily.
  showRatingHistory: async () => {
    const playerId = accountPageState.targetPlayerId ?? authState.user?._id
    if (!playerId) return
    setAccountPageState({
      showRatingHistoryDialog: true,
      loadingRatingHistory: true,
      ratingHistory: [],
    })
    try {
      const history = await apiGet<RatingHistoryEntry[]>(
        'playerRatingHistory',
        { playerId },
      )
      setAccountPageState({
        ratingHistory: history,
        loadingRatingHistory: false,
      })
    } catch {
      setAccountPageState({
        ratingHistory: [],
        loadingRatingHistory: false,
      })
    }
  },

  hideRatingHistory: () => {
    setAccountPageState({
      showRatingHistoryDialog: false,
      ratingHistory: [],
      loadingRatingHistory: false,
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
      if (authState.user?.pending) {
        authActions.updateUser({ pending: false })
      }
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
    formData.sex !== initialFormData.sex ||
    formData.dateOfBirth !== initialFormData.dateOfBirth ||
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

interface AffectedEvent {
  _id: string
  eventName: string
  date: string
  reason: string
}

const askConfirmAffected = (events: AffectedEvent[]): Promise<boolean> => {
  const targetName = accountPageState.initialFormData.firstName
    ? `${accountPageState.initialFormData.firstName} ${accountPageState.initialFormData.lastName}`
    : 'This player'
  const lines = events
    .map((e) => `• ${e.eventName} (${e.date}) — ${e.reason}`)
    .join('\n')
  const message = `${targetName} would no longer qualify for these future events:\n\n${lines}\n\nRemove ${targetName} from these events and save? Choosing "Keep" will cancel the save.`
  return customConfirm(message, {
    confirmLabel: 'Remove & Save',
    cancelLabel: 'Keep',
    confirmColor: '#e74c3c',
  })
}

const buildProfileFromAuth = (): AccountProfileData => ({
  firstName: authState.user?.firstName ?? '',
  lastName: authState.user?.lastName ?? '',
  sex: normalizeSex(authState.user?.sex),
  dateOfBirth: (authState.user?.dateOfBirth ?? '').slice(0, 10),
  email: authState.user?.email ?? '',
  phone: authState.user?.phone ?? '',
  rating: authState.user?.rating != null ? String(authState.user.rating) : '',
})

const buildProfileFromPlayer = (
  player: Player | undefined,
): AccountProfileData => ({
  firstName: player?.firstName ?? '',
  lastName: player?.lastName ?? '',
  sex: normalizeSex(player?.sex),
  dateOfBirth: (player?.dateOfBirth ?? '').slice(0, 10),
  email: player?.email ?? '',
  phone: player?.phone ?? '',
  rating: player?.rating != null ? String(player.rating) : '',
})

const buildSavePayload = (formData: AccountProfileData) => ({
  _id: accountPageState.targetPlayerId ?? authState.user?._id,
  firstName: formData.firstName,
  lastName: formData.lastName,
  sex: toDbSex(formData.sex),
  dateOfBirth: formData.dateOfBirth || undefined,
  email: formData.email,
  phone: formData.phone,
  // Rating is only mutable by admins (UI gates the input); the server
  // is the source of truth and will ignore it otherwise.
  rating: formData.rating === '' ? undefined : parseInt(formData.rating, 10),
})

const validateProfile = (data: AccountProfileData): string | null => {
  const errors: string[] = []

  if (data.email && !isValidEmail(data.email)) {
    errors.push('Invalid email address')
  }

  if (data.phone && !isValidNorthAmericanPhone(data.phone)) {
    errors.push('Invalid Canadian/US phone number')
  }

  if (data.rating !== '' && !isValidRating(data.rating)) {
    errors.push('Rating must be a non-negative integer')
  }

  return errors.length > 0 ? errors.join('\n') : null
}

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

// Canadian and US phones share the same NANP format: 10 digits with
// area code starting at 2-9 and exchange starting at 2-9, optionally
// prefixed with country code 1.
const isValidNorthAmericanPhone = (phone: string): boolean => {
  if (/[^\d\s\-().+]/.test(phone)) return false
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  return false
}

const isValidRating = (rating: string): boolean => {
  if (!/^\d+$/.test(rating)) return false
  const n = parseInt(rating, 10)
  return Number.isInteger(n) && n >= 0
}
