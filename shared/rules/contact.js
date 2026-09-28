// How an email address or phone number is recognised, and the one form each
// is kept in. Shared so the sign-up wizard, sign-in and the server agree on
// what counts as "the same" contact.

export const isValidEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value ?? '').trim())

// Emails are compared without regard to case, because people type them
// however they like and mail servers treat the local part that way too.
export const sameEmail = (a, b) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

// Canadian/US (NANP) numbers only. Every phone on file is stored as its bare
// 10 digits, so that is the canonical form: "(604) 555-1234", "604.555.1234"
// and "+1 604 555 1234" all become "6045551234". Anything that is not a
// valid NANP number comes back null.
export const normalizePhone = (value) => {
  const digits = (value ?? '').replace(/\D/g, '')
  const ten =
    digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(ten) ? ten : null
}

export const isValidPhone = (value) => normalizePhone(value) !== null

// The international form an SMS provider needs.
export const toE164 = (value) => {
  const ten = normalizePhone(value)
  return ten ? `+1${ten}` : null
}

// "604-555-1234" for showing a stored number back to the person who owns it.
export const formatPhone = (value) => {
  const ten = normalizePhone(value)
  return ten ? `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}` : value ?? ''
}
