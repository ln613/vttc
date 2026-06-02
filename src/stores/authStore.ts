import { createStore } from 'solid-js/store'
import { apiPost } from '../utils/api'

interface AuthUser {
  _id: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  sex?: string
  dateOfBirth?: string
  rating?: number
  pending?: boolean
}

interface SignInResponse {
  token: string
  isAdmin: boolean
  isSuperAdmin: boolean
  player: AuthUser
}

type DialogView = 'signIn' | 'signUp' | null

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAdmin: boolean
  isSuperAdmin: boolean
  loading: boolean
  error: string | null
  dialogView: DialogView
  showPendingModal: boolean
}

const getInitialState = (): AuthState => ({
  user: loadUserFromStorage(),
  token: loadTokenFromStorage(),
  isAdmin: loadIsAdminFromStorage(),
  isSuperAdmin: loadIsSuperAdminFromStorage(),
  loading: false,
  error: null,
  dialogView: null,
  showPendingModal: false,
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

const loadIsSuperAdminFromStorage = (): boolean => {
  try {
    return localStorage.getItem('vttc_isSuperAdmin') === 'true'
  } catch {
    return false
  }
}

const saveToStorage = (
  token: string,
  user: AuthUser,
  isAdmin: boolean,
  isSuperAdmin: boolean,
) => {
  localStorage.setItem('vttc_token', token)
  localStorage.setItem('vttc_user', JSON.stringify(user))
  localStorage.setItem('vttc_isAdmin', String(isAdmin))
  localStorage.setItem('vttc_isSuperAdmin', String(isSuperAdmin))
}

const clearStorage = () => {
  localStorage.removeItem('vttc_token')
  localStorage.removeItem('vttc_user')
  localStorage.removeItem('vttc_isAdmin')
  localStorage.removeItem('vttc_isSuperAdmin')
}

const [authState, setAuthState] = createStore<AuthState>(getInitialState())

export { authState }

export const authActions = {
  showSignInDialog: () => {
    setAuthState({ dialogView: 'signIn', error: null })
  },

  showSignUpDialog: () => {
    setAuthState({ dialogView: 'signUp', error: null })
  },

  hideDialog: () => {
    setAuthState({ dialogView: null, error: null })
  },

  dismissPendingModal: () => {
    setAuthState({ showPendingModal: false })
  },

  signIn: async (emailOrPhone: string, password: string) => {
    validateSignInInput(emailOrPhone, password)

    setAuthState({ loading: true, error: null })
    try {
      const result = await apiPost<SignInResponse>('signIn', {
        emailOrPhone,
        password,
      })
      saveToStorage(
        result.token,
        result.player,
        result.isAdmin,
        result.isSuperAdmin,
      )
      setAuthState({
        user: result.player,
        token: result.token,
        isAdmin: result.isAdmin,
        isSuperAdmin: result.isSuperAdmin,
        loading: false,
        error: null,
        dialogView: null,
        showPendingModal: !!result.player?.pending,
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
      isSuperAdmin: false,
      dialogView: null,
      error: null,
    })
  },

  updateUser: (updates: Partial<AuthUser>) => {
    if (!authState.user) return
    const updatedUser = { ...authState.user, ...updates }
    setAuthState({ user: updatedUser })
    localStorage.setItem('vttc_user', JSON.stringify(updatedUser))
  },

  isSignedIn: (): boolean => authState.user !== null && authState.token !== null,
}

const validateSignInInput = (emailOrPhone: string, password: string) => {
  if (!emailOrPhone) throw new Error('Email or phone is required')
  if (!password) throw new Error('Password is required')
}
