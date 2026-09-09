// Port `netlify dev` serves the functions on. Configurable because two
// clubs can't both take 7004 — scripts/with-club.mjs passes the same value
// through to the CLI, so the two can't drift apart.
const DEV_API_PORT = import.meta.env.VITE_DEV_API_PORT || '7004'

// In dev → point at the local netlify dev server.
// In a Cordova/APK build (no real origin) → use VITE_PROD_HOST so the
// WebView can hit the live API. In a regular web build → same-origin
// (empty string).
const getApiHost = () => {
  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:${DEV_API_PORT}`
  }
  return import.meta.env.VITE_PROD_HOST || ''
}

// Read from storage rather than authStore, which imports this module.
// A missing token just means an anonymous request — the server treats that
// as the public view rather than an error.
const authHeaders = (): Record<string, string> => {
  try {
    const token = localStorage.getItem('vttc_token')
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

export const api = async <T>(type: string, params: Record<string, string> = {}): Promise<T> => {
  validateType(type)

  const queryParams = new URLSearchParams({ type, ...params })
  const response = await fetch(`${getApiHost()}/.netlify/functions/api?${queryParams}`, {
    headers: authHeaders(),
  })

  return handleResponse<T>(response)
}

export const apiGet = api

export const apiPost = async <T>(type: string, body: unknown): Promise<T> => {
  validateType(type)

  const response = await fetch(`${getApiHost()}/.netlify/functions/api?type=${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  })

  return handleResponse<T>(response)
}

const validateType = (type: string) => {
  if (!type) throw new Error('API type is required')
}

// A 401 means this device is holding a token the server won't accept — an
// expired one, or one issued before tokens were signed. The stored session
// is dropped so the app stops believing it is signed in and asks again,
// instead of silently failing every action. Cleared directly rather than
// through authStore, which imports this module.
const AUTH_KEYS = [
  'vttc_token',
  'vttc_user',
  'vttc_isAdmin',
  'vttc_isSuperAdmin',
  'vttc_isTablet',
]

const clearStoredSession = () => {
  try {
    for (const key of AUTH_KEYS) localStorage.removeItem(key)
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    if (response.status === 401) clearStoredSession()
    const error = await response.json().catch(() => ({}))
    throw new Error(error.error || 'API request failed')
  }
  return response.json()
}
