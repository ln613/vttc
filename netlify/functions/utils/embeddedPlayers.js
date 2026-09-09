// Events embed a snapshot of each player — in `participants[].players`, in
// every match's `side1`/`side2`, in group standings, knockout seeding and
// team order-of-play assignments. Those snapshots were copies of the whole
// player document, so event payloads carried password hashes, emails, phone
// numbers and rating histories, and shipped them to anyone who asked for
// type=events.
//
// Two field sets, because the server needs more than the browser does:
//
//   STORED  what an embedded snapshot may keep. dateOfBirth backs the age
//           limits on registration and the draw; host marks players who
//           don't pay, which the paid checks read off the snapshot.
//   PUBLIC  what may leave the API. Neither of those is any of the
//           browser's business: the client's own age check reads the
//           signed-in user, not other people's snapshots.
export const STORED_PLAYER_FIELDS = [
  '_id',
  'firstName',
  'lastName',
  'sex',
  'rating',
  'dateOfBirth',
  'host',
]

export const PUBLIC_PLAYER_FIELDS = [
  '_id',
  'firstName',
  'lastName',
  'sex',
  'rating',
]

// A player snapshot, as opposed to any other object in the tree: it has an
// _id and at least one name field. Deliberately loose — anything shaped
// like a player gets trimmed, so a snapshot taken somewhere this module
// doesn't know about is still covered.
const looksLikePlayer = (value) =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  '_id' in value &&
  ('firstName' in value || 'lastName' in value)

const pick = (player, fields) => {
  const out = {}
  for (const field of fields) {
    if (player[field] !== undefined) out[field] = player[field]
  }
  return out
}

export const toStoredPlayer = (player) =>
  looksLikePlayer(player) ? pick(player, STORED_PLAYER_FIELDS) : player

// Walk anything and trim every player snapshot inside it. Used on the way
// out, so documents written before this existed are cleaned in flight and
// the leak stops without waiting for the migration.
export const sanitizeForOutput = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeForOutput)
  if (!value || typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (looksLikePlayer(value)) return pick(value, PUBLIC_PLAYER_FIELDS)

  const out = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = sanitizeForOutput(inner)
  }
  return out
}

// Same walk, but keeping the fields the server itself needs. Used when
// writing, and by the migration.
export const sanitizeForStorage = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeForStorage)
  if (!value || typeof value !== 'object') return value
  if (value instanceof Date) return value
  if (looksLikePlayer(value)) return pick(value, STORED_PLAYER_FIELDS)

  const out = {}
  for (const [key, inner] of Object.entries(value)) {
    out[key] = sanitizeForStorage(inner)
  }
  return out
}
