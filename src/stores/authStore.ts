import { createStore } from 'solid-js/store'
import { apiPost } from '../utils/api'

interface AuthUser {
  _id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
}

interface SignInResponse {
  token: string
  player: AuthUser
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  loading: boolean
  error: string | null
  showSignInDialog: boolean
}

const getInitialState = (): AuthState => ({
  user: loadUserFromStorage(),
  token: loadTokenFromStorage(),
  loading: false,
  error: null,
  showSignInDialog: false,
})

const loadUserFromStorage = (): AuthUser | null => {
  try {
    const stored = localStorage.getItem('vttc_user')
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

const loadTokenFromStorage = (): string | null => {
  try {
    return localStorage.getItem('vttc_token')
  } catch {
    return null
  }
}

const saveToStorage = (token: string, user: AuthUser) => {
  localStorage.setItem('vttc_token', token)
  localStorage.setItem('vttc_user', JSON.stringify(user))
}

const clearStorage = () => {
  localStorage.removeItem('vttc_token')
  localStorage.removeItem('vttc_user')
}

const [authState, setAuthState] = createStore<AuthState>(getInitialState())

export { authState }

export const authActions = {
  showSignInDialog: () => {
    setAuthState({ showSignInDialog: true, error: null })
  },

  hideSignInDialog: () => {
    setAuthState({ showSignInDialog: false, error: null })
  },

  signIn: async (emailOrPhone: string, password: string) => {
    validateSignInInput(emailOrPhone, password)

    setAuthState({ loading: true, error: null })
    try {
      const result = await apiPost<SignInResponse>('signIn', {
        emailOrPhone,
        password,
      })
      saveToStorage(result.token, result.player)
      setAuthState({
        user: result.player,
        token: result.token,
        loading: false,
        error: null,
        showSignInDialog: false,
      })
    } catch (err) {
      setAuthState({
        loading: false,
        error: err instanceof Error ? err.message : 'Sign in failed',
      })
    }
  },

  signOut: () => {
    clearStorage()
    setAuthState({
      user: null,
      token: null,
      showSignInDialog: false,
      error: null,
    })
  },

  isSignedIn: (): boolean => authState.user !== null && authState.token !== null,
}

const validateSignInInput = (emailOrPhone: string, password: string) => {
  if (!emailOrPhone) throw new Error('Email or phone is required')
  if (!password) throw new Error('Password is required')
}
