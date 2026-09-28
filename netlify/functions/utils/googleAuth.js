// "Sign in with Google", server side.
//
// The browser shows our own plain "G" (Google's ready-made button always
// draws a circle round it) and opens Google's popup in authorization-code
// mode. The popup hands the browser a one-time code; the browser sends it
// here, and this swaps it with Google — using the client secret, which only
// the server has — for an ID token. The ID token is a JWT signed by Google;
// its signature is checked against Google's published keys, and its claims
// that it was issued to *this* client, so the email inside can be trusted as
// proved. Done with Node's own crypto rather than a library: one RS256
// signature and four claims.
//
// Needs an OAuth "Web application" client whose Authorized JavaScript origins
// list the site (for local dev, both http://localhost and
// http://localhost:<vite port>). Its id and secret come as a pair:
//   GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET    a club's own
//   GMAIL_1_CLIENT_ID + GMAIL_1_CLIENT_SECRET  the shared default in .env,
//                                              used when a club sets none
// Without a pair the Google option is simply not shown (see googleClientId
// in settingsHandlers) and the endpoint refuses.

import crypto from 'node:crypto'

const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
// What the popup's code is exchanged against in popup mode.
const POPUP_REDIRECT_URI = 'postmessage'
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com']
const CLOCK_SKEW_SECONDS = 60
const DEFAULT_KEY_CACHE_MS = 60 * 60 * 1000

// Kept as a pair: a club that sets its own id without its own secret is not
// quietly given the default's secret, which would not match.
const getGoogleClient = () =>
  process.env.GOOGLE_CLIENT_ID
    ? { id: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET }
    : { id: process.env.GMAIL_1_CLIENT_ID, secret: process.env.GMAIL_1_CLIENT_SECRET }

export const isGoogleConfigured = () => {
  const { id, secret } = getGoogleClient()
  return !!(id && secret)
}

// Public by nature — the browser needs it to open Google's popup.
export const getGoogleClientId = () => (isGoogleConfigured() ? getGoogleClient().id : null)

const throwError = (message) => {
  throw new Error(message)
}

const INVALID = 'Google sign-in failed. Please try again.'

// ==================== Google's signing keys ====================

// Kept per warm instance for as long as Google says they are good for, and
// fetched again when a token names a key we do not have (they rotate).
let keyCache = { keys: new Map(), expiresAt: 0 }

const maxAgeMs = (response) => {
  const match = /max-age=(\d+)/.exec(response.headers.get('cache-control') || '')
  return match ? Number(match[1]) * 1000 : DEFAULT_KEY_CACHE_MS
}

const fetchKeys = async () => {
  const response = await fetch(JWKS_URL)
  if (!response.ok) throwError(INVALID)
  const { keys = [] } = await response.json()
  keyCache = {
    keys: new Map(keys.map((jwk) => [jwk.kid, crypto.createPublicKey({ key: jwk, format: 'jwk' })])),
    expiresAt: Date.now() + maxAgeMs(response),
  }
}

const getKey = async (kid) => {
  if (Date.now() >= keyCache.expiresAt || !keyCache.keys.has(kid)) await fetchKeys()
  return keyCache.keys.get(kid) ?? throwError(INVALID)
}

// ==================== the token ====================

const decodePart = (part) => {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  } catch {
    return throwError(INVALID)
  }
}

const validateClaims = (claims, clientId) => {
  const now = Math.floor(Date.now() / 1000)
  if (!ISSUERS.includes(claims.iss)) throwError(INVALID)
  if (claims.aud !== clientId) throwError(INVALID)
  if (!claims.exp || claims.exp + CLOCK_SKEW_SECONDS < now) {
    throwError('Google sign-in expired. Please try again.')
  }
  if (claims.iat && claims.iat - CLOCK_SKEW_SECONDS > now) throwError(INVALID)
  if (!claims.sub || !claims.email) throwError(INVALID)
}

const verifyGoogleIdToken = async (credential) => {
  const clientId = getGoogleClientId()
  if (!clientId) throwError('Sign in with Google is not available')
  if (typeof credential !== 'string') throwError(INVALID)

  const parts = credential.split('.')
  if (parts.length !== 3) throwError(INVALID)
  const [encodedHeader, encodedClaims, encodedSignature] = parts

  const header = decodePart(encodedHeader)
  if (header.alg !== 'RS256' || !header.kid) throwError(INVALID)

  const key = await getKey(header.kid)
  const signed = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${encodedHeader}.${encodedClaims}`),
    key,
    Buffer.from(encodedSignature, 'base64url'),
  )
  if (!signed) throwError(INVALID)

  const claims = decodePart(encodedClaims)
  validateClaims(claims, clientId)
  return claims
}

// ==================== the code from the popup ====================

const exchangeCode = async (code) => {
  const { id, secret } = getGoogleClient()
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: id,
      client_secret: secret,
      redirect_uri: POPUP_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.id_token) {
    console.error('Google code exchange failed', data?.error, data?.error_description)
    throwError(INVALID)
  }
  return data.id_token
}

/**
 * Who a code from Google's popup belongs to, or an error: the claims of the
 * ID token Google issues for it to this site.
 * { sub, email, email_verified, given_name, family_name, name, ... }
 */
export const verifyGoogleSignInCode = async (code) => {
  if (!isGoogleConfigured()) throwError('Sign in with Google is not available')
  if (typeof code !== 'string' || !code) throwError(INVALID)
  return verifyGoogleIdToken(await exchangeCode(code))
}
