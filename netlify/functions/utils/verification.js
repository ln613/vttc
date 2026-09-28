// Proving you own an email address or phone number before it becomes your
// sign-in.
//
// Codes used to live in a Map in the function's memory. On Lambda that is
// per instance: the request that sent a code and the one that checked it
// could land on different instances, and the check then failed with "no code
// found" for no reason the user could see. And nothing stopped a sign-up
// that had never verified anything, because signUp took the client's word
// for it. Now:
//
//   - the state lives in MongoDB, in one document per (channel, address)
//   - a correct code is exchanged for a short-lived signed token naming the
//     address that was proved, and signUp takes the address from that token
//     rather than from the request body
//
// Emailed codes are generated, stored (hashed) and checked here. Texted codes
// are generated and checked by Twilio Verify (sms.js); the document then only
// carries the resend cooldown and the daily cap, which cost money to skip.

import crypto from 'node:crypto'
import { getDB } from './db.js'
import { createToken, verifyToken } from './authToken.js'
import { sendVerificationEmail } from './email.js'
import { sendSmsCode, checkSmsCode, isSmsConfigured } from './sms.js'
import { isValidEmail, normalizePhone, toE164 } from '../../../shared/rules/contact.js'

const COLLECTION = 'verifications'

export const RESEND_COOLDOWN_SECONDS = 60
const CODE_TTL_MS = 10 * 60 * 1000
const MAX_WRONG_ATTEMPTS = 5
const MAX_SENDS_PER_DAY = 10
const DAY_MS = 24 * 60 * 60 * 1000
// How long a proved address stays good for finishing sign-up. Long enough to
// fill in the rest of the wizard at a leisurely pace; short enough that a
// token left lying around is soon worthless.
const VERIFIED_TOKEN_TTL_MS = 30 * 60 * 1000
const VERIFIED_PURPOSE = 'verified-contact'

export const CHANNELS = ['email', 'phone']

const throwError = (message) => {
  throw new Error(message)
}

// ==================== addresses ====================

// The one form an address is kept and compared in. Emails keep the case they
// were typed in (sign-in matches them exactly), trimmed; phones are their
// bare 10 digits, as every phone on file already is.
export const normalizeAddress = (channel, value) => {
  if (channel === 'email') {
    const email = (value ?? '').trim()
    return isValidEmail(email) ? email : null
  }
  if (channel === 'phone') return normalizePhone(value)
  return null
}

// The key a document is stored under. Emails are keyed case-insensitively so
// "Nan@x.com" and "nan@x.com" share one cooldown and one code.
const keyOf = (channel, address) =>
  channel === 'email' ? address.toLowerCase() : address

export const validateChannel = (channel) => {
  if (!CHANNELS.includes(channel)) throwError('Choose email or phone')
  if (channel === 'phone' && !isSmsConfigured()) {
    throwError('Sign up by phone is not available yet')
  }
}

// ==================== storage ====================

let indexesReady = false

// The document outlives its code: it has to remember the day's sends for a
// full day, so the TTL follows the send window, and the code carries its own
// expiry. Created once per warm instance; createIndex is a no-op when the
// index already exists.
const ensureIndexes = async (collection) => {
  if (indexesReady) return
  await collection.createIndex({ channel: 1, key: 1 }, { unique: true })
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  indexesReady = true
}

const getCollection = async () => {
  const collection = getDB().collection(COLLECTION)
  await ensureIndexes(collection)
  return collection
}

const hashCode = (channel, key, code) =>
  crypto.createHash('sha256').update(`${channel}:${key}:${code}`).digest('hex')

const generateCode = () => crypto.randomInt(100000, 1000000).toString()

// ==================== sending ====================

const secondsUntilResend = (doc, now) => {
  if (!doc?.lastSentAt) return 0
  const elapsed = (now - new Date(doc.lastSentAt).getTime()) / 1000
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed))
}

const isNewWindow = (doc, now) =>
  !doc?.windowStart || now - new Date(doc.windowStart).getTime() >= DAY_MS

const validateCanSend = (doc, now) => {
  const wait = secondsUntilResend(doc, now)
  if (wait > 0) throwError(`Please wait ${wait}s before requesting another code`)
  if (!isNewWindow(doc, now) && (doc.sendCount ?? 0) >= MAX_SENDS_PER_DAY) {
    throwError('Too many codes requested today. Please try again tomorrow.')
  }
}

const deliverCode = async (channel, address) => {
  if (channel === 'phone') {
    await sendSmsCode(toE164(address))
    return null // Twilio keeps the code
  }
  const code = generateCode()
  await sendVerificationEmail(address, code)
  return code
}

// Sends a code, enforcing the cooldown and the daily cap on the server, where
// they cannot be skipped by reloading the page.
export const sendCode = async (channel, address) => {
  const collection = await getCollection()
  const key = keyOf(channel, address)
  const now = Date.now()

  const existing = await collection.findOne({ channel, key })
  validateCanSend(existing, now)

  // Delivered before it is recorded: if the send fails, nothing is stored
  // and the person can try again straight away rather than sit out a
  // cooldown for a message that never arrived.
  const code = await deliverCode(channel, address)

  const freshWindow = isNewWindow(existing, now)
  const windowStart = freshWindow ? new Date(now) : new Date(existing.windowStart)
  await collection.updateOne(
    { channel, key },
    {
      $set: {
        channel,
        key,
        codeHash: code ? hashCode(channel, key, code) : null,
        codeExpiresAt: new Date(now + CODE_TTL_MS),
        wrongAttempts: 0,
        lastSentAt: new Date(now),
        windowStart,
        sendCount: freshWindow ? 1 : (existing.sendCount ?? 0) + 1,
        expiresAt: new Date(windowStart.getTime() + DAY_MS),
      },
    },
    { upsert: true },
  )

  return { resendIn: RESEND_COOLDOWN_SECONDS }
}

// ==================== checking ====================

const checkEmailCode = async (collection, key, code) => {
  const doc = await collection.findOne({ channel: 'email', key })
  if (!doc?.codeHash) throwError('No code has been sent. Please request one.')
  if (Date.now() > new Date(doc.codeExpiresAt).getTime()) {
    throwError('That code has expired. Please request a new one.')
  }
  if ((doc.wrongAttempts ?? 0) >= MAX_WRONG_ATTEMPTS) {
    throwError('Too many wrong codes. Please request a new one.')
  }

  if (hashCode('email', key, String(code).trim()) !== doc.codeHash) {
    await collection.updateOne({ channel: 'email', key }, { $inc: { wrongAttempts: 1 } })
    throwError('That code is not right')
  }

  // Single use: a code that has been accepted cannot be accepted again.
  await collection.updateOne({ channel: 'email', key }, { $set: { codeHash: null } })
}

const checkPhoneCode = async (address, code) => {
  const approved = await checkSmsCode(toE164(address), code)
  if (!approved) throwError('That code is not right, or it has expired')
}

// Checks the code and, when it is right, hands back a token proving the
// address. The token is the only thing signUp will accept as proof.
export const checkCode = async (channel, address, code) => {
  if (!code || !String(code).trim()) throwError('Verification code is required')
  if (channel === 'phone') {
    await checkPhoneCode(address, code)
  } else {
    const collection = await getCollection()
    await checkEmailCode(collection, keyOf(channel, address), code)
  }
  return createVerifiedContactToken({ channel, address })
}

// Proof that someone owns an address. A code proves it (checkCode); so does a
// Google account whose email Google has verified (googleSignIn), in which
// case the token also carries the Google account id, which signUp records so
// the next Google sign-in finds this account.
export const createVerifiedContactToken = ({ channel, address, googleId }) =>
  createToken({
    purpose: VERIFIED_PURPOSE,
    channel,
    address,
    ...(googleId ? { googleId } : {}),
  })

// The address a verification token proves, or an error. A token is good for
// VERIFIED_TOKEN_TTL_MS, far shorter than a sign-in token, and only for this.
export const readVerifiedContact = (token) => {
  const payload = verifyToken(token)
  const fresh =
    payload && Date.now() - payload.issuedAt <= VERIFIED_TOKEN_TTL_MS
  if (!fresh || payload.purpose !== VERIFIED_PURPOSE) {
    throwError('Your verification has expired. Please verify again.')
  }
  const address = normalizeAddress(payload.channel, payload.address)
  if (!address) throwError('Your verification has expired. Please verify again.')
  return { channel: payload.channel, address, googleId: payload.googleId || null }
}
