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
  isAdmin: boolean
  player: AuthUser
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAdmin: boolean
  loading: boolean
  error: string | null
  showSignInDialog: boolean
}

const getInitialState = (): AuthState => ({
  user: loadUserFromStorage(),
  token: loadTokenFromStorage(),
  isAdmin: loadIsAdminFromStorage(),
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

const loadIsAdminFromStorage = (): boolean => {
  try {
    return localStorage.getItem('vttc_isAdmin') === 'true'
  } catch {
    return false
  }
}

const saveToStorage = (token: string, user: AuthUser, isAdmin: boolean) => {
  localStorage.setItem('vttc_token', token)
  localStorage.setItem('vttc_user', JSON.stringify(user))
  localStorage.setItem('vttc_isAdmin', String(isAdmin))
}

const clearStorage = () => {
  localStorage.removeItem('vttc_token')
  localStorage.removeItem('vttc_user')
  localStorage.removeItem('vttc_isAdmin')
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
      saveToStorage(result.token, result.player, result.isAdmin)
      setAuthState({
        user: result.player,
        token: result.token,
        isAdmin: result.isAdmin,
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
      isAdmin: false,
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
