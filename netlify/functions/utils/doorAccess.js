// Door codes for court bookings, from UniFi Access — see
// specs/rules/booking.md ("Door code").
//
// Each booking becomes a UniFi Access *visitor* whose visit runs from a
// little before the booking to a little after it, with a PIN assigned. The
// door opens to that PIN only inside the visit, so the code needs no
// clean-up afterwards.
//
// UniFi Access developer API (Settings → General → Advanced → API Token on
// the console), served by the console itself on port 12445:
//   POST   /api/v1/developer/visitors                  create the visitor
//   POST   /api/v1/developer/credentials/pin_codes     a fresh, unused PIN
//   PUT    /api/v1/developer/visitors/:id/pin_codes    give it to the visitor
//   DELETE /api/v1/developer/visitors/:id?is_force=true
// Every response is { code: "SUCCESS", data, msg }.
//
// Environment:
//   UNIFI_ACCESS_HOST           https://<console address>:12445 — must be
//                               reachable from Netlify, not just the club LAN
//   UNIFI_ACCESS_TOKEN          the API token
//   UNIFI_ACCESS_DOOR_IDS       comma-separated door ids, and/or
//   UNIFI_ACCESS_DOOR_GROUP_ID  a door group id
//   UNIFI_ACCESS_ALLOW_SELF_SIGNED=true   the console's own certificate is
//                               self-signed; without this it is refused
//   DOOR_ACCESS_MODE=placeholder  local development only: a made-up code
//                               when UniFi is not set up

import http from 'node:http'
import https from 'node:https'
import crypto from 'node:crypto'

const throwError = (message) => {
  throw new Error(message)
}

const env = (key) => (process.env[key] || '').trim()

const doorResources = () => [
  ...env('UNIFI_ACCESS_DOOR_IDS')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => ({ id, type: 'door' })),
  ...(env('UNIFI_ACCESS_DOOR_GROUP_ID') ? [{ id: env('UNIFI_ACCESS_DOOR_GROUP_ID'), type: 'door_group' }] : []),
]

export const isUnifiConfigured = () =>
  !!env('UNIFI_ACCESS_HOST') && !!env('UNIFI_ACCESS_TOKEN') && doorResources().length > 0

const isPlaceholderAllowed = () => env('DOOR_ACCESS_MODE') === 'placeholder'

/** Whether a booking can be given a door code at all. */
export const doorAccessAvailable = () => isUnifiConfigured() || isPlaceholderAllowed()

// ==================== the UniFi Access API ====================

const REQUEST_TIMEOUT_MS = 10000

const unifiRequest = (method, path, body) =>
  new Promise((resolve, reject) => {
    const url = new URL(path, env('UNIFI_ACCESS_HOST'))
    const client = url.protocol === 'http:' ? http : https
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = client.request(
      url,
      {
        method,
        headers: {
          Authorization: `Bearer ${env('UNIFI_ACCESS_TOKEN')}`,
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
        rejectUnauthorized: env('UNIFI_ACCESS_ALLOW_SELF_SIGNED') !== 'true',
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let text = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (text += chunk))
        res.on('end', () => {
          // Thrown here it would escape the promise and take the function down.
          try {
            resolve(readUnifiResponse(res.statusCode, text, `${method} ${url.pathname}`))
          } catch (err) {
            reject(err)
          }
        })
      },
    )
    req.on('timeout', () => req.destroy(new Error('UniFi Access did not answer in time')))
    req.on('error', (err) => reject(new Error(`UniFi Access unreachable: ${err.message}`)))
    if (payload) req.write(payload)
    req.end()
  })

const readUnifiResponse = (status, text, what) => {
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // Not JSON — reported below with the status.
  }
  if (status >= 200 && status < 300 && json?.code === 'SUCCESS') return json.data
  throwError(`UniFi Access ${what} failed (${status}): ${json?.msg || json?.code || text.slice(0, 200)}`)
}

const toUnixSeconds = (date) => Math.floor(date.getTime() / 1000)

const createVisitor = (visit) =>
  unifiRequest('POST', '/api/v1/developer/visitors', {
    first_name: visit.firstName || 'Guest',
    last_name: visit.lastName || 'Booking',
    remarks: visit.remarks || '',
    ...(visit.phone ? { mobile_phone: visit.phone } : {}),
    ...(visit.email ? { email: visit.email } : {}),
    visit_reason: 'Others',
    start_time: toUnixSeconds(visit.validFrom),
    end_time: toUnixSeconds(visit.validUntil),
    resources: doorResources(),
  })

const generatePin = () => unifiRequest('POST', '/api/v1/developer/credentials/pin_codes')

const assignPin = (visitorId, pin) =>
  unifiRequest('PUT', `/api/v1/developer/visitors/${encodeURIComponent(visitorId)}/pin_codes`, { pin_code: pin })

const deleteVisitor = (visitorId) =>
  unifiRequest('DELETE', `/api/v1/developer/visitors/${encodeURIComponent(visitorId)}?is_force=true`)

// A visitor left without a PIN would only clutter the console; removing it
// is best effort, and its failure must not hide the error that matters.
const discardVisitor = async (visitorId) => {
  try {
    await deleteVisitor(visitorId)
  } catch {
    // ignored
  }
}

const issueUnifiCode = async (visit) => {
  const visitor = await createVisitor(visit)
  if (!visitor?.id) throwError('UniFi Access created no visitor')
  try {
    const pin = await generatePin()
    if (!pin) throwError('UniFi Access gave no PIN code')
    await assignPin(visitor.id, String(pin))
    return { code: String(pin), visitorId: visitor.id, provider: 'unifi' }
  } catch (err) {
    await discardVisitor(visitor.id)
    throw err
  }
}

// ==================== issuing a code ====================

const issuePlaceholderCode = () => ({
  code: String(crypto.randomInt(0, 1000000)).padStart(6, '0'),
  visitorId: null,
  provider: 'placeholder',
})

const validateVisit = (visit) => {
  if (!visit) throwError('Visit is required')
  if (!(visit.validFrom instanceof Date) || !(visit.validUntil instanceof Date)) {
    throwError('Visit times are required')
  }
  if (visit.validUntil <= visit.validFrom) throwError('Visit must end after it starts')
}

/**
 * Stops a door code working: its UniFi visitor is deleted. A placeholder
 * code has nothing to remove. Throws when UniFi refuses.
 */
export const revokeDoorCode = async (doorCode) => {
  if (doorCode?.provider !== 'unifi' || !doorCode.visitorId) return
  if (!isUnifiConfigured()) throwError('Door access is not set up')
  await deleteVisitor(doorCode.visitorId)
}

/**
 * A door code that works from visit.validFrom to visit.validUntil.
 * visit: { firstName, lastName, email, phone, remarks, validFrom, validUntil }
 * Returns { code, visitorId, provider, validFrom, validUntil }.
 */
export const issueDoorCode = async (visit) => {
  validateVisit(visit)
  if (!doorAccessAvailable()) throwError('Door access is not set up')
  const issued = isUnifiConfigured() ? await issueUnifiCode(visit) : issuePlaceholderCode()
  return { ...issued, validFrom: visit.validFrom, validUntil: visit.validUntil }
}
