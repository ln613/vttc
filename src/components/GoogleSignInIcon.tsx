import { Show, type JSX } from 'solid-js'
import { googleAuthState, googleAuthActions } from '../stores/googleAuthStore'
import { GoogleLogo, IconButton } from './SignInIcons'

// Google's "G" and nothing else. It appears once the site is known to have
// Google set up and the popup is ready; until then, and on a site without
// Google, it takes no room. The wrapper is `display: contents`, so the G
// sits in its parent's row exactly as if it were a direct child.
const GoogleSignInIcon = () => (
  <span style={contentsStyle} ref={() => void googleAuthActions.prepare()}>
    <Show when={googleAuthState.ready}>
      <IconButton
        label="Continue with Google"
        onClick={googleAuthActions.start}
        disabled={googleAuthState.busy}
      >
        <GoogleLogo />
      </IconButton>
    </Show>
  </span>
)

// What the G is doing, shown under the row it sits in.
export const GoogleSignInStatus = () => (
  <>
    <Show when={googleAuthState.busy}>
      <div style={noteStyle}>Signing in with Google...</div>
    </Show>
    <Show when={googleAuthState.error}>
      <div style={errorStyle}>{googleAuthState.error}</div>
    </Show>
  </>
)

const contentsStyle: JSX.CSSProperties = { display: 'contents' }

const noteStyle: JSX.CSSProperties = {
  'font-size': '13px',
  color: '#666',
  'text-align': 'center',
  'margin-top': '8px',
}

const errorStyle: JSX.CSSProperties = {
  color: '#e74c3c',
  'font-size': '13px',
  'text-align': 'center',
  'margin-top': '8px',
}

export default GoogleSignInIcon
