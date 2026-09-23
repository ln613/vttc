import { getDB, toObjectId } from './db.js'

const COLLECTION = 'matchSessions'
const SESSION_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

// A match is normally run by one device. With Tablet Mirror enabled for the
// event it is run by two — a Scorer facing the umpire and a display-only
// Mirror facing the players — so a session is keyed by (matchId, role)
// rather than by matchId alone. See specs/rules/tablet mirror.md.
export const SCORER = 'scorer'
export const MIRROR = 'mirror'
const SINGLE_ROLES = [SCORER]
const PAIRED_ROLES = [SCORER, MIRROR]

const throwError = (msg) => {
  throw new Error(msg)
}

const now = () => new Date().toISOString()

const isExpired = (lastActivityAt) =>
  Date.now() - new Date(lastActivityAt).getTime() > SESSION_EXPIRY_MS

const isActive = (session) =>
  !!session && !session.takenOverByAdmin && !isExpired(session.lastActivityAt)

// Documents written before roles existed have no `role`; they are the
// scorer, which is the only thing they could have been.
const roleOf = (session) => session?.role || SCORER

// The two tablets on a table sign in as the same club account, so the
// account cannot tell them apart — the device can. Older clients send no
// device id, and fall back to the account as before.
const isSameHolder = (session, body) =>
  body.deviceId
    ? session.deviceId === body.deviceId
    : session.userId === body.userId

const rolesFor = (mirrorEnabled) => (mirrorEnabled ? PAIRED_ROLES : SINGLE_ROLES)

const findSessions = async (collection, matchId) =>
  (await collection.find({ matchId }).toArray()).filter(isActive)

/**
 * Try to acquire a session for a match.
 *
 * - Same holder coming back (same userId + role): refresh it.
 * - Mirror enabled and no role asked for: take the only free role, or ask
 *   the caller to choose when both are free.
 * - Admin: takes over every session on the match and scores alone.
 * - Otherwise: only when the requested role is free.
 */
export const acquireMatchSession = async (body, auth) => {
  validateAcquireInput(body)

  const db = getDB()
  const collection = db.collection(COLLECTION)
  const active = await findSessions(collection, body.matchId)
  const mirrorEnabled = await readEventMirrorSetting(db, body.eventId)

  // Only a tablet can be either half of a pair. An admin or a public umpire
  // is a person who came to run the match, on their own device, and cannot
  // feed a Mirror anything — so they take the table whole, and a Mirror
  // already there goes with the rest. Leaving it would leave a screen in
  // front of the players showing a match nobody is sending it.
  if (!auth?.isTablet) return enterAlone(collection, body, active)

  // The Mirror seat only exists while the Scorer seat is empty or held by
  // something that can feed it. A non-tablet records no mirror on its
  // session (enterAlone), so a tablet arriving behind one is turned away
  // rather than left staring at a screen nobody is sending anything to.
  const scorer = active.find(
    (sn) => !isSameHolder(sn, body) && roleOf(sn) === SCORER,
  )
  const pairable = !scorer || scorer.mirrorEnabled !== false
  const offered = pairable ? rolesFor(mirrorEnabled) : SINGLE_ROLES

  // Only the name is checked here; whether the seat is free, or exists at
  // all on this table, is decided below.
  const role = body.role || undefined
  if (role && !rolesFor(mirrorEnabled).includes(role)) {
    throwError(`Unknown role "${role}"`)
  }

  // What this device already had, if it is coming back, and what other
  // devices are holding.
  const mine = active.find((s) => isSameHolder(s, body))
  const takenByOthers = active
    .filter((s) => !isSameHolder(s, body))
    .map(roleOf)
  const free = offered.filter((r) => !takenByOthers.includes(r))

  // A reload is not a new entry: this device takes its own role back
  // without being asked to choose again.
  const previous = mine && roleOf(mine)
  const wanted =
    role || (previous && free.includes(previous) ? previous : undefined)

  // Only the first device on a table has anything to choose between.
  if (!wanted && free.length > 1) return { needsRole: true, availableRoles: free }

  // One refusal, so whoever is turned away is told the actual reason —
  // which depends on what they asked for, not on what was left.
  const taking = wanted || free[0]
  if (!taking || !free.includes(taking)) {
    throwError(refusalReason(role, pairable))
  }

  await writeSession(collection, body, taking, false, mirrorEnabled)
  // A role is only meaningful on a paired table. Saying nothing on an
  // ordinary one keeps the tablet in exactly its old behaviour.
  return { sessionId: body.sessionId, role: mirrorEnabled ? taking : undefined }
}

const refusalReason = (requested, pairable) => {
  if (requested !== MIRROR) return 'Another user is currently umpiring this match'
  return pairable
    ? 'The mirror tablet is already in use'
    : 'The umpire on this table is not using a mirror'
}

const validateAcquireInput = (body) => {
  if (!body?.matchId) throwError('matchId is required')
  if (!body.userId) throwError('userId is required')
  if (!body.sessionId) throwError('sessionId is required')
}

// Anyone who is not a tablet runs the table alone: they score, and every
// other device on the match is told it has been taken over.
//
// Taking over a Scorer is an admin's privilege — a public umpire arriving
// at an occupied table is turned away, exactly as before pairing existed.
// A Mirror blocks nobody, but it is displaced all the same, because there
// will be nothing to send it.
//
// The session records no mirror, so the table reads as full and no tablet
// joins a Mirror seat that could never show anything.
const enterAlone = async (collection, body, active) => {
  const others = active.filter((s) => !isSameHolder(s, body))
  const scorerTaken = others.some((s) => roleOf(s) === SCORER)
  if (scorerTaken && !body.asAdmin) {
    throwError('Another user is currently umpiring this match')
  }

  if (others.length > 0) {
    await collection.updateMany(
      { matchId: body.matchId, sessionId: { $in: others.map((s) => s.sessionId) } },
      { $set: { takenOverByAdmin: true, takenOverAt: now() } },
    )
  }

  await writeSession(collection, body, SCORER, !!body.asAdmin, false)
  return { sessionId: body.sessionId }
}

// Asked of the event itself rather than taken from the caller: the client
// learns this from live-score data, which is a cache and can be a rebuild
// behind. A wrong answer here would silently close a table to its second
// tablet, so it is read straight from the source — one tiny projected read,
// once per tablet per match.
const readEventMirrorSetting = async (db, eventId) => {
  if (!eventId) return false
  const event = await db
    .collection('events')
    .findOne({ _id: toObjectId(eventId) }, { projection: { tabletMirrorEnabled: 1 } })
  return !!event?.tabletMirrorEnabled
}

const writeSession = async (collection, body, role, asAdmin, mirrorEnabled) => {
  // A session written before roles existed carries no `role`, so the
  // upsert below would not match it and would leave two scorer documents
  // behind. It can only ever have been a scorer, and the caller has
  // already established that the scorer slot is free, so it goes.
  if (role === SCORER) {
    await collection.deleteMany({
      matchId: body.matchId,
      role: { $exists: false },
    })
  }

  await collection.updateOne(
    { matchId: body.matchId, role },
    {
      $set: {
        matchId: body.matchId,
        role,
        userId: body.userId,
        deviceId: body.deviceId || null,
        sessionId: body.sessionId,
        asAdmin,
        // Remembered so "is this match full?" can be answered from the
        // sessions alone, with nothing else to go stale.
        mirrorEnabled: !!mirrorEnabled,
        lastActivityAt: now(),
        takenOverByAdmin: false,
        takenOverAt: null,
      },
    },
    { upsert: true },
  )
}

/**
 * Heartbeat to keep the session alive.
 * Returns { takenOver: true } if the session is no longer the live one.
 */
export const heartbeatMatchSession = async (body) => {
  if (!body?.matchId) throwError('matchId is required')
  if (!body.sessionId) throwError('sessionId is required')

  const db = getDB()
  const collection = db.collection(COLLECTION)
  const current = await collection.findOne({
    matchId: body.matchId,
    sessionId: body.sessionId,
  })

  if (!current || current.takenOverByAdmin) return { takenOver: true }

  await collection.updateOne(
    { matchId: body.matchId, sessionId: body.sessionId },
    { $set: { lastActivityAt: now() } },
  )
  return { takenOver: false }
}

/**
 * Release the current session (called on close / unmount).
 */
export const releaseMatchSession = async (body) => {
  if (!body?.matchId) throwError('matchId is required')
  if (!body.sessionId) throwError('sessionId is required')

  const db = getDB()
  await db.collection(COLLECTION).deleteOne({
    matchId: body.matchId,
    sessionId: body.sessionId,
  })
  return { success: true }
}

/**
 * Match ids with no room for another device — every role taken. Used by the
 * live-score endpoint so the table picker and the Umpire button can grey out
 * a table that is already fully manned. A match whose Mirror slot is still
 * free is NOT in this list: a second tablet may still join it.
 */
export const getMatchSessionSummary = async () => {
  const db = getDB()
  const sessions = (await db.collection(COLLECTION).find({}).toArray()).filter(isActive)

  const byMatch = new Map()
  for (const session of sessions) {
    const id = session.matchId.toString()
    if (!byMatch.has(id)) byMatch.set(id, { taken: new Set(), paired: false })
    const entry = byMatch.get(id)
    entry.taken.add(roleOf(session))
    if (session.mirrorEnabled) entry.paired = true
  }

  // `full` decides whether a table can take anyone at all; `scorerHeld`
  // decides whether it can take someone who can only be a Scorer. They
  // are the same thing on a table that is not running a pair.
  const full = []
  const scorerHeld = []
  for (const [matchId, { taken, paired }] of byMatch) {
    if (rolesFor(paired).every((role) => taken.has(role))) full.push(matchId)
    if (taken.has(SCORER)) scorerHeld.push(matchId)
  }
  return { full, scorerHeld }
}
