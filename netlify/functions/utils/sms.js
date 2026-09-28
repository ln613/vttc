// Phone verification, through Twilio Verify.
//
// Verify generates the code, texts it, keeps it, expires it and limits the
// attempts itself, so unlike an emailed code there is nothing of ours to
// store between sending and checking. It is called over plain HTTPS rather
// than through Twilio's SDK, which is large for two requests.
//
// Needs, per club site:
//   TWILIO_ACCOUNT_SID          ACxxxxxxxx
//   TWILIO_AUTH_TOKEN
//   TWILIO_VERIFY_SERVICE_SID   VAxxxxxxxx  (Console > Verify > Services)
// Without all three, sign-up by phone is simply unavailable: the wizard
// hides the option (see smsEnabled in settingsHandlers) and the endpoints
// refuse it.

const VERIFY_BASE = 'https://verify.twilio.com/v2/Services'

const readConfig = () => ({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID,
})

export const isSmsConfigured = () => {
  const c = readConfig()
  return !!(c.accountSid && c.authToken && c.serviceSid)
}

const throwError = (message) => {
  throw new Error(message)
}

// Twilio's codes for the failures a person can do something about; the rest
// are ours to fix, not theirs, and get a generic message.
// https://www.twilio.com/docs/api/errors
const FRIENDLY_ERRORS = {
  60200: 'That phone number is not valid',
  60203: 'Too many codes sent to this number. Please try again later.',
  60202: 'Too many wrong codes. Please request a new one.',
  60410: 'Texts to this number are blocked. Please sign up with email instead.',
}

const describeError = (data) =>
  FRIENDLY_ERRORS[data?.code] || 'Could not send a text right now. Please try again.'

const callVerify = async (path, params) => {
  if (!isSmsConfigured()) throwError('Sign up by phone is not available yet')
  const c = readConfig()
  const auth = Buffer.from(`${c.accountSid}:${c.authToken}`).toString('base64')

  const response = await fetch(`${VERIFY_BASE}/${c.serviceSid}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  })
  const data = await response.json().catch(() => ({}))
  return { ok: response.ok, status: response.status, data }
}

// `e164` is "+1XXXXXXXXXX" — see toE164 in shared/rules/contact.js.
export const sendSmsCode = async (e164) => {
  if (!e164) throwError('A phone number is required')
  const { ok, data } = await callVerify('Verifications', { To: e164, Channel: 'sms' })
  if (!ok) {
    console.error('Twilio Verify send failed', data?.code, data?.message)
    throwError(describeError(data))
  }
}

// True when the code is right. A 404 means there is no code pending for the
// number any more — expired, already used, or locked after too many tries —
// which is a wrong answer, not a fault.
export const checkSmsCode = async (e164, code) => {
  if (!e164) throwError('A phone number is required')
  if (!code) throwError('Verification code is required')
  const { ok, status, data } = await callVerify('VerificationCheck', {
    To: e164,
    Code: String(code).trim(),
  })
  if (status === 404) return false
  if (!ok) {
    console.error('Twilio Verify check failed', data?.code, data?.message)
    throwError(describeError(data))
  }
  return data?.status === 'approved'
}
