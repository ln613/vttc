import { createStore } from 'solid-js/store'
import { apiPost } from '../utils/api'
import {
  createGoogleCodeClient,
  type GoogleCodeClient,
  type GoogleEndReason,
} from '../utils/googleIdentity'
import { authActions, type SignInResponse } from './authStore'
import { settingsActions, settingsState } from './settingsStore'
import { signUpActions } from './signUpStore'

// "Sign in with Google", from either dialog. What happens after Google hands
// back a code is the same wherever the G was clicked: the server either signs
// the person in (the Google account, or its email, is already an account) or
// says they are new, and the sign-up wizard carries on from "What's your
// name?" with the name Google gave.

interface GoogleAuthState {
  // The popup can be opened: the site has Google set up and the script has
  // loaded. Until then the G is not shown.
  ready: boolean
  busy: boolean
  error: string | null
}

const [googleAuthState, setGoogleAuthState] = createStore<GoogleAuthState>({
  ready: false,
  busy: false,
  error: null,
})

export { googleAuthState }

type GoogleSignInResult =
  | ({ signedIn: true } & SignInResponse)
  | {
      needsSignUp: true
      verificationToken: string
      email: string
      firstName: string
      lastName: string
    }

// Settings carry the client id. They are fetched once, whichever dialog asks
// first; later calls reuse the same request.
let settingsRequest: Promise<void> | null = null

const ensureSettings = (): Promise<void> => {
  if (settingsState.loaded) return Promise.resolve()
  settingsRequest ??= settingsActions.fetchSettings()
  return settingsRequest
}

const handleCode = async (code: string) => {
  setGoogleAuthState({ busy: true, error: null })
  try {
    const result = await apiPost<GoogleSignInResult>('googleSignIn', { code })
    setGoogleAuthState({ busy: false })
    if ('needsSignUp' in result) {
      signUpActions.continueWithGoogle(result)
    } else {
      signUpActions.reset()
      authActions.completeSignIn(result)
    }
  } catch (err) {
    setGoogleAuthState({
      busy: false,
      error: err instanceof Error ? err.message : 'Google sign-in failed',
    })
  }
}

const handleEnd = (reason: GoogleEndReason) => {
  if (reason === 'failed') {
    setGoogleAuthState({ error: 'Google sign-in failed. Please try again.' })
  }
}

let codeClient: GoogleCodeClient | null = null
let preparing: Promise<void> | null = null

// Gets the popup ready before anyone clicks, since it has to open within the
// click itself. Once per page; every G after the first is ready at once.
const prepare = (): Promise<void> => {
  setGoogleAuthState({ error: null })
  preparing ??= (async () => {
    await ensureSettings()
    const clientId = settingsState.settings.googleClientId
    if (!clientId) return
    try {
      codeClient = await createGoogleCodeClient(clientId, handleCode, handleEnd)
      setGoogleAuthState({ ready: true })
    } catch (err) {
      preparing = null // a later dialog may try again
      setGoogleAuthState({
        error: err instanceof Error ? err.message : 'Google sign-in could not be loaded',
      })
    }
  })()
  return preparing
}

const start = () => {
  if (!codeClient || googleAuthState.busy) return
  setGoogleAuthState({ error: null })
  codeClient.requestCode()
}

export const googleAuthActions = {
  prepare,
  start,
}
