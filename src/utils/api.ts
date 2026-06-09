// In dev → point at the local netlify dev server.
// In a Cordova/APK build (no real origin) → use VITE_PROD_HOST so the
// WebView can hit the live API. In a regular web build → same-origin
// (empty string).
const getApiHost = () => {
  if (import.meta.env.DEV) {
    return `http://${window.location.hostname}:8888`
  }
  return import.meta.env.VITE_PROD_HOST || ''
}

export const api = async <T>(type: string, params: Record<string, string> = {}): Promise<T> => {
  validateType(type)

  const queryParams = new URLSearchParams({ type, ...params })
  const response = await fetch(`${getApiHost()}/.netlify/functions/api?${queryParams}`)

  return handleResponse<T>(response)
}

export const apiGet = api

export const apiPost = async <T>(type: string, body: unknown): Promise<T> => {
  validateType(type)

  const response = await fetch(`${getApiHost()}/.netlify/functions/api?type=${type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
