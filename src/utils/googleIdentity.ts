// Google Identity Services, the script behind "Sign in with Google".
//
// Used in authorization-code mode: our own plain "G" opens Google's popup,
// and the popup hands back a one-time code for the server to exchange
// (googleAuth.js). Google's ready-made button is not used because it always
// draws a circle round the G.
//
// Loaded on first use rather than in index.html, so a site that has not set
// Google up, or a visitor who never opens sign-in, never fetches it.

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
// Enough for the ID token to carry the email and the name.
const SCOPES = 'openid email profile'

interface CodeResponse {
  code?: string
  error?: string
}

export interface GoogleCodeClient {
  requestCode: () => void
}

interface GoogleOAuth2 {
  initCodeClient: (config: {
    client_id: string
    scope: string
    ux_mode: 'popup' | 'redirect'
    callback: (response: CodeResponse) => void
    error_callback?: (error: { type: string }) => void
  }) => GoogleCodeClient
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } }
  }
}

let scriptLoading: Promise<GoogleOAuth2> | null = null

const loadScript = (): Promise<GoogleOAuth2> => {
  if (scriptLoading) return scriptLoading
  scriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2
      if (oauth2) resolve(oauth2)
      else reject(new Error('Google sign-in did not load'))
    }
    script.onerror = () => {
      scriptLoading = null // let a later attempt try again
      reject(new Error('Google sign-in could not be loaded'))
    }
    document.head.appendChild(script)
  })
  return scriptLoading
}

// Why the popup ended without a code. Closing it is the person changing
// their mind, not a failure, so it has no message.
export type GoogleEndReason = 'closed' | 'failed'

/**
 * A client whose requestCode() opens Google's popup. Made ahead of the click:
 * a popup opened any later than the click itself is blocked by browsers.
 */
export const createGoogleCodeClient = async (
  clientId: string,
  onCode: (code: string) => void,
  onEnd: (reason: GoogleEndReason) => void,
): Promise<GoogleCodeClient> => {
  const oauth2 = await loadScript()
  return oauth2.initCodeClient({
    client_id: clientId,
    scope: SCOPES,
    ux_mode: 'popup',
    callback: (response) => {
      if (response.code) onCode(response.code)
      else onEnd(response.error === 'access_denied' ? 'closed' : 'failed')
    },
    error_callback: (error) => onEnd(error.type === 'popup_closed' ? 'closed' : 'failed'),
  })
}
