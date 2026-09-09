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

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'API request failed')
  }
  return response.json()
}
