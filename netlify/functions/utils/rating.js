// Rating update logic — see specs/rules/rating update.md (version TT-CAN-1).
// Integer ratings; the change depends on the rating gap between winner and
// loser. Big favourite wins → small change; upset → big change.
import { getDB, toObjectId } from './db.js'

const PLAYERS_COLLECTION = 'players'
const EVENTS_COLLECTION = 'events'

// ==================== TT-CAN-1 ====================

const RDELTA = [401, 301, 201, 151, 101, 51, 26, -24, -49, -99, -149, -199, -299, -399]
const RDIFF = [
  [3, 0], [5, -2], [8, -5], [10, -7], [13, -9], [15, -11], [18, -14], [20, -16],
  [25, -21], [30, -26], [35, -31], [40, -36], [45, -41], [50, -45], [55, -50],
]

// Map a rating gap (winner − loser) to an index into RDIFF. The first
// threshold the gap meets wins; a gap below every threshold (d < -399)
// falls into the last bucket (index 14), NOT the 13th.
export const findRatingDeltaIndex = (d) => {
  for (let i = 0; i < RDELTA.length; i++) if (d >= RDELTA[i]) return i
  return RDELTA.length
}

// Apply match results to a { playerId: rating } map, sequentially and
// cumulatively. Ties/incomplete and unknown players are skipped.
export const applyRatingUpdates = (ratings, matches) => {
  const out = { ...ratings }
  for (const m of matches || []) {
    if (!m || m.winnerId == null || m.loserId == null) continue // tie / incomplete
    const wr = out[m.winnerId]
    const lr = out[m.loserId]
    if (wr == null || lr == null) continue // unknown player
    const [gain, loss] = RDIFF[findRatingDeltaIndex(wr - lr)]
    out[m.winnerId] = wr + gain
    out[m.loserId] = lr + loss
  }
  return out
}

// ==================== GATHER MATCHES ====================

const throwError = (m) => {
  throw new Error(m)
}

const playerName = (p) =>
  p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : ''

// Walk every match/sub-match in an event, calling `fn(match)`. Team parents
// recurse into sub-matches (the parent itself is not a rating match).
const walkMatches = (event, fn) => {
  const walk = (m) => {
    if (!m) return
    if (Array.isArray(m.subMatches) && m.subMatches.length > 0) {
      for (const sub of m.subMatches) walk(sub)
      return
    }
    fn(m)
  }
  for (const stage of event.eventStages || []) {
    if (stage.type === 'group') {
      for (const group of stage.groups || []) for (const m of group.matches || []) walk(m)
    } else if (stage.type === 'knockout') {
      for (const round of stage.rounds || []) for (const km of round.matches || []) walk(km.match)
    }
  }
}

// A match feeds the rating only when it has a decisive winner, exactly one
// player per side (singles), and hasn't been rated yet.
const unratedSinglesResult = (m) => {
  if (!m || m.rated === true) return null
  if (m.winningSide !== 1 && m.winningSide !== 2) return null
  const s1 = m.side1 || []
  const s2 = m.side2 || []
  if (s1.length !== 1 || s2.length !== 1) return null
  const winner = m.winningSide === 1 ? s1[0] : s2[0]
  const loser = m.winningSide === 1 ? s2[0] : s1[0]
  const winnerId = winner?._id?.toString()
  const loserId = loser?._id?.toString()
  if (!winnerId || !loserId) return null
  return { winnerId, loserId }
}

// ==================== HANDLERS ====================

// Apply ratings to every un-rated confirmed singles match, ordered by
// confirmed time, one by one (cumulative). Each rated match records the
// before/change/after for both players and is flagged `rated` so it's never
// counted twice. Player ratings are persisted.
export const updateRatings = async () => {
  const db = getDB()

  const players = await db.collection(PLAYERS_COLLECTION).find({}).toArray()
  const ratings = {}
  for (const p of players) {
    if (typeof p.rating === 'number') ratings[p._id.toString()] = p.rating
  }

  const events = await db.collection(EVENTS_COLLECTION).find({}).toArray()

  // Collect un-rated singles results with a handle back to their match
  // object and event, plus the confirmed time for ordering.
  const items = []
  for (const event of events) {
    if (event.simulated === true) continue // exclude test/simulated events
    walkMatches(event, (m) => {
      const res = unratedSinglesResult(m)
      if (res) {
        items.push({
          match: m,
          event,
          confirmedAt: m.confirmedAt || event.date || '',
          ...res,
        })
      }
    })
  }
  // Order un-rated matches by confirmed time, then apply one by one.
  items.sort((a, b) => String(a.confirmedAt).localeCompare(String(b.confirmedAt)))

  const changedEvents = new Set()
  let applied = 0
  for (const it of items) {
    const wr = ratings[it.winnerId]
    const lr = ratings[it.loserId]
    if (wr == null || lr == null) continue // unknown player — leave un-rated
    const [gain, loss] = RDIFF[findRatingDeltaIndex(wr - lr)]
    const wa = wr + gain
    const la = lr + loss
    ratings[it.winnerId] = wa
    ratings[it.loserId] = la
    it.match.rated = true
    it.match.ratingInfo = {
      winnerId: it.winnerId, winnerBefore: wr, winnerChange: gain, winnerAfter: wa,
      loserId: it.loserId, loserBefore: lr, loserChange: loss, loserAfter: la,
    }
    changedEvents.add(it.event)
    applied++
  }

  for (const ev of changedEvents) {
    await db
      .collection(EVENTS_COLLECTION)
      .updateOne({ _id: ev._id }, { $set: { eventStages: ev.eventStages } })
  }

  const now = new Date().toISOString()
  const ops = []
  for (const p of players) {
    const id = p._id.toString()
    const after = ratings[id]
    if (after != null && after !== p.rating) {
      ops.push({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: { rating: after },
            $push: {
              ratingHistory: { rating: after, previousRating: p.rating ?? 0, changedAt: now },
            },
          },
        },
      })
    }
  }
  if (ops.length > 0) await db.collection(PLAYERS_COLLECTION).bulkWrite(ops)

  return { success: true, matchesRated: applied, playersUpdated: ops.length }
}

// A player's rated match history, newest confirmed first. Each row carries
// the winner/loser names + rating breakdown and the game scores so the
// History page can render the result.
export const getPlayerHistory = async (params) => {
  if (!params || !params._id) throwError('Player ID is required')
  const pid = params._id.toString()
  const db = getDB()

  const player = await db.collection(PLAYERS_COLLECTION).findOne({ _id: toObjectId(pid) })
  const events = await db.collection(EVENTS_COLLECTION).find({}).toArray()

  const rows = []
  for (const event of events) {
    if (event.simulated === true) continue // exclude test/simulated events
    const eventLabel = [event.eventSeries, event.eventName].filter(Boolean).join(' - ')
    walkMatches(event, (m) => {
      const ri = m.ratingInfo
      if (!m.rated || !ri) return
      if (ri.winnerId !== pid && ri.loserId !== pid) return
      const s1 = m.side1 || []
      const s2 = m.side2 || []
      const winner = m.winningSide === 1 ? s1[0] : s2[0]
      const loser = m.winningSide === 1 ? s2[0] : s1[0]
      rows.push({
        date: m.confirmedAt || event.date || '',
        event: eventLabel,
        winningSide: m.winningSide,
        games: (m.games || []).map((g) => ({
          score1: g.score1, score2: g.score2, winningSide: g.winningSide,
        })),
        winner: {
          name: playerName(winner),
          before: ri.winnerBefore, change: ri.winnerChange, after: ri.winnerAfter,
        },
        loser: {
          name: playerName(loser),
          before: ri.loserBefore, change: ri.loserChange, after: ri.loserAfter,
        },
      })
    })
  }
  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return {
    player: player
      ? { _id: pid, name: playerName(player), rating: player.rating ?? null }
      : null,
    rows,
  }
}
