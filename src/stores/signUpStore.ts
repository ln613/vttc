import { createStore } from 'solid-js/store'
import type { Player } from '../../shared/types/Player'
import { apiGet, apiPost } from '../utils/api'
import { playerActions, playerState } from './playerStore'
import { authActions } from './authStore'
import { settingsActions, settingsState } from './settingsStore'
import { normalizeSex, toDbSex, type FormSex } from '../../shared/rules/sex'
import { isValidEmail, isValidPhone } from '../../shared/rules/contact'
import { formatLocalDate, toIsoDate, daysInMonth, type DatePart } from '../utils/date'

// ==================== the wizard ====================
//
// Sign-up is seven numbered steps (specs/shared/header.md). Some screens are
// a branch of a step rather than a step of their own — "that email already
// has an account" is what step 3 turns into, and "is one of these you?" is
// the second half of step 4 — so each screen maps onto the number it belongs
// to, and the progress shown is the number, not the screen.

// 'google' skips steps 2 and 3: Google has already proved the email.
export type SignUpMethod = 'email' | 'phone' | 'google'

// Phone sign-up is built and works once SMS is set up (sms.js), but is not
// offered for now. Flip this to offer it wherever smsEnabled is true.
const OFFER_PHONE_SIGN_UP = false

export type WizardStep =
  | 'method'
  | 'contact'
  | 'code'
  | 'accountExists'
  | 'name'
  | 'match'
  | 'sex'
  | 'dob'
  | 'password'

export const TOTAL_STEPS = 7

const STEP_NUMBER: Record<WizardStep, number> = {
  method: 1,
  contact: 2,
  code: 3,
  accountExists: 3,
  name: 4,
  match: 4,
  sex: 5,
  dob: 6,
  password: 7,
}

// A player on file who might be the person signing up — only what the public
// player list shows, plus whether a date of birth is on file.
export interface SimilarPlayer {
  _id: string
  firstName: string
  lastName: string
  sex: string
  rating: number
  hasDateOfBirth: boolean
}

interface SignUpState {
  step: WizardStep
  // The screens that led here, for Back. Skipped steps are never pushed, so
  // Back returns to the last screen the person actually saw.
  history: WizardStep[]
  method: SignUpMethod | null
  contact: string
  // The address the running countdown belongs to, so going Back and
  // Continuing with the same address returns to the code instead of
  // bouncing off the resend cooldown.
  codeSentTo: string
  code: string
  resendCountdown: number
  verificationToken: string
  firstName: string
  lastName: string
  similarPlayers: SimilarPlayer[]
  // '' means a new player.
  selectedPlayerId: string
  sex: FormSex
  dobYear: string
  dobMonth: string
  dobDay: string
  password: string
  loading: boolean
  error: string | null
  showNewPlayerSuccess: boolean
  // Admin "register this player" mode, opened from the Players page.
  adminRegisterMode: boolean
  adminRegisterSent: boolean
  email: string
}

const getInitialState = (): SignUpState => ({
  step: 'method',
  history: [],
  method: null,
  contact: '',
  codeSentTo: '',
  code: '',
  resendCountdown: 0,
  verificationToken: '',
  firstName: '',
  lastName: '',
  similarPlayers: [],
  selectedPlayerId: '',
  sex: '',
  dobYear: '',
  dobMonth: '',
  dobDay: '',
  password: '',
  loading: false,
  error: null,
  showNewPlayerSuccess: false,
  adminRegisterMode: false,
  adminRegisterSent: false,
  email: '',
})

const [signUpState, setSignUpState] = createStore<SignUpState>(getInitialState())

export { signUpState }

// ==================== rules ====================

const isValidPassword = (password: string): boolean =>
  password.length >= 8 &&
  /[0-9]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password)

const errorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error ? err.message : fallback

// ==================== derived ====================

const stepNumber = (): number => STEP_NUMBER[signUpState.step]

const isPhone = (): boolean => signUpState.method === 'phone'

const phoneAvailable = (): boolean =>
  OFFER_PHONE_SIGN_UP && settingsState.settings.smsEnabled

// Someone who came through Google signs in with Google; a password is an
// extra way in, theirs to add or not.
const isPasswordOptional = (): boolean => signUpState.method === 'google'

const selectedSimilarPlayer = (): SimilarPlayer | null =>
  signUpState.similarPlayers.find((p) => p._id === signUpState.selectedPlayerId) ??
  null

// Steps 5 and 6 are skipped when the player being claimed already has the
// answer on file.
const needsSexStep = (): boolean => !normalizeSex(selectedSimilarPlayer()?.sex)

const needsDobStep = (): boolean => !selectedSimilarPlayer()?.hasDateOfBirth

// Once the address is proved there is no going back to change it — that
// would mean proving a different one. Closing the dialog starts over.
const canGoBack = (): boolean =>
  signUpState.history.length > 0 && signUpState.step !== 'name'

const dateOfBirth = (): string =>
  toIsoDate(signUpState.dobYear, signUpState.dobMonth, signUpState.dobDay)

// ==================== navigation ====================

const goTo = (step: WizardStep) => {
  setSignUpState({
    history: [...signUpState.history, signUpState.step],
    step,
    error: null,
  })
}

const back = () => {
  if (!canGoBack()) return
  const history = [...signUpState.history]
  const previous = history.pop()!
  setSignUpState({ step: previous, history, error: null })
}

// Where the wizard goes once it knows who the person is (step 4 done).
const stepAfterIdentity = (): WizardStep => {
  if (needsSexStep()) return 'sex'
  if (needsDobStep()) return 'dob'
  return 'password'
}

const stepAfterSex = (): WizardStep => (needsDobStep() ? 'dob' : 'password')

const setError = (error: string) => setSignUpState('error', error)

// ==================== resend countdown ====================

let countdownTimer: ReturnType<typeof setInterval> | null = null

const clearCountdownTimer = () => {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

const startCountdown = (seconds: number) => {
  setSignUpState('resendCountdown', seconds)
  clearCountdownTimer()
  countdownTimer = setInterval(() => {
    const current = signUpState.resendCountdown
    if (current <= 1) {
      setSignUpState('resendCountdown', 0)
      clearCountdownTimer()
    } else {
      setSignUpState('resendCountdown', current - 1)
    }
  }, 1000)
}

// ==================== step 1: method ====================

const chooseMethod = (method: SignUpMethod) => {
  if (method === 'phone' && !phoneAvailable()) return
  if (method !== signUpState.method) {
    setSignUpState({ method, contact: '', code: '', codeSentTo: '' })
  }
  goTo('contact')
}

// ==================== steps 2 and 3: prove the address ====================

const setContact = (value: string) => {
  setSignUpState({ contact: value, error: null })
}

const validateContact = (): string | null => {
  const value = signUpState.contact.trim()
  if (!value) return isPhone() ? 'Enter your phone number' : 'Enter your email'
  if (isPhone() && !isValidPhone(value)) return 'Enter a valid Canadian/US phone number'
  if (!isPhone() && !isValidEmail(value)) return 'Enter a valid email address'
  return null
}

interface SendCodeResponse {
  accountExists?: boolean
  sent?: boolean
  resendIn?: number
}

const requestCode = async (): Promise<SendCodeResponse> =>
  apiPost<SendCodeResponse>('sendVerificationCode', {
    channel: signUpState.method,
    to: signUpState.contact.trim(),
  })

const submitContact = async () => {
  const invalid = validateContact()
  if (invalid) return setError(invalid)

  const address = signUpState.contact.trim()
  if (address === signUpState.codeSentTo && signUpState.resendCountdown > 0) {
    return goTo('code')
  }

  setSignUpState({ loading: true, error: null })
  try {
    const result = await requestCode()
    setSignUpState({ loading: false })
    if (result.accountExists) return goTo('accountExists')
    setSignUpState({ code: '', codeSentTo: address })
    startCountdown(result.resendIn ?? 60)
    goTo('code')
  } catch (err) {
    setSignUpState({ loading: false, error: errorMessage(err, 'Could not send the code') })
  }
}

const resendCode = async () => {
  if (signUpState.resendCountdown > 0 || signUpState.loading) return
  setSignUpState({ loading: true, error: null })
  try {
    const result = await requestCode()
    setSignUpState({ loading: false, code: '' })
    startCountdown(result.resendIn ?? 60)
  } catch (err) {
    setSignUpState({ loading: false, error: errorMessage(err, 'Could not send the code') })
  }
}

const setCode = (value: string) => {
  setSignUpState({ code: value.replace(/\D/g, '').slice(0, 6), error: null })
}

const submitCode = async () => {
  if (signUpState.code.length !== 6) return setError('Enter the 6-digit code')
  setSignUpState({ loading: true, error: null })
  try {
    const { verificationToken } = await apiPost<{ verificationToken: string }>(
      'verifyCode',
      {
        channel: signUpState.method,
        to: signUpState.contact.trim(),
        code: signUpState.code,
      },
    )
    clearCountdownTimer()
    setSignUpState({ loading: false, verificationToken, resendCountdown: 0 })
    goTo('name')
  } catch (err) {
    setSignUpState({ loading: false, error: errorMessage(err, 'That code is not right') })
  }
}

// ==================== or: through Google ====================

interface GoogleSignUpStart {
  verificationToken: string
  email: string
  firstName: string
  lastName: string
}

// Google has proved the email, so steps 2 and 3 are done: the wizard opens
// at "What's your name?" with the name Google gave, still editable. There is
// no Back from there, exactly as after verifying a code.
const continueWithGoogle = (start: GoogleSignUpStart) => {
  reset()
  setSignUpState({
    method: 'google',
    contact: start.email,
    verificationToken: start.verificationToken,
    firstName: start.firstName,
    lastName: start.lastName,
    step: 'name',
  })
  authActions.showSignUpDialog()
}

// Step 3 found an account: sign in with the address already typed.
const goToSignIn = () => {
  const contact = signUpState.contact.trim()
  reset()
  authActions.showSignInDialog(contact)
}

// ==================== step 4: who are you ====================

const setFirstName = (value: string) => setSignUpState({ firstName: value, error: null })

const setLastName = (value: string) => setSignUpState({ lastName: value, error: null })

const submitName = async () => {
  const firstName = signUpState.firstName.trim()
  const lastName = signUpState.lastName.trim()
  if (!firstName) return setError('Enter your first name')
  if (!lastName) return setError('Enter your last name')

  setSignUpState({ loading: true, error: null })
  try {
    const matches = await apiGet<SimilarPlayer[]>('similarPlayers', { firstName, lastName })
    setSignUpState({
      loading: false,
      similarPlayers: matches,
      // One candidate is pre-selected; with several, the person has to pick.
      selectedPlayerId: matches.length === 1 ? matches[0]._id : '',
    })
    goTo(matches.length > 0 ? 'match' : stepAfterIdentity())
  } catch (err) {
    setSignUpState({ loading: false, error: errorMessage(err, 'Could not look up your name') })
  }
}

const selectSimilarPlayer = (id: string) => {
  setSignUpState({ selectedPlayerId: id, error: null })
}

const confirmSimilarPlayer = () => {
  if (!signUpState.selectedPlayerId) return setError('Select yourself, or choose "I\'m new"')
  goTo(stepAfterIdentity())
}

const chooseNewPlayer = () => {
  setSignUpState({ selectedPlayerId: '' })
  goTo(stepAfterIdentity())
}

// ==================== step 5: sex ====================

// Two choices and nothing else to fill in, so choosing one is the answer.
const chooseSex = (value: FormSex) => {
  if (!value) return setError('Choose one')
  setSignUpState({ sex: value, error: null })
  goTo(stepAfterSex())
}

// ==================== step 6: date of birth ====================

// A day that no longer exists in the newly chosen month (the 31st, going to
// April) is cleared rather than silently moved.
const setDobPart = (part: DatePart, value: string) => {
  const next = {
    dobYear: part === 'year' ? value : signUpState.dobYear,
    dobMonth: part === 'month' ? value : signUpState.dobMonth,
    dobDay: part === 'day' ? value : signUpState.dobDay,
  }
  const max = next.dobMonth
    ? daysInMonth(Number(next.dobMonth), Number(next.dobYear) || undefined)
    : 31
  if (Number(next.dobDay) > max) next.dobDay = ''
  setSignUpState({ ...next, error: null })
}

const validateDob = (): string | null => {
  const { dobYear, dobMonth, dobDay } = signUpState
  const chosen = [dobYear, dobMonth, dobDay].filter(Boolean).length
  if (chosen === 0) return null
  if (chosen < 3) return 'Choose the year, month and day — or skip'
  if (dateOfBirth() > formatLocalDate(new Date())) return 'That date is in the future'
  return null
}

const submitDob = () => {
  const invalid = validateDob()
  if (invalid) return setError(invalid)
  goTo('password')
}

const skipDob = () => {
  setSignUpState({ dobYear: '', dobMonth: '', dobDay: '' })
  goTo('password')
}

// ==================== step 7: password, and done ====================

const setPassword = (value: string) => setSignUpState({ password: value, error: null })

interface SignUpResponse {
  token: string
  isAdmin: boolean
  isSuperAdmin: boolean
  needsRating: boolean
  player: {
    _id: string
    firstName: string
    lastName: string
    email?: string
    phone?: string
  }
}

// Only what was asked: a claimed player's sex or date of birth on file is
// never sent, so there is nothing for the server to weigh against it.
const buildSignUpBody = (): Record<string, string> => {
  const body: Record<string, string> = {
    verificationToken: signUpState.verificationToken,
    firstName: signUpState.firstName.trim(),
    lastName: signUpState.lastName.trim(),
  }
  if (signUpState.password) body.password = signUpState.password
  if (signUpState.selectedPlayerId) body.playerId = signUpState.selectedPlayerId
  const dbSex = toDbSex(signUpState.sex)
  if (needsSexStep() && dbSex) body.sex = dbSex
  if (needsDobStep() && dateOfBirth()) body.dateOfBirth = dateOfBirth()
  return body
}

const storeSession = (result: SignUpResponse) => {
  localStorage.setItem('vttc_token', result.token)
  localStorage.setItem('vttc_user', JSON.stringify(result.player))
  localStorage.setItem('vttc_isAdmin', String(result.isAdmin))
  localStorage.setItem('vttc_isSuperAdmin', String(result.isSuperAdmin))
}

const submitSignUp = async () => {
  const skippingPassword = isPasswordOptional() && !signUpState.password
  if (!skippingPassword && !isValidPassword(signUpState.password)) {
    return setError('Password does not meet the rules below')
  }
  setSignUpState({ loading: true, error: null })
  try {
    const result = await apiPost<SignUpResponse>('signUp', buildSignUpBody())
    storeSession(result)
    if (result.needsRating) {
      setSignUpState({ loading: false, showNewPlayerSuccess: true })
    } else {
      authActions.hideDialog()
      window.location.reload()
    }
  } catch (err) {
    setSignUpState({ loading: false, error: errorMessage(err, 'Sign up failed') })
  }
}

const dismissNewPlayerSuccess = () => {
  authActions.hideDialog()
  window.location.reload()
}

// ==================== opening and closing ====================

const reset = () => {
  clearCountdownTimer()
  setSignUpState(getInitialState())
}

// Opens a fresh wizard. Settings are fetched here if nothing has fetched them
// yet, because only they say whether "Sign up with Phone" can be offered.
const open = () => {
  reset()
  if (!settingsState.loaded && !settingsState.loading) {
    void settingsActions.fetchSettings()
  }
  authActions.showSignUpDialog()
}

// ==================== admin: register a player ====================

const openAdminRegister = (player: Player) => {
  reset()
  setSignUpState({
    selectedPlayerId: player._id.toString(),
    firstName: player.firstName,
    lastName: player.lastName,
    email: player.email ?? '',
    adminRegisterMode: true,
    adminRegisterSent: false,
  })
}

const runAdminRegister = async () => {
  if (!signUpState.selectedPlayerId) return
  setSignUpState({ loading: true, error: null })
  try {
    await apiPost('registerPlayerByAdmin', {
      playerId: signUpState.selectedPlayerId,
    })
    setSignUpState({ loading: false, adminRegisterSent: true })
    if (playerState.data) await playerActions.fetchPlayers()
  } catch (err) {
    setSignUpState({
      loading: false,
      error: errorMessage(err, 'Failed to register player'),
    })
  }
}

export const signUpActions = {
  open,
  reset,
  back,
  chooseMethod,
  setContact,
  submitContact,
  resendCode,
  setCode,
  submitCode,
  goToSignIn,
  continueWithGoogle,
  setFirstName,
  setLastName,
  submitName,
  selectSimilarPlayer,
  confirmSimilarPlayer,
  chooseNewPlayer,
  chooseSex,
  setDobPart,
  submitDob,
  skipDob,
  setPassword,
  submitSignUp,
  dismissNewPlayerSuccess,
  openAdminRegister,
  runAdminRegister,
  stepNumber,
  isPhone,
  phoneAvailable,
  isPasswordOptional,
  canGoBack,
}
