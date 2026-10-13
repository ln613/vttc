// Card payments through Moneris Checkout (MCO) — see payments.js and
// specs/rules/booking.md ("Card payment").
//
// The card form is Moneris's own, embedded in the page, so card details
// never reach this server:
//   1. preload  — this server asks Moneris for a one-time ticket for the
//                 amount; the browser opens the form with it
//   2. receipt  — once the browser reports the form finished, this server
//                 asks Moneris how it went, and only an approved receipt for
//                 the right order and amount counts as paid
// Both are server-to-server JSON POSTs to /chktv2/request/request.php; every
// response is { response: { success: "true" | "false", ... } }.
//
// Environment:
//   MONERIS_STORE_ID      the store (test: from the test Merchant Resource
//                         Center; live: the club's store)
//   MONERIS_API_TOKEN     the store's API token (Admin → Store Settings)
//   MONERIS_CHECKOUT_ID   the Moneris Checkout profile (Admin → Moneris
//                         Checkout Config)
//   MONERIS_ENVIRONMENT   "qa" (test, the default) or "prod" (live)

const throwError = (message) => {
  throw new Error(message)
}

const env = (key) => (process.env[key] || '').trim()

const REQUEST_TIMEOUT_MS = 15000

const HOSTS = {
  qa: 'https://gatewayt.moneris.com',
  prod: 'https://gateway.moneris.com',
}

/** "qa" (test) unless the site is set to take live payments. */
export const monerisEnvironment = () =>
  env('MONERIS_ENVIRONMENT') === 'prod' ? 'prod' : 'qa'

export const isMonerisConfigured = () =>
  !!env('MONERIS_STORE_ID') && !!env('MONERIS_API_TOKEN') && !!env('MONERIS_CHECKOUT_ID')

/** The browser's checkout script, for the same environment. */
export const monerisScriptUrl = () =>
  `${HOSTS[monerisEnvironment()]}/chktv2/js/chkt_v2.00.js`

const credentials = () => ({
  store_id: env('MONERIS_STORE_ID'),
  api_token: env('MONERIS_API_TOKEN'),
  checkout_id: env('MONERIS_CHECKOUT_ID'),
  environment: monerisEnvironment(),
})

const monerisRequest = async (body) => {
  const res = await fetch(`${HOSTS[monerisEnvironment()]}/chktv2/request/request.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ ...credentials(), ...body }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const data = await res.json().catch(() => null)
  const response = data?.response
  if (!res.ok || !response) throwError(`Moneris did not answer (HTTP ${res.status})`)
  return response
}

// Moneris errors come as { field, message } or { <field>: { message } }.
const describeError = (response) => {
  const error = response?.error
  if (!error) return 'unknown error'
  if (typeof error === 'string') return error
  if (error.field || error.message) return `${error.field || 'error'}: ${error.message || ''}`
  return Object.entries(error)
    .map(([field, detail]) => `${field}: ${detail?.message || JSON.stringify(detail)}`)
    .join('; ')
}

// Moneris amounts are dollars with two decimals.
const toAmount = (amountCents) => (amountCents / 100).toFixed(2)
const toCents = (amount) => Math.round(Number(amount) * 100)

/**
 * A ticket for the card form: `orderNo` must be unique for the store (a
 * second ticket for the same payment gets a new one), `language` "en" or
 * "fr" — the form's languages.
 */
export const preloadCheckout = async ({ amountCents, orderNo, language = 'en' }) => {
  if (!isMonerisConfigured()) throwError('Card payments are not set up')
  if (!Number.isInteger(amountCents) || amountCents <= 0) throwError('Invalid amount')
  if (!orderNo) throwError('Order number is required')
  const response = await monerisRequest({
    action: 'preload',
    txn_total: toAmount(amountCents),
    order_no: orderNo,
    language,
  })
  if (response.success !== 'true' || !response.ticket) {
    // The detail is for whoever sets the site up, not for the person paying.
    console.error(`Moneris preload refused (${orderNo}): ${describeError(response)}`)
    throwError('Card payments are not working right now. Please try again later or contact the club.')
  }
  return { ticket: response.ticket }
}

/**
 * How a ticket's payment went. Approved only when Moneris accepted it, for
 * this order and exactly this amount.
 */
export const checkoutReceipt = async ({ ticket, orderNo, amountCents }) => {
  if (!ticket) throwError('Ticket is required')
  const response = await monerisRequest({ action: 'receipt', ticket })
  const receipt = response.receipt
  const cc = receipt?.cc || {}
  const details = {
    result: receipt?.result || null,
    orderNo: cc.order_no || null,
    amountCents: cc.amount != null ? toCents(cc.amount) : null,
    approvalCode: cc.approval_code || null,
    referenceNo: cc.reference_no || null,
    responseCode: cc.response_code || null,
    cardType: cc.card_type || null,
    last4: cc.first6last4 ? String(cc.first6last4).slice(-4) : null,
    transactionNo: cc.transaction_no || null,
  }
  const approved =
    response.success === 'true' &&
    details.result === 'a' &&
    details.orderNo === orderNo &&
    details.amountCents === amountCents
  return { approved, details, error: approved ? null : describeError(response) }
}
