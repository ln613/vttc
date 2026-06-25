// OS-level push notifications via Firebase Cloud Messaging (FCM HTTP v1).
// Delivers to Android natively and to iOS via APNs (configured in the
// Firebase console). Self-contained: the service-account JWT is signed
// with Node's crypto so no extra dependency is required.
//
// Required env (from a Firebase service-account JSON):
//   FCM_PROJECT_ID    — service_account.project_id
//   FCM_CLIENT_EMAIL  — service_account.client_email
//   FCM_PRIVATE_KEY   — service_account.private_key (newlines may be \n-escaped)
//
// When the env is not configured, every function here is a safe no-op so
// the rest of the app keeps working.
import crypto from 'crypto'
import { getDB, toObjectId } from './db.js'

const PUSH_TOKENS_COLLECTION = 'pushTokens'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const ACCESS_TOKEN_TTL_FALLBACK = 3600
const SEND_TIMEOUT_MS = 4000

const throwError = (message) => {
  throw new Error(message)
}

// ==================== SERVICE ACCOUNT / OAUTH ====================

const getServiceAccount = () => {
  const projectId = process.env.FCM_PROJECT_ID
  const clientEmail = process.env.FCM_CLIENT_EMAIL
  const rawKey = process.env.FCM_PRIVATE_KEY
  if (!projectId || !clientEmail || !rawKey) return null
  return { projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, '\n') }
}

export const isPushConfigured = () => getServiceAccount() !== null

const base64url = (input) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

const buildSignedJwt = (sa, nowSec) => {
  const header = { alg: 'RS256', typ: 'JWT' }
  const claims = {
    iss: sa.clientEmail,
    scope: FCM_SCOPE,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(claims),
  )}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.privateKey)
  return `${unsigned}.${base64url(signature)}`
}

let cachedAccessToken = null // { token, expiresAtSec }

const getAccessToken = async () => {
  const sa = getServiceAccount()
  if (!sa) return null

  const nowSec = Math.floor(Date.now() / 1000)
  if (cachedAccessToken && cachedAccessToken.expiresAtSec > nowSec + 60) {
    return cachedAccessToken.token
  }

  const jwt = buildSignedJwt(sa, nowSec)
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data.access_token) return null
  cachedAccessToken = {
    token: data.access_token,
    expiresAtSec: nowSec + (data.expires_in || ACCESS_TOKEN_TTL_FALLBACK),
  }
  return cachedAccessToken.token
}

// ==================== TOKEN STORAGE ====================

// Validate + persist a device token for a player. Upsert by token so the
// same device re-registering (or switching accounts) updates in place.
export const savePushToken = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body.playerId) throwError('playerId is required')
  if (!body.token) throwError('token is required')

  const db = getDB()
  await db.collection(PUSH_TOKENS_COLLECTION).updateOne(
    { token: body.token },
    {
      $set: {
        playerId: body.playerId.toString(),
        token: body.token,
        platform: body.platform || 'unknown',
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
  return { success: true }
}

// Drop a device token (e.g. on logout).
export const removePushToken = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body.token) throwError('token is required')
  const db = getDB()
  await db.collection(PUSH_TOKENS_COLLECTION).deleteOne({ token: body.token })
  return { success: true }
}

const getTokensForPlayers = async (playerIds) => {
  if (!Array.isArray(playerIds) || playerIds.length === 0) return []
  const db = getDB()
  const rows = await db
    .collection(PUSH_TOKENS_COLLECTION)
    .find({ playerId: { $in: playerIds.map((id) => id.toString()) } })
    .toArray()
  return rows.map((r) => r.token).filter(Boolean)
}

const deleteTokens = async (tokens) => {
  if (!Array.isArray(tokens) || tokens.length === 0) return
  const db = getDB()
  await db.collection(PUSH_TOKENS_COLLECTION).deleteMany({ token: { $in: tokens } })
}

// ==================== SENDING ====================

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ms)),
  ])

// FCM data payload values must all be strings.
const toStringData = (data) => {
  const out = {}
  for (const [k, v] of Object.entries(data || {})) {
    if (v != null) out[k] = String(v)
  }
  return out
}

// Send to one token. Returns 'ok' | 'invalid' | 'error'. 'invalid' means
// the token is dead (unregistered) and should be pruned.
const sendToToken = async (accessToken, projectId, token, notification, data) => {
  try {
    const res = await withTimeout(
      fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: { token, notification, data } }),
      }),
      SEND_TIMEOUT_MS,
    )
    if (res.timedOut) return 'error'
    if (res.ok) return 'ok'
    // 404 / 400 UNREGISTERED → stale token, prune it.
    if (res.status === 404) return 'invalid'
    if (res.status === 400) {
      const body = await res.json().catch(() => null)
      const status = body?.error?.status
      if (status === 'INVALID_ARGUMENT' || status === 'NOT_FOUND') return 'invalid'
    }
    return 'error'
  } catch {
    return 'error'
  }
}

// Send a push to every device of the given players. Best-effort: never
// throws, and prunes tokens FCM reports as dead.
export const sendPushToPlayers = async (playerIds, { title, body, data } = {}) => {
  try {
    if (!isPushConfigured()) return
    const tokens = await getTokensForPlayers(playerIds)
    if (tokens.length === 0) return
    const accessToken = await getAccessToken()
    if (!accessToken) return

    const sa = getServiceAccount()
    const notification = { title: title || 'VTTC Live', body: body || '' }
    const payloadData = toStringData(data)

    const results = await Promise.all(
      tokens.map((token) =>
        sendToToken(accessToken, sa.projectId, token, notification, payloadData).then(
          (status) => ({ token, status }),
        ),
      ),
    )
    const invalid = results.filter((r) => r.status === 'invalid').map((r) => r.token)
    if (invalid.length > 0) await deleteTokens(invalid)
  } catch {
    // best-effort: push failures must never break the calling flow
  }
}

// Convenience wrapper for the table-assignment notification.
export const sendTableAssignedPush = async (playerIds, { tableNumber, eventId, matchId }) => {
  await sendPushToPlayers(playerIds, {
    title: 'VTTC Live',
    body: `Your match has been assigned to table ${tableNumber}`,
    data: { type: 'table-assigned', tableNumber, eventId, matchId },
  })
}
