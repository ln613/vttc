// When is a name someone types at sign-up "probably" a player already on
// file? Most players were imported from TTCan long before they made an
// account, so the person signing up is often already here — spelled a
// little differently. These are the differences that come up:
//
//   case and accents        "nan li"        ~ "Nan Li"
//   initials, punctuation   "Jimmy Zhu"     ~ "Jimmy F. Zhu"
//   spacing in a given name "Dinghao Zuo"   ~ "Ding Hao Zuo"
//   family name first       "Zhu Jimmy"     ~ "Jimmy F. Zhu"
//
// The family name has to match outright; the given name only by its first
// word. That is deliberately narrow: "Nan" does not match "Nancy", so the
// list shows people who are plausibly you, not everyone who shares a
// surname.

const normalizeName = (value) =>
  (value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const compact = (value) => normalizeName(value).replace(/ /g, '')

const firstWord = (value) => normalizeName(value).split(' ')[0] ?? ''

const sameFamilyName = (a, b) => {
  const x = compact(a)
  return x !== '' && x === compact(b)
}

const sameGivenName = (a, b) => {
  if (!normalizeName(a) || !normalizeName(b)) return false
  return compact(a) === compact(b) || firstWord(a) === firstWord(b)
}

export const isSimilarName = (typed, player) => {
  if (!typed || !player) return false
  const inOrder =
    sameFamilyName(typed.lastName, player.lastName) &&
    sameGivenName(typed.firstName, player.firstName)
  const reversed =
    sameFamilyName(typed.firstName, player.lastName) &&
    sameGivenName(typed.lastName, player.firstName)
  return inOrder || reversed
}

// The family names worth fetching candidates for: the typed last name, and
// the typed first name in case the two were entered the other way round.
export const candidateFamilyNames = (typed) =>
  [...new Set([normalizeName(typed?.lastName), normalizeName(typed?.firstName)])].filter(
    Boolean,
  )

// How a name typed at sign-up is saved: "JIMMY f." becomes "Jimmy F.".
export const toTitleCase = (value) =>
  (value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
