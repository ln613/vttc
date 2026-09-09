import crypto from 'node:crypto'

// Sign-in used to hand out a random SHA-256 string and never look at it
// again: nothing was stored, nothing carried a payload, so the server had
// no way to tell an admin from anyone at all. Every endpoint was in effect
// public, and "admin" was a flag in the browser's localStorage.
//
// Tokens are now `<base64url payload>.<hmac>`, so the server can read who
// the caller is and prove the payload wasn't edited, without a session
// store to keep in sync.

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Any of these is a server-only secret. AUTH_SECRET is the one to set;
// the fallbacks exist so a deployment that hasn't added it yet still gets
// working tokens rather than silently signing with a constant. Rotating
// whichever is in use invalidates outstanding tokens, which is the correct
// behaviour for a credential change.
const getSecret = () =>
  process.env.AUTH_SECRET ||
  process.env.SUPER_ADMIN_HASH ||
  process.env.ADMIN_PASSWORD ||
  null

const b64url = (buf) => Buffer.from(buf).toString('base64url')

const sign = (encodedPayload, secret) =>
  crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url')

export const createToken = (payload) => {
  const secret = getSecret()
  const body = { ...payload, issuedAt: Date.now() }
  const encoded = b64url(JSON.stringify(body))
  // Without a secret there is nothing to sign with. Emit an unsigned token
  // so sign-in still works; verifyToken rejects it, so it grants nothing.
  if (!secret) return `${encoded}.`
  return `${encoded}.${sign(encoded, secret)}`
}

// Returns the payload for a token this server issued and hasn't expired,
// or null. Never throws: a bad token is simply an anonymous caller.
export const verifyToken = (token) => {
  const secret = getSecret()
  if (!secret || typeof token !== 'string') return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const encoded = token.slice(0, dot)
  const provided = token.slice(dot + 1)
  if (!provided) return null

  const expected = sign(encoded, secret)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  let payload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload?.issuedAt || Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
    return null
  }
  return payload
}

// What the request is allowed to see. Callers with no (or an old, unsigned)
// token get the anonymous view rather than an error, so reads keep working.
export const authFromHeaders = (headers = {}) => {
  const raw =
    headers.authorization || headers.Authorization || headers.AUTHORIZATION || ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
  const payload = verifyToken(token)
  if (!payload) return { isAdmin: false, isSuperAdmin: false, playerId: null }
  return {
    isAdmin: !!payload.isAdmin,
    isSuperAdmin: !!payload.isSuperAdmin,
    playerId: payload.playerId || null,
  }
}
