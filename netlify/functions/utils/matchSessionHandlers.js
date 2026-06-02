import { getDB } from './db.js'

const COLLECTION = 'matchSessions'
const SESSION_EXPIRY_MS = 5 * 60 * 1000 // 5 minutes

const throwError = (msg) => {
  throw new Error(msg)
}

const now = () => new Date().toISOString()

const isExpired = (lastActivityAt) =>
  Date.now() - new Date(lastActivityAt).getTime() > SESSION_EXPIRY_MS

const isActive = (session) =>
  !!session && !session.takenOverByAdmin && !isExpired(session.lastActivityAt)

/**
 * Try to acquire the single active session for a match.
 * - If the existing session matches (same userId+sessionId), refresh it.
 * - If admin requests, mark any other active session as taken-over and take it.
 * - Otherwise, only allow when there is no active session.
 */
export const acquireMatchSession = async (body) => {
  if (!body?.matchId) throwError('matchId is required')
  if (!body.userId) throwError('userId is required')
  if (!body.sessionId) throwError('sessionId is required')

  const db = getDB()
  const collection = db.collection(COLLECTION)

  const current = await collection.findOne({ matchId: body.matchId })

  if (
    current &&
    isActive(current) &&
    (current.userId !== body.userId || current.sessionId !== body.sessionId)
  ) {
    if (!body.asAdmin) {
      throwError('Another user is currently playing this match')
    }
    // Admin takes over: mark the existing session as taken over.
    await collection.updateOne(
      { matchId: body.matchId },
      {
        $set: {
          takenOverByAdmin: true,
          takenOverAt: now(),
        },
      },
    )
  }

  // Insert the new (admin-takeover or fresh) session, overwriting any prior doc.
  await collection.updateOne(
    { matchId: body.matchId },
    {
      $set: {
        matchId: body.matchId,
        userId: body.userId,
        sessionId: body.sessionId,
        asAdmin: !!body.asAdmin,
        lastActivityAt: now(),
        takenOverByAdmin: false,
        takenOverAt: null,
      },
    },
    { upsert: true },
  )

  return { sessionId: body.sessionId }
}

/**
 * Heartbeat to keep the session alive.
 * Returns { takenOver: true } if an admin has taken over since the last call.
 */
export const heartbeatMatchSession = async (body) => {
  if (!body?.matchId) throwError('matchId is required')
  if (!body.sessionId) throwError('sessionId is required')

  const db = getDB()
  const collection = db.collection(COLLECTION)
  const current = await collection.findOne({ matchId: body.matchId })

  if (
    !current ||
    current.sessionId !== body.sessionId ||
    current.takenOverByAdmin
  ) {
    return { takenOver: true }
  }

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
 * Return the set of match ids that currently have an active (un-taken-over,
 * not-expired) session. Used by the live-score endpoint so all clients can
 * gate Start/Continue buttons.
 */
export const getActiveSessionMatchIds = async () => {
  const db = getDB()
  const sessions = await db.collection(COLLECTION).find({}).toArray()
  return sessions.filter(isActive).map((s) => s.matchId.toString())
}
