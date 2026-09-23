// A stable id for this browser, used to tell one tablet from another.
//
// Two tablets on a table sign in as the same club account, so an account id
// cannot distinguish "the other tablet joining" from "this tablet coming
// back after a reload" — and the difference decides whether the umpire is
// asked to pick a role. This survives reloads, which an account id cannot
// disambiguate and a per-page id would lose.
const STORAGE_KEY = 'vttc.deviceId'

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Private windows, blocked site data and older WebViews can all throw on
// access, so every read and write is guarded and a device that cannot
// remember simply forgets. That is the behaviour these callers had before
// they remembered anything, not a new failure.
export const readLocal = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Nothing to do — the caller works without it.
  }
}

export const removeLocal = (key: string) => {
  try {
    localStorage.removeItem(key)
  } catch {
    // As above.
  }
}

// A device that cannot store falls back to an id for this page, which
// behaves as a fresh device on every reload.
let fallbackId: string | null = null

export const getDeviceId = (): string => {
  const stored = readLocal(STORAGE_KEY)
  if (stored) return stored
  if (fallbackId) return fallbackId

  const created = newId()
  writeLocal(STORAGE_KEY, created)
  // Only trusted back if it actually stuck; otherwise this page keeps it.
  if (readLocal(STORAGE_KEY) !== created) fallbackId = created
  return created
}
