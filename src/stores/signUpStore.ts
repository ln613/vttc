import { createStore } from 'solid-js/store'
import type { Player } from '../../shared/types/Player'
import { apiPost } from '../utils/api'
import { playerActions, playerState } from './playerStore'
import { authActions } from './authStore'
import { normalizeSex, toDbSex, type FormSex } from '../../shared/rules/sex'

interface SignUpState {
  existingPlayer: boolean
  selectedPlayerId: string
  firstName: string
  lastName: string
  sex: FormSex
  email: string
  verificationCode: string
  emailVerified: boolean
  verificationSending: boolean
  verificationError: string | null
  verificationCountdown: number
  phone: string
  dateOfBirth: string
  password: string
  loading: boolean
  error: string | null
  message: string | null
  showMatchDialog: boolean
  matchedPlayers: Player[]
  selectedMatchedPlayerId: string
  showNewPlayerSuccess: boolean
}

const getInitialState = (): SignUpState => ({
  existingPlayer: false,
  selectedPlayerId: '',
  firstName: '',
  lastName: '',
  sex: '',
  email: '',
  verificationCode: '',
  emailVerified: false,
  verificationSending: false,
  verificationError: null,
  verificationCountdown: 0,
  phone: '',
  dateOfBirth: '',
  password: '',
  loading: false,
  error: null,
  message: null,
  showMatchDialog: false,
  matchedPlayers: [],
  selectedMatchedPlayerId: '',
  showNewPlayerSuccess: false,
})

const [signUpState, setSignUpState] = createStore<SignUpState>(getInitialState())

export { signUpState }

// Validation utils

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

const isValidPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  if (digits.length === 11 && digits.startsWith('1'))
    return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  return false
}

const isValidPassword = (password: string): boolean =>
  password.length >= 8 &&
  /[0-9]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password)

const passwordHasMinLength = (password: string): boolean =>
  password.length >= 8

const passwordHasNumber = (password: string): boolean =>
  /[0-9]/.test(password)

const passwordHasUppercase = (password: string): boolean =>
  /[A-Z]/.test(password)

const passwordHasLowercase = (password: string): boolean =>
  /[a-z]/.test(password)

// Derived state

const selectedPlayer = (): Player | null => {
  if (!signUpState.selectedPlayerId || !playerState.data) return null
  return (
    playerState.data.find(
      (p) => p._id.toString() === signUpState.selectedPlayerId,
    ) ?? null
  )
}

const playerAlreadySignedUp = (): boolean => {
  const player = selectedPlayer()
  return !!player?.hasAccount
}

const isEmailDisabled = (): boolean => signUpState.emailVerified

const isVerificationDisabled = (): boolean =>
  !signUpState.email || !isValidEmail(signUpState.email)

const isSignUpEnabled = (): boolean =>
  signUpState.firstName.trim() !== '' &&
  signUpState.lastName.trim() !== '' &&
  signUpState.sex !== '' &&
  isValidEmail(signUpState.email) &&
  (signUpState.phone === '' || isValidPhone(signUpState.phone)) &&
  isValidPassword(signUpState.password)

const toTitleCase = (s: string): string =>
  s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

const findNameMatches = (firstName: string, lastName: string): Player[] => {
  if (!playerState.data) return []
  const fn = firstName.trim().toLowerCase()
  const ln = lastName.trim().toLowerCase()
  if (!fn || !ln) return []
  return playerState.data.filter(
    (p) =>
      (p.firstName ?? '').trim().toLowerCase() === fn &&
      (p.lastName ?? '').trim().toLowerCase() === ln,
  )
}

const sortByName = (a: Player, b: Player): number => {
  const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
  const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
  return nameA.localeCompare(nameB)
}

const playerOptions = (): { value: string; label: string }[] => {
  if (!playerState.data) return []
  return [...playerState.data].sort(sortByName).map((p) => ({
    value: p._id.toString(),
    label: `${p.firstName} ${p.lastName} (${p.rating})`,
  }))
}

// Actions

let countdownTimer: ReturnType<typeof setInterval> | null = null

const clearCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const startCountdown = () => {
  setSignUpState('verificationCountdown', 60)
  clearCountdownTimer()
  countdownTimer = setInterval(() => {
    const current = signUpState.verificationCountdown
    if (current <= 1) {
      setSignUpState('verificationCountdown', 0)
      clearCountdownTimer()
    } else {
      setSignUpState('verificationCountdown', current - 1)
    }
  }, 1000)
}

const setExistingPlayer = (value: boolean) => {
  setSignUpState({
    existingPlayer: value,
    selectedPlayerId: '',
    firstName: '',
    lastName: '',
    email: '',
    emailVerified: false,
    verificationCode: '',
    verificationError: null,
    message: null,
    error: null,
  })
  if (value && !playerState.data) {
    playerActions.fetchPlayers()
  }
}

const selectPlayer = (playerId: string) => {
  const player = playerState.data?.find(
    (p) => p._id.toString() === playerId,
  )
  setSignUpState({
    selectedPlayerId: playerId,
    firstName: player?.firstName ?? '',
    lastName: player?.lastName ?? '',
    sex: normalizeSex(player?.sex),
    email: player?.email ?? '',
    emailVerified: false,
    verificationCode: '',
    verificationError: null,
    message: null,
    error: null,
  })
}

const setFirstName = (value: string) => {
  setSignUpState('firstName', value)
}

const setLastName = (value: string) => {
  setSignUpState('lastName', value)
}

const setSex = (value: FormSex) => {
  setSignUpState('sex', value)
}

const setEmail = (value: string) => {
  setSignUpState({
    email: value,
    emailVerified: false,
    verificationCode: '',
    verificationError: null,
  })
}

const setVerificationCode = (value: string) => {
  setSignUpState({ verificationCode: value, verificationError: null })
}

const setPhone = (value: string) => {
  setSignUpState('phone', value)
}

const setDateOfBirth = (value: string) => {
  setSignUpState('dateOfBirth', value)
}

const setPassword = (value: string) => {
  setSignUpState('password', value)
}

const sendVerificationCode = async () => {
  if (!signUpState.email || !isValidEmail(signUpState.email)) return
  if (signUpState.verificationCountdown > 0) return

  setSignUpState({ verificationSending: true, verificationError: null })
  try {
    await apiPost('sendVerificationCode', { email: signUpState.email })
    startCountdown()
    setSignUpState({ verificationSending: false })
  } catch (err) {
    setSignUpState({
      verificationSending: false,
      verificationError:
        err instanceof Error ? err.message : 'Failed to send code',
    })
  }
}

const verifyCode = async () => {
  if (!signUpState.verificationCode) return

  setSignUpState({ verificationSending: true, verificationError: null })
  try {
    await apiPost('verifyCode', {
      email: signUpState.email,
      code: signUpState.verificationCode,
    })
    setSignUpState({
      emailVerified: true,
      verificationSending: false,
      verificationError: null,
    })
  } catch (err) {
    setSignUpState({
      verificationSending: false,
      verificationError:
        err instanceof Error ? err.message : 'Invalid verification code',
    })
  }
}

interface SignUpResponse {
  token: string
  isAdmin: boolean
  isSuperAdmin: boolean
  player: {
    _id: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
  }
}

const buildSignUpBody = (): Record<string, string> => {
  const body: Record<string, string> = {
    firstName: toTitleCase(signUpState.firstName.trim()),
    lastName: toTitleCase(signUpState.lastName.trim()),
    email: signUpState.email.trim(),
    password: signUpState.password,
  }
  if (signUpState.phone.trim()) body.phone = signUpState.phone.trim()
  if (signUpState.dateOfBirth) body.dateOfBirth = signUpState.dateOfBirth
  const dbSex = toDbSex(signUpState.sex)
  if (dbSex) body.sex = dbSex
  if (signUpState.existingPlayer && signUpState.selectedPlayerId) {
    body.playerId = signUpState.selectedPlayerId
  }
  return body
}

const isBrandNewPlayerSignUp = (): boolean =>
  !signUpState.existingPlayer && !signUpState.selectedPlayerId

const doSignUp = async () => {
  setSignUpState({ loading: true, error: null })
  try {
    const wasBrandNew = isBrandNewPlayerSignUp()
    const result = await apiPost<SignUpResponse>('signUp', buildSignUpBody())

    localStorage.setItem('vttc_token', result.token)
    localStorage.setItem('vttc_user', JSON.stringify(result.player))
    localStorage.setItem('vttc_isAdmin', String(result.isAdmin))
    localStorage.setItem('vttc_isSuperAdmin', String(result.isSuperAdmin))

    if (wasBrandNew) {
      setSignUpState({ loading: false, showNewPlayerSuccess: true })
    } else {
      authActions.hideDialog()
      window.location.reload()
    }
  } catch (err) {
    setSignUpState({
      loading: false,
      error: err instanceof Error ? err.message : 'Sign up failed',
    })
  }
}

const isEmailTakenByAccount = (email: string): boolean => {
  if (!playerState.data) return false
  const target = email.trim().toLowerCase()
  return playerState.data.some(
    (p) => p.hasAccount && (p.email ?? '').trim().toLowerCase() === target,
  )
}

const phoneDigits = (phone: string): string => phone.replace(/\D/g, '')

const isPhoneTakenByAccount = (phone: string): boolean => {
  if (!playerState.data) return false
  const target = phoneDigits(phone)
  if (!target) return false
  return playerState.data.some(
    (p) => p.hasAccount && phoneDigits(p.phone ?? '') === target,
  )
}

const signUp = async () => {
  if (!isSignUpEnabled()) return

  if (!signUpState.existingPlayer) {
    if (!playerState.data) await playerActions.fetchPlayers()
    if (isEmailTakenByAccount(signUpState.email)) {
      setSignUpState({
        error: 'An account with this email already exists. Please sign in.',
      })
      return
    }
    if (
      signUpState.phone.trim() &&
      isPhoneTakenByAccount(signUpState.phone)
    ) {
      setSignUpState({
        error: 'An account with this phone already exists. Please sign in.',
      })
      return
    }
    const matches = findNameMatches(
      signUpState.firstName,
      signUpState.lastName,
    )
    if (matches.length > 0) {
      setSignUpState({
        error: null,
        showMatchDialog: true,
        matchedPlayers: matches,
        selectedMatchedPlayerId:
          matches.length === 1 ? matches[0]._id.toString() : '',
      })
      return
    }
  }

  await doSignUp()
}

const selectMatchedPlayer = (id: string) => {
  setSignUpState('selectedMatchedPlayerId', id)
}

const confirmMatchedPlayer = async () => {
  const id = signUpState.selectedMatchedPlayerId
  if (!id) return
  setSignUpState({
    existingPlayer: true,
    selectedPlayerId: id,
    showMatchDialog: false,
    matchedPlayers: [],
    selectedMatchedPlayerId: '',
  })
  await doSignUp()
}

const chooseNewPlayer = async () => {
  setSignUpState({
    showMatchDialog: false,
    matchedPlayers: [],
    selectedMatchedPlayerId: '',
  })
  await doSignUp()
}

const dismissNewPlayerSuccess = () => {
  authActions.hideDialog()
  window.location.reload()
}

const reset = () => {
  clearCountdownTimer()
  setSignUpState(getInitialState())
}

export const signUpActions = {
  setExistingPlayer,
  selectPlayer,
  setFirstName,
  setLastName,
  setSex,
  setEmail,
  setVerificationCode,
  setPhone,
  setDateOfBirth,
  setPassword,
  sendVerificationCode,
  verifyCode,
  signUp,
  selectMatchedPlayer,
  confirmMatchedPlayer,
  chooseNewPlayer,
  dismissNewPlayerSuccess,
  reset,
  selectedPlayer,
  playerAlreadySignedUp,
  isEmailDisabled,
  isVerificationDisabled,
  isSignUpEnabled,
  isValidEmail,
  isValidPhone,
  isValidPassword,
  passwordHasMinLength,
  passwordHasNumber,
  passwordHasUppercase,
  passwordHasLowercase,
  playerOptions,
}
