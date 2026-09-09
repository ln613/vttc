import { getDB, toObjectId } from './db.js'
import {
  autoGenerateForEvent,
  updateMatchInStages,
  createResetMatch,
} from './eventHandlers.js'
import { getActiveSessionMatchIds } from './matchSessionHandlers.js'
import { notifyTableAssigned } from './pusher.js'
import { sendTableAssignedPush } from './push.js'

// Notifications are disabled for now — set NOTIFICATIONS_ENABLED=true to
// re-enable the table-assigned Pusher toast + OS-level push.
const NOTIFICATIONS_ENABLED = process.env.NOTIFICATIONS_ENABLED === 'true'

// "Group A", "Group B", … keyed off the 0-indexed group index.
const getGroupLetter = (i) =>
  i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(65 + Math.floor(i / 26) - 1) +
      String.fromCharCode(65 + (i % 26))
const getGroupName = (i) => `Group ${getGroupLetter(i)}`

const EVENTS_COLLECTION = 'events'
const PLAYERS_COLLECTION = 'players'
const TABLE_STATE_COLLECTION = 'tableState'
const TABLE_STATE_DOC_ID = 'current'

/**
 * Throw error helper
 */
const throwError = (message) => {
  throw new Error(message)
}

// ==================== EVENT HELPERS ====================

/**
 * Get all events that have started today
 */
const CLUB_TIMEZONE = process.env.CLUB_TIMEZONE || 'America/Vancouver'

export const getClubDate = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const getClubMinutesOfDay = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLUB_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = parseInt(parts.find((p) => p.type === 'hour').value, 10)
  const m = parseInt(parts.find((p) => p.type === 'minute').value, 10)
  return h * 60 + m
}

// Just enough of an event to decide whether its full document is worth
// pulling: when it starts, and whether anything is left to schedule or
// generate.
const EVENT_TRIAGE_PROJECTION = {
  date: 1,
  time: 1,
  startedAt: 1,
  'eventStages.type': 1,
  'eventStages.groups.isComplete': 1,
  'eventStages.rounds.isComplete': 1,
  'eventStages.rounds.matches.isBye1': 1,
  'eventStages.rounds.matches.isBye2': 1,
  'eventStages.rounds.matches.match.winningSide': 1,
  'eventStages.rounds.matches.match.confirmed': 1,
}

// True only when an event can contribute nothing further: no match left to
// schedule and nothing left to generate. Deliberately pessimistic — every
// uncertain case (no stages recorded, groups not drawn yet, a knockout
// round that exists but isn't complete) answers false and gets fetched, so
// the worst a mistake here can do is cost a read.
const eventIsExhausted = (event) => {
  const stages = event.eventStages || []
  if (!stages.length) return false

  const groupStage = stages.find((s) => s.type === 'group')
  if (groupStage) {
    const groups = groupStage.groups || []
    // Not drawn yet — auto-start may still need to generate it.
    if (!groups.length) return false
    if (!groups.every((g) => g.isComplete === true)) return false
  }

  const knockoutStage = stages.find((s) => s.type === 'knockout')
  if (knockoutStage) {
    const rounds = knockoutStage.rounds || []
    // Bracket not generated yet, or a placeholder round still to fill.
    if (!rounds.length) return false
    if (!rounds.every((r) => r.isComplete === true)) return false
    // Belt and braces: the same test extractKnockoutMatches applies.
    for (const round of rounds) {
      for (const km of round.matches || []) {
        if (km.isBye1 || km.isBye2 || !km.match) continue
        if (!(km.match.winningSide != null && km.match.confirmed === true)) {
          return false
        }
      }
    }
  }

  return true
}

const getStartedEvents = async () => {
  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const today = getClubDate()

  // Only today's started events feed the schedule/queue — once an event's
  // date has passed its unfinished matches drop off the schedule (admins
  // finalise them from the Event Detail Group/Knockout tabs instead).
  //
  // Pulling all of today's events in full cost ~900 KB and ~9 s on this
  // cluster, and most of it was thrown away: events whose start time hasn't
  // arrived, and completed groups the queue builder skips. Triage on a tiny
  // projection first, then fetch only the documents that can still produce
  // something.
  const triage = await collection
    .find({ date: today }, { projection: EVENT_TRIAGE_PROJECTION })
    .toArray()

  const wanted = triage
    .filter(hasEventStarted)
    .filter((e) => !eventIsExhausted(e))
    .map((e) => e._id)

  if (!wanted.length) return []
  return collection.find({ _id: { $in: wanted } }).toArray()
}

const hasEventStarted = (event) => {
  // Set by an explicit "Start Event" — see startEvent in eventHandlers.
  if (event.startedAt) return true
  if (!event.date) return true
  const today = getClubDate()
  if (event.date < today) return true
  if (event.date > today) return false
  if (!event.time) return true
  const eventTime = parseEventTime(event.time)
  return getClubMinutesOfDay() >= eventTime
}

const parseEventTime = (time) => {
  if (!time) return 0
  const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i)
  if (!match) return 0

  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3]?.toUpperCase()

  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0

  return hours * 60 + minutes
}

// ==================== MATCH QUEUE EXTRACTION ====================

/**
 * Extract remaining matches from an event
 */
const extractRemainingMatches = (event) => {
  const items = []
  const eventSummary = buildEventSummary(event)

  extractGroupMatches(event, eventSummary, items)
  extractKnockoutMatches(event, eventSummary, items)

  return items
}

const buildEventSummary = (event) => ({
  _id: event._id.toString(),
  eventName: event.eventName,
  type: event.type,
  nop: event.nop,
  restriction: event.restriction,
  ratingLimit: event.ratingLimit,
  ageLimitType: event.ageLimitType,
  ageLimit: event.ageLimit,
  date: event.date,
  time: event.time || '',
  stages: event.stages || [],
})

const getDefaultedGroupPlayerIds = (group) => {
  const ids = new Set()
  for (const gp of group.participants || []) {
    if (!gp.defaulted) continue
    for (const p of gp.participant?.players || []) ids.add(p._id?.toString())
  }
  return ids
}

const matchInvolvesDefaultedPlayer = (match, defaultedIds) => {
  if (defaultedIds.size === 0) return false
  const onSide = (side) =>
    (side || []).some((p) => defaultedIds.has(p._id?.toString()))
  return onSide(match.side1) || onSide(match.side2)
}

const extractGroupMatches = (event, eventSummary, items) => {
  const groupStage = event.eventStages?.find((s) => s.type === 'group')
  if (!groupStage || !groupStage.groups) return

  for (const group of groupStage.groups) {
    if (group.isComplete) continue

    const groupSize = group.participants?.length || 0
    const groupKey =
      groupSize === 3
        ? `${event._id.toString()}-${group.index}`
        : undefined

    const defaultedIds = getDefaultedGroupPlayerIds(group)

    for (const match of group.matches || []) {
      if (isMatchFinishedAndConfirmed(match)) continue
      if (isMatchPostponed(match)) continue
      // Matches involving a defaulted participant won't be played.
      if (matchInvolvesDefaultedPlayer(match, defaultedIds)) continue

      // Expanded team match: emit its sub-matches instead of the parent.
      if (
        match.isTeamMatch &&
        Array.isArray(match.subMatches) &&
        match.subMatches.length > 0
      ) {
        pushTeamSubMatchItems(match, items, {
          eventId: event._id.toString(),
          eventName: event.eventName,
          stageType: 'group',
          stageName: getGroupName(group.index),
          groupIndex: group.index,
          groupSize,
          groupKey,
          event: eventSummary,
        })
        continue
      }

      items.push({
        matchId: match._id,
        eventId: event._id.toString(),
        eventName: event.eventName,
        match,
        stageType: 'group',
        stageName: getGroupName(group.index),
        groupIndex: group.index,
        groupSize,
        groupKey,
        matchStatus: getMatchStatus(match),
        cancelledAt: match.cancelledAt,
        event: eventSummary,
      })
    }
  }
}

// Games a side has actually won so far (the in-progress game has no winner).
const countGamesWon = (match) => {
  let side1 = 0
  let side2 = 0
  for (const g of match?.games || []) {
    if (g.winningSide === 1) side1++
    else if (g.winningSide === 2) side2++
  }
  return { side1, side2 }
}

// Whether the game now in progress could end the match — i.e. one side is
// a single game from taking it. A team-mate must not start a match
// elsewhere while this is true, because the tie may need them as soon as
// this game finishes.
//
//   best of 3 (first to 2): game 1 no; game 2 at 1:0 yes; game 3 at 1:1 yes
//   best of 5 (first to 3): games 1-2 no; game 3 at 1:1 no (2:1 can't end
//   it) but at 2:0 yes; games 4 and 5 yes
const isPotentialMatchEndingGame = (match) => {
  const numberOfGames = match?.config?.numberOfGames ?? 3
  const needed = Math.ceil(numberOfGames / 2)
  const { side1, side2 } = countGamesWon(match)
  return Math.max(side1, side2) >= needed - 1
}

const collectSidePlayerIds = (match) => {
  const ids = []
  for (const p of match?.side1 || []) if (p?._id) ids.push(p._id.toString())
  for (const p of match?.side2 || []) if (p?._id) ids.push(p._id.toString())
  return ids
}

// A sub-match is still to be played (in order) unless it is done, cancelled
// as a dead rubber, or explicitly postponed by an admin.
const subMatchIsPending = (sub) =>
  !isMatchFinishedAndConfirmed(sub) && !sub.cancelledAt && !isMatchPostponed(sub)

const pushTeamSubMatchItems = (parent, items, ctx) => {
  const parentSummary = {
    _id: parent._id,
    side1: parent.side1,
    side2: parent.side2,
    isTeamMatch: parent.isTeamMatch,
    teamMatchType: parent.teamMatchType,
    numberOfMatches: parent.numberOfMatches,
    homeSide: parent.homeSide,
    side1Assignment: parent.side1Assignment,
    side2Assignment: parent.side2Assignment,
  }
  // A team match is played in order, one sub-match at a time, so only the
  // next pending sub-match is ever queued. Queueing them all let the table
  // assigner pick whichever sub-match happened to have two free players,
  // which is how a tie jumped from sub-match 1 straight to sub-match 4.
  const pending = parent.subMatches
    .map((sub, idx) => ({ sub, idx }))
    .filter(({ sub }) => subMatchIsPending(sub))
  const current = pending[0]
  if (!current) return

  // The sub-match after this one decides whether its players may start
  // somewhere else in the meantime (see isPotentialMatchEndingGame).
  const nextSubPlayerIds = pending[1]
    ? collectSidePlayerIds(pending[1].sub)
    : []

  ;[current].forEach(({ sub, idx }) => {
    items.push({
      matchId: sub._id,
      eventId: ctx.eventId,
      eventName: ctx.eventName,
      match: sub,
      stageType: ctx.stageType,
      stageName: ctx.stageName,
      ...(ctx.groupIndex != null ? { groupIndex: ctx.groupIndex } : {}),
      ...(ctx.groupSize != null ? { groupSize: ctx.groupSize } : {}),
      ...(ctx.groupKey ? { groupKey: ctx.groupKey } : {}),
      ...(ctx.roundName ? { roundName: ctx.roundName } : {}),
      matchStatus: getMatchStatus(sub),
      cancelledAt: sub.cancelledAt,
      event: ctx.event,
      lockedTableNumber: sub.lockedTableNumber,
      parentMatchId: parent._id,
      subMatchIndex: idx,
      nextSubPlayerIds,
      parent: parentSummary,
    })
  })
}

const extractKnockoutMatches = (event, eventSummary, items) => {
  const knockoutStage = event.eventStages?.find((s) => s.type === 'knockout')
  if (!knockoutStage || !knockoutStage.rounds) return

  for (const round of knockoutStage.rounds) {
    if (round.isComplete) continue

    for (const km of round.matches || []) {
      if (km.isBye1 || km.isBye2) continue
      if (!km.match) continue
      if (isMatchFinishedAndConfirmed(km.match)) continue
      if (isMatchPostponed(km.match)) continue

      if (
        km.match.isTeamMatch &&
        Array.isArray(km.match.subMatches) &&
        km.match.subMatches.length > 0
      ) {
        pushTeamSubMatchItems(km.match, items, {
          eventId: event._id.toString(),
          eventName: event.eventName,
          stageType: 'knockout',
          stageName: round.name,
          roundName: round.name,
          event: eventSummary,
        })
        continue
      }

      items.push({
        matchId: km.match._id,
        eventId: event._id.toString(),
        eventName: event.eventName,
        match: km.match,
        stageType: 'knockout',
        stageName: round.name,
        roundName: round.name,
        matchStatus: getMatchStatus(km.match),
        cancelledAt: km.match.cancelledAt,
        event: eventSummary,
      })
    }
  }
}

const isMatchFinishedAndConfirmed = (match) =>
  match.winningSide != null && match.confirmed === true

const isMatchPostponed = (match) => {
  if (!match.postponedUntil) return false
  return new Date(match.postponedUntil).getTime() > Date.now()
}

const getMatchStatus = (match) => {
  if (match.winningSide != null) return 'finished_unconfirmed'
  if (match.initialServingSide != null && match.leftSide != null) return 'in_progress' // match setup done = started
  if (match.games && match.games.length > 0) return 'in_progress'
  return 'not_started'
}

// ==================== TABLE STATE PERSISTENCE ====================

/**
 * Load table state from DB
 */
const loadTableState = async () => {
  const db = getDB()
  const state = await db
    .collection(TABLE_STATE_COLLECTION)
    .findOne({ docId: TABLE_STATE_DOC_ID })
  return state
}

/**
 * Save table state to DB
 */
const saveTableState = async (
  tables,
  matchQueue,
  groupTableMap,
  { teamTableMap, computedAt } = {},
) => {
  const db = getDB()
  await db.collection(TABLE_STATE_COLLECTION).updateOne(
    { docId: TABLE_STATE_DOC_ID },
    {
      $set: {
        docId: TABLE_STATE_DOC_ID,
        tables,
        matchQueue,
        groupTableMap: groupTableMap || {},
        teamTableMap: teamTableMap || {},
        updatedAt: new Date().toISOString(),
        // Stamped with the time the rebuild STARTED, so a mutation landing
        // mid-rebuild still reads as newer and forces another one.
        ...(computedAt ? { computedAt } : {}),
      },
    },
    { upsert: true },
  )
}

// Every mutation that can move a match through the queue calls this, so the
// next read knows the cached tables/queue are stale. One small document,
// ~40 ms, against a rebuild that costs seconds.
export const markQueueDirty = async () => {
  const db = getDB()
  await db.collection(TABLE_STATE_COLLECTION).updateOne(
    { docId: TABLE_STATE_DOC_ID },
    { $set: { docId: TABLE_STATE_DOC_ID, dirtyAt: new Date().toISOString() } },
    { upsert: true },
  )
}

// The persisted tables/queue stay authoritative while nothing has changed
// since they were built.
const cachedStateIsFresh = (state) => {
  if (!state?.tables?.length || !state.computedAt) return false
  return !state.dirtyAt || state.dirtyAt <= state.computedAt
}

// Auto-start is time-driven, not data-driven: it exists to open events once
// their start time passes. The LiveScore heartbeat asks for it once a
// minute PER CLIENT, so three admins with the page open used to force three
// full rebuilds a minute. One rebuild in this window is enough for everyone;
// a mutation still invalidates the cache immediately, so nothing waits on
// this floor to become visible.
const AUTO_START_MIN_INTERVAL_MS = 30_000

const autoStartRanRecently = (state) => {
  if (!state?.computedAt) return false
  return Date.now() - Date.parse(state.computedAt) < AUTO_START_MIN_INTERVAL_MS
}

// ==================== TABLE ASSIGNMENT LOGIC (SERVER-SIDE) ====================

const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8]
const TABLE_ORDER = [6, 7, 2, 3, 5, 4, 1, 8]
// Low-tier events: any table, preferring the worse courts first so the
// better tables stay free for high-level events.
const LOW_TIER_ORDER = [1, 4, 8, 2, 3, 5, 7, 6]
// High-tier events: tables 1 and 4 never used; preference follows the
// general court-condition order.
const HIGH_TIER_ORDER = [6, 7, 2, 3, 5]

const createInitialTables = () =>
  ALL_TABLES.map((tableNumber) => ({
    tableNumber,
    status: 'available',
  }))

/**
 * Check if event is low-tier
 */
const isLowTierEvent = (event) => {
  if (
    event.type === 'Single' &&
    event.restriction === 'Rated' &&
    event.ratingLimit != null &&
    event.ratingLimit <= 1000
  )
    return true
  if (
    event.type === 'Team' &&
    event.restriction === 'Rated' &&
    event.ratingLimit != null &&
    event.ratingLimit <= 2000
  )
    return true
  if (
    event.type === 'Single' &&
    event.restriction === 'Age' &&
    event.ageLimitType === 'U' &&
    event.ageLimit != null &&
    event.ageLimit <= 13
  )
    return true
  return false
}

/**
 * Check if event is high-tier
 */
const isHighTierEvent = (event) => {
  if (event.type === 'Single' && event.restriction === 'Open') return true
  if (
    event.type === 'Single' &&
    event.restriction === 'Rated' &&
    event.ratingLimit != null &&
    event.ratingLimit >= 1500
  )
    return true
  if (
    event.type === 'Team' &&
    event.restriction === 'Rated' &&
    event.ratingLimit != null &&
    event.ratingLimit >= 2500
  )
    return true
  if (
    event.type === 'Single' &&
    event.restriction === 'Age' &&
    event.ageLimitType === 'U' &&
    event.ageLimit != null &&
    event.ageLimit >= 15
  )
    return true
  if (
    event.type === 'Single' &&
    event.restriction === 'Age' &&
    event.ageLimitType === 'O' &&
    event.ageLimit != null &&
    event.ageLimit >= 40
  )
    return true
  return false
}

/**
 * Get allowed tables for a match
 */
const getAllowedTables = (item, availableTables) => {
  const event = item.event
  const isLow = isLowTierEvent(event)
  const isHigh = isHighTierEvent(event)
  const isKnockout = item.stageType === 'knockout'
  const isFinal = item.roundName === 'Final'
  const isSemifinal = item.roundName === 'Semifinal'

  let allowed = [...availableTables]

  // Rule 1: Table 8 should never be used for knockout matches
  if (isKnockout) {
    allowed = allowed.filter((t) => t !== 8)
  }

  if (isLow) {
    if (isFinal || isSemifinal) {
      // Low-tier semifinal/final prefers tables 2 or 3.
      return sortByOrder(allowed, [2, 3, ...LOW_TIER_ORDER])
    }
    return sortByOrder(allowed, LOW_TIER_ORDER)
  }

  // Rule 3: For non-low-tier events, table 8 not used at all
  allowed = allowed.filter((t) => t !== 8)

  if (isHigh) {
    // Rule 4: High-tier: no table 1, 4
    allowed = allowed.filter((t) => t !== 1 && t !== 4)
    if (isSemifinal) {
      allowed = allowed.filter((t) => t !== 5)
    }
    if (isFinal) {
      // Final must be on table 6. If 6 is busy, defer by returning [].
      return allowed.includes(6) ? [6] : []
    }
    return sortByOrder(allowed, HIGH_TIER_ORDER)
  }

  // Mid-tier events: no explicit preference order, use the general
  // court-condition order (table 8 already excluded by rule 3).
  return sortByOrder(allowed, TABLE_ORDER)
}

// Sort tables by an explicit preference order (tables not in the order
// sort to the end, preserving relative order).
const sortByOrder = (tables, order) => {
  const rank = (t) => {
    const i = order.indexOf(t)
    return i === -1 ? order.length : i
  }
  return [...tables].sort((a, b) => rank(a) - rank(b))
}

/**
 * Get stage priority for sorting
 */
const getStagePriority = (item) => {
  if (item.stageType === 'group') return 0
  const rn = item.roundName
  if (!rn) return 1
  if (rn === 'Final') return 5
  if (rn === 'Semifinal') return 4
  if (rn === 'Quarterfinal') return 3
  if (rn.startsWith('Round of')) return 2
  return 1
}

/**
 * Build match queue sorted by event priority
 */
const buildMatchQueue = (matchItems) => {
  if (matchItems.length === 0) return []

  const byEvent = new Map()
  for (const item of matchItems) {
    if (!byEvent.has(item.eventId)) byEvent.set(item.eventId, [])
    byEvent.get(item.eventId).push(item)
  }

  const entries = []
  for (const [eventId, matches] of byEvent) {
    const maxPriority = Math.max(...matches.map(getStagePriority))
    const eventTime = parseEventTime(matches[0]?.event?.time || '')
    entries.push({ eventId, stagePriority: maxPriority, eventTime, matches })
  }

  entries.sort((a, b) => {
    if (a.stagePriority !== b.stagePriority)
      return b.stagePriority - a.stagePriority
    return a.eventTime - b.eventTime
  })

  return entries.flatMap((e) =>
    [...e.matches].sort((m1, m2) => matchPriority(m1) - matchPriority(m2)),
  )
}

// Lower value = earlier in the queue. In-progress / finished-but-unconfirmed
// matches always come first so they reclaim tables before not-started matches
// (avoids losing the table on a cold rebuild of tableState). Cancelled matches
// go last, per the cancel spec.
const collectLockedSubMatchTables = (queue, myLocked) => {
  const tables = new Set()
  for (const it of queue) {
    if (it.lockedTableNumber != null && it.lockedTableNumber !== myLocked) {
      tables.add(it.lockedTableNumber)
    }
  }
  return tables
}

const matchPriority = (item) => {
  if (item.cancelledAt) return 2
  if (
    item.matchStatus === 'in_progress' ||
    item.matchStatus === 'finished_unconfirmed'
  ) {
    return 0
  }
  // Sub-matches of an expanded team match are locked to their table and
  // should run ahead of any other not-yet-started work on that table.
  if (item.lockedTableNumber != null) return 0
  return 1
}

/**
 * Get players on tables
 */
const getPlayersOnTables = (tables) => {
  const playerIds = new Set()
  for (const table of tables) {
    if (table.status !== 'assigned' || !table.match) continue
    const match = table.match.match
    if (!match) continue
    for (const p of match.side1 || []) playerIds.add(p._id?.toString())
    for (const p of match.side2 || []) playerIds.add(p._id?.toString())
  }
  return playerIds
}

/**
 * Check player conflict
 */
const hasPlayerConflict = (item, playersOnTables) => {
  const match = item.match
  if (!match) return false
  for (const p of match.side1 || []) {
    if (playersOnTables.has(p._id?.toString())) return true
  }
  for (const p of match.side2 || []) {
    if (playersOnTables.has(p._id?.toString())) return true
  }
  return false
}

/**
 * Assign tables to matches from the queue
 */
// Which table each live team match owns. The tie keeps it for its whole
// run, so when one sub-match ends and the next can't start yet the table is
// held empty rather than handed to someone else.
const pruneTeamTableMap = (map, allItems) => {
  const liveTeams = new Set()
  for (const it of allItems) {
    if (it.parentMatchId) liveTeams.add(it.parentMatchId.toString())
  }
  const next = {}
  for (const [key, val] of Object.entries(map)) {
    if (liveTeams.has(key)) next[key] = val
  }
  return next
}

// Players a live team match may need the moment its current game ends.
// Only collected while that game could actually end the sub-match — before
// then the team-mate has slack and is free to play elsewhere.
//
// Read from every live item rather than from the tables: a sub-match that
// is mid-game but momentarily unassigned still holds its team-mate, and
// taking it from the tables alone also made the answer depend on whether
// the tie happened to be processed before or after the other match.
const collectTeamHeldPlayerIds = (items) => {
  const held = new Set()
  for (const item of items) {
    if (!item.parentMatchId) continue
    if (!isPotentialMatchEndingGame(item.match)) continue
    for (const id of item.nextSubPlayerIds || []) held.add(id)
  }
  return held
}

// Rule: a player in a team match may start elsewhere only if they are not
// in the current sub-match (already covered by playersOnTables) AND either
// not in the next sub-match, or that sub-match cannot end this game.
const hasTeamHoldConflict = (item, heldPlayerIds) => {
  if (!heldPlayerIds.size) return false
  // A team's own sub-matches are exempt — they are what the hold is for.
  if (item.parentMatchId) return false
  return collectSidePlayerIds(item.match).some((id) => heldPlayerIds.has(id))
}

const assignTablesToMatches = (
  tables,
  queue,
  allItems,
  groupTableMap,
  teamTableMap,
) => {
  const updatedTables = tables.map((t) => ({ ...t }))
  const remainingQueue = []
  const playersOnTables = getPlayersOnTables(updatedTables)
  const assignedGroupKeys = new Set()
  const updatedGroupTableMap = pruneGroupTableMap(groupTableMap || {}, allItems)
  const updatedTeamTableMap = pruneTeamTableMap(teamTableMap || {}, allItems)
  const heldPlayerIds = collectTeamHeldPlayerIds(allItems)

  for (const item of queue) {
    const isGroupOfThree = item.groupKey && item.groupSize === 3

    // Group of 3 runs one match at a time on its fixed table, so only one
    // of its matches is assigned per pass.
    if (isGroupOfThree && assignedGroupKeys.has(item.groupKey)) {
      remainingQueue.push(item)
      continue
    }
    // A match is skipped only when one of its own two players is already
    // playing — a busy third group member no longer blocks the match
    // whose players are both free.
    if (hasPlayerConflict(item, playersOnTables)) {
      remainingQueue.push(item)
      continue
    }
    // A team-mate needed for the next sub-match can't be sent elsewhere
    // while the current one is a game from finishing.
    if (hasTeamHoldConflict(item, heldPlayerIds)) {
      remainingQueue.push(item)
      continue
    }

    // Tables reserved for other groups of 3 are off-limits to this item.
    const myLockedTable = isGroupOfThree
      ? updatedGroupTableMap[item.groupKey]
      : undefined
    const myParentId = item.parentMatchId?.toString()
    const myTeamTable = myParentId ? updatedTeamTableMap[myParentId] : undefined
    const reservedForOthers = new Set([
      ...Object.entries(updatedGroupTableMap)
        .filter(([key]) => key !== item.groupKey)
        .map(([, table]) => table),
      // Tables held by other live team matches, including one sitting empty
      // between sub-matches while it waits for a player.
      ...Object.entries(updatedTeamTableMap)
        .filter(([key]) => key !== myParentId)
        .map(([, table]) => table),
    ])

    // Tables locked by sub-matches of an expanded team match are
    // off-limits to anyone whose lockedTableNumber doesn't match.
    const lockedSubMatchTables = collectLockedSubMatchTables(
      queue,
      item.lockedTableNumber,
    )

    const availableTables = updatedTables
      .filter(
        (t) =>
          t.status === 'available' &&
          !reservedForOthers.has(t.tableNumber) &&
          !lockedSubMatchTables.has(t.tableNumber),
      )
      .map((t) => t.tableNumber)

    if (availableTables.length === 0) {
      remainingQueue.push(item)
      continue
    }

    // Items locked to a specific table only accept that table.
    if (item.lockedTableNumber != null) {
      if (!availableTables.includes(item.lockedTableNumber)) {
        remainingQueue.push(item)
        continue
      }
      const tableNumber = item.lockedTableNumber
      const tableIndex = updatedTables.findIndex(
        (t) => t.tableNumber === tableNumber,
      )
      updatedTables[tableIndex] = {
        ...updatedTables[tableIndex],
        match: { ...item, tableNumber },
        status: 'assigned',
      }
      if (myParentId) updatedTeamTableMap[myParentId] = tableNumber
      const match = item.match
      if (match) {
        for (const p of match.side1 || []) playersOnTables.add(p._id?.toString())
        for (const p of match.side2 || []) playersOnTables.add(p._id?.toString())
      }
      continue
    }

    const allowedTables = getAllowedTables(item, availableTables)
    if (allowedTables.length === 0) {
      remainingQueue.push(item)
      continue
    }

    // A team match stays on the table it started on.
    let tableNumber = allowedTables[0]
    if (myTeamTable != null) {
      if (!allowedTables.includes(myTeamTable)) {
        // Its table is busy: wait for it rather than move the tie.
        remainingQueue.push(item)
        continue
      }
      tableNumber = myTeamTable
    }
    // Group of 3 must reuse the table the group was first assigned to.
    if (isGroupOfThree && myLockedTable != null) {
      if (!allowedTables.includes(myLockedTable)) {
        // The group's table is currently busy (or not allowed). Defer.
        remainingQueue.push(item)
        continue
      }
      tableNumber = myLockedTable
    }

    const tableIndex = updatedTables.findIndex(
      (t) => t.tableNumber === tableNumber,
    )

    updatedTables[tableIndex] = {
      ...updatedTables[tableIndex],
      match: { ...item, tableNumber },
      status: 'assigned',
    }

    // Add players to playing set
    const match = item.match
    if (match) {
      for (const p of match.side1 || []) playersOnTables.add(p._id?.toString())
      for (const p of match.side2 || []) playersOnTables.add(p._id?.toString())
    }

    if (isGroupOfThree) {
      assignedGroupKeys.add(item.groupKey)
      updatedGroupTableMap[item.groupKey] = tableNumber
    }
    if (myParentId) updatedTeamTableMap[myParentId] = tableNumber
  }

  return {
    tables: updatedTables,
    remainingQueue,
    groupTableMap: updatedGroupTableMap,
    teamTableMap: updatedTeamTableMap,
  }
}

// Drop entries for groups whose matches are all finished/no longer pending.
const pruneGroupTableMap = (map, allItems) => {
  const liveGroupKeys = new Set()
  for (const it of allItems) {
    if (it.groupKey && it.groupSize === 3) liveGroupKeys.add(it.groupKey)
  }
  const next = {}
  for (const [key, val] of Object.entries(map)) {
    if (liveGroupKeys.has(key)) next[key] = val
  }
  return next
}

// ==================== API HANDLERS ====================

/**
 * Get live score data (tables + match queue)
 */
export const getLiveScore = async (params = {}) => {
  // Rebuilding the queue means re-reading every started event in full —
  // ~900 KB on a tournament day, ~9 s on this cluster — and by the end of a
  // day all of it belongs to completed groups the builder discards.
  // Spectators refetch this endpoint on every broadcast, so that rebuild
  // was effectively the whole compute bill. Serve the persisted state
  // unless a mutation has marked it dirty, or the caller is the admin
  // heartbeat asking for auto-start.
  const cached = await loadTableState()
  const skipRebuild = cachedStateIsFresh(cached)
    && (!params.runAutoStart || autoStartRanRecently(cached))
  if (skipRebuild) {
    return {
      tables: cached.tables,
      matchQueue: cached.matchQueue || [],
      activeSessionMatchIds: await getActiveSessionMatchIds(),
    }
  }

  const computedAt = new Date().toISOString()
  let events = await getStartedEvents()

  // Auto-generation only runs when the caller opts in (the LiveScore
  // page mount + its admin-only heartbeat). Other clients reading the
  // live state get whatever's already there without triggering the
  // group/schedule generation as a side-effect.
  if (params.runAutoStart) {
    const anyChanged = await autoGenerateForStartedEvents(events)
    if (anyChanged) {
      events = await getStartedEvents()
    }
  }

  const allMatchItems = extractAllRemainingMatches(events)
  const matchQueue = buildMatchQueue(allMatchItems)

  // Already loaded above for the freshness check.
  const savedState = cached
  // An empty array is truthy, so `|| createInitialTables()` would keep it and
  // leave the club with zero tables — every match queued, none ever assigned,
  // and no error anywhere. Treat empty as "not initialised".
  let tables = savedState?.tables?.length
    ? savedState.tables
    : createInitialTables()

  // Reconcile: remove finished assignments and refresh match data on assigned tables
  tables = reconcileTableAssignments(tables, allMatchItems)

  // Filter out matches already assigned to tables
  const assignedMatchIds = getAssignedMatchIds(tables)
  const unassignedQueue = filterOutAssignedMatches(matchQueue, assignedMatchIds)

  // Assign tables to matches
  const result = assignTablesToMatches(
    tables,
    unassignedQueue,
    allMatchItems,
    savedState?.groupTableMap,
    savedState?.teamTableMap,
  )
  await saveTableState(
    result.tables,
    result.remainingQueue,
    result.groupTableMap,
    { teamTableMap: result.teamTableMap, computedAt },
  )

  // Notify players of any match that just landed on a table.
  await notifyNewlyAssignedMatches(savedState?.tables, result.tables)

  const activeSessionMatchIds = await getActiveSessionMatchIds()

  return {
    tables: result.tables,
    matchQueue: result.remainingQueue,
    activeSessionMatchIds,
  }
}

/**
 * Auto-generate groups and/or schedules for all started events that need them.
 * Returns true if any event was modified.
 */
const autoGenerateForStartedEvents = async (events) => {
  let anyChanged = false
  for (const event of orderEventsForAutoStart(events)) {
    const changed = await autoGenerateForEvent(event)
    if (changed) anyChanged = true
  }
  return anyChanged
}

// Auto-start order: earlier start time first, and when two events share
// the same start time, the higher-tier event is generated first.
const orderEventsForAutoStart = (events) =>
  [...events].sort((a, b) => {
    const startA = eventStartKey(a)
    const startB = eventStartKey(b)
    if (startA !== startB) return startA < startB ? -1 : 1
    return eventTierRank(b) - eventTierRank(a)
  })

const eventStartKey = (event) =>
  `${event.date || ''} ${String(parseEventTime(event.time)).padStart(4, '0')}`

// Higher number = higher tier (high > mid > low).
const eventTierRank = (event) => {
  if (isHighTierEvent(event)) return 2
  if (isLowTierEvent(event)) return 0
  return 1
}

const extractAllRemainingMatches = (events) => {
  const allItems = []
  for (const event of events) {
    const items = extractRemainingMatches(event)
    allItems.push(...items)
  }
  return allItems
}

/**
 * Reconcile table assignments with current match state
 * Remove assignments for matches that are now finished and confirmed
 */
const reconcileTableAssignments = (tables, currentMatchItems) => {
  const currentMatchMap = buildCurrentMatchMap(currentMatchItems)

  return tables.map((table) => {
    if (table.status !== 'assigned' || !table.match) return table

    const freshItem = currentMatchMap.get(table.match.matchId)

    // If the match is no longer in the remaining matches, it's been finished/confirmed
    if (!freshItem) {
      return { ...table, match: undefined, status: 'available' }
    }

    // Update the table's match data with fresh data (games, scores, matchStatus)
    return {
      ...table,
      match: { ...freshItem, tableNumber: table.tableNumber },
    }
  })
}

const buildCurrentMatchMap = (matchItems) => {
  const map = new Map()
  for (const item of matchItems) {
    map.set(item.matchId, item)
  }
  return map
}

// ==================== TABLE-ASSIGNED NOTIFICATIONS ====================

// All distinct player ids on both sides of a match. Team parent matches
// carry the full team rosters on side1/side2, so this also covers the
// "including team parent match" case in the spec.
const collectMatchPlayerIds = (match) => {
  if (!match) return []
  const ids = []
  for (const p of match.side1 || []) if (p?._id) ids.push(p._id.toString())
  for (const p of match.side2 || []) if (p?._id) ids.push(p._id.toString())
  return [...new Set(ids)]
}

// Of the given player ids, return those that have a user account — i.e. a
// password has been set on the player document (sign-up complete).
const filterPlayerIdsWithAccount = async (playerIds) => {
  if (!Array.isArray(playerIds) || playerIds.length === 0) return []
  const db = getDB()
  const players = await db
    .collection(PLAYERS_COLLECTION)
    .find(
      {
        _id: { $in: playerIds.map(toObjectId) },
        password: { $exists: true, $ne: null },
      },
      { projection: { _id: 1 } },
    )
    .toArray()
  return players.map((p) => p._id.toString())
}

const getAssignedTableEntries = (tables) =>
  (tables || []).filter((t) => t.status === 'assigned' && t.match?.matchId)

const getAssignedMatchIdSet = (tables) =>
  new Set(getAssignedTableEntries(tables).map((t) => t.match.matchId.toString()))

// Push a "table assigned" notification to every account-holding player in
// the just-assigned match.
const notifyPlayersOfAssignment = async (tableEntry) => {
  if (!NOTIFICATIONS_ENABLED) return
  if (!tableEntry) return
  const item = tableEntry.match
  const playerIds = collectMatchPlayerIds(item?.match)
  const accountPlayerIds = await filterPlayerIdsWithAccount(playerIds)
  const payload = {
    tableNumber: tableEntry.tableNumber,
    eventId: item.eventId,
    matchId: item.matchId?.toString(),
  }
  await Promise.all([
    // In-app realtime toast (web + foreground native) via Pusher.
    ...accountPlayerIds.map((playerId) => notifyTableAssigned(playerId, payload)),
    // OS-level push to the native apps (delivers even when backgrounded).
    sendTableAssignedPush(accountPlayerIds, payload),
  ])
}

// Compare the table state before/after an assignment pass and notify the
// players of every match that just landed on a table. Best-effort — it
// never throws, so a notification hiccup can't break the assignment flow.
const notifyNewlyAssignedMatches = async (prevTables, nextTables) => {
  try {
    const prevAssigned = getAssignedMatchIdSet(prevTables)
    const newEntries = getAssignedTableEntries(nextTables).filter(
      (t) => !prevAssigned.has(t.match.matchId.toString()),
    )
    for (const entry of newEntries) {
      await notifyPlayersOfAssignment(entry)
    }
  } catch {
    // best-effort: assignment must succeed even if notifications fail
  }
}

const getAssignedMatchIds = (tables) => {
  const ids = new Set()
  for (const table of tables) {
    if (table.status === 'assigned' && table.match?.matchId) {
      ids.add(table.match.matchId)
    }
  }
  return ids
}

const filterOutAssignedMatches = (queue, assignedMatchIds) =>
  queue.filter((item) => !assignedMatchIds.has(item.matchId))

/**
 * Rebuild match queue (triggered after match confirm/reset)
 */
/**
 * Postpone a match for N minutes.
 * Sets postponedUntil on the match and frees any table it occupies.
 */
export const postponeMatch = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (!body.minutes || body.minutes <= 0) throwError('Minutes is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await collection.findOne({ _id: toObjectId(body._id) })
  if (!event) throwError('Event not found')

  const postponedUntil = new Date(Date.now() + body.minutes * 60_000).toISOString()

  // The set of match ids to postpone — always includes the target. If
  // the target is a team sub-match, also cascade to every other
  // remaining (not finished-and-confirmed) sub-match under the same
  // parent — the sub-match order is fixed, so leaving siblings on the
  // queue would break the play order.
  const idsToPostpone = collectPostponeTargets(
    event.eventStages || [],
    body.matchId,
  )

  let updatedStages = event.eventStages
  for (const id of idsToPostpone) {
    updatedStages = updateMatchInStages(updatedStages, id, (m) => ({
      ...m,
      postponedUntil,
      cancelledAt: undefined,
      // A postponed match doesn't have to come back on the same
      // table — drop the lock so the queue allocator can place it
      // anywhere allowed by the general rules when it reappears.
      lockedTableNumber: undefined,
    }))
  }

  await collection.updateOne(
    { _id: toObjectId(body._id) },
    { $set: { eventStages: updatedStages } },
  )

  for (const id of idsToPostpone) {
    await freeTableForMatch(id)
  }

  return { success: true }
}

// If matchId is a team sub-match, returns the target plus every other
// non-finished-and-confirmed sub-match under the same parent (so the
// whole remaining order moves together). Otherwise returns just
// [matchId].
const collectPostponeTargets = (eventStages, matchId) => {
  for (const stage of eventStages) {
    const parents =
      stage.type === 'group'
        ? (stage.groups || []).flatMap((g) => g.matches || [])
        : stage.type === 'knockout'
          ? (stage.rounds || []).flatMap((r) =>
              (r.matches || []).map((km) => km.match).filter(Boolean),
            )
          : []
    for (const parent of parents) {
      if (!parent.isTeamMatch || !Array.isArray(parent.subMatches)) continue
      if (!parent.subMatches.some((s) => s._id === matchId)) continue
      return parent.subMatches
        .filter(
          (s) =>
            !s.cancelledAt &&
            !(s.winningSide != null && s.confirmed === true),
        )
        .map((s) => s._id)
    }
  }
  return [matchId]
}

/**
 * Cancel an in-progress match: clear its games/result, mark cancelledAt
 * (so the queue pushes it to the end), and free its table.
 */
export const cancelMatch = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await collection.findOne({ _id: toObjectId(body._id) })
  if (!event) throwError('Event not found')

  const cancelledAt = new Date().toISOString()
  const updatedStages = updateMatchInStages(
    event.eventStages,
    body.matchId,
    (match) => ({
      ...createResetMatch(match),
      cancelledAt,
      postponedUntil: undefined,
    }),
  )

  await collection.updateOne(
    { _id: toObjectId(body._id) },
    { $set: { eventStages: updatedStages } },
  )

  await freeTableForMatch(body.matchId)

  return { success: true }
}

// Admin-only manual assignment: drop a queued match onto a chosen table
// regardless of the normal table-assignment rules.
export const assignMatchToTable = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (body.tableNumber == null) throwError('tableNumber is required')

  const events = await getStartedEvents()
  const allMatchItems = extractAllRemainingMatches(events)
  const item = allMatchItems.find(
    (m) => m.matchId?.toString() === body.matchId.toString(),
  )
  if (!item) throwError('Match not found in the current queue')

  const state = await loadTableState()
  const tables = state?.tables?.length ? state.tables : createInitialTables()
  const targetIndex = tables.findIndex(
    (t) => t.tableNumber === body.tableNumber,
  )
  if (targetIndex === -1) throwError('Table not found')
  if (tables[targetIndex].status !== 'available') {
    throwError('Table is not available')
  }

  const updatedTables = tables.map((t, i) =>
    i === targetIndex
      ? {
          ...t,
          match: { ...item, tableNumber: body.tableNumber },
          status: 'assigned',
        }
      : t,
  )

  // Recompute the queue: drop the just-assigned match so other clients
  // don't see it in queue any more.
  const matchQueue = buildMatchQueue(allMatchItems)
  const assignedIds = getAssignedMatchIds(updatedTables)
  const remainingQueue = filterOutAssignedMatches(matchQueue, assignedIds)

  await saveTableState(
    updatedTables,
    remainingQueue,
    state?.groupTableMap,
    { teamTableMap: state?.teamTableMap },
  )

  // Notify the assigned match's players (this is the only new assignment).
  await notifyNewlyAssignedMatches(tables, updatedTables)

  // For a parent team match, also persist the admin's chosen table on
  // the parent match itself so that sub-matches generated later inherit
  // this table even when the parent has since been freed from
  // tableState (and even when the choice violates the general
  // table-assignment rules).
  const isTeamParent = item.match?.isTeamMatch && !item.parentMatchId
  if (isTeamParent) {
    await persistParentTeamMatchTableChoice(
      body._id,
      body.matchId,
      body.tableNumber,
    )
  }

  return { success: true }
}

const persistParentTeamMatchTableChoice = async (
  eventId,
  matchId,
  tableNumber,
) => {
  const db = getDB()
  const collection = db.collection('events')
  const event = await collection.findOne({ _id: toObjectId(eventId) })
  if (!event) return
  let changed = false
  const updatedStages = (event.eventStages || []).map((stage) => {
    if (stage.type === 'group') {
      return {
        ...stage,
        groups: (stage.groups || []).map((g) => ({
          ...g,
          matches: (g.matches || []).map((m) => {
            if (
              m._id === matchId &&
              m.isTeamMatch &&
              !m.parentMatchId &&
              m.lockedTableNumber !== tableNumber
            ) {
              changed = true
              return { ...m, lockedTableNumber: tableNumber }
            }
            return m
          }),
        })),
      }
    }
    if (stage.type === 'knockout') {
      return {
        ...stage,
        rounds: (stage.rounds || []).map((r) => ({
          ...r,
          matches: (r.matches || []).map((km) => {
            const m = km.match
            if (!m) return km
            if (
              m._id === matchId &&
              m.isTeamMatch &&
              !m.parentMatchId &&
              m.lockedTableNumber !== tableNumber
            ) {
              changed = true
              return { ...km, match: { ...m, lockedTableNumber: tableNumber } }
            }
            return km
          }),
        })),
      }
    }
    return stage
  })
  if (changed) {
    await collection.updateOne(
      { _id: toObjectId(eventId) },
      { $set: { eventStages: updatedStages } },
    )
  }
}

const freeTableForMatch = async (matchId) => {
  const state = await loadTableState()
  if (!state?.tables) return
  let changed = false
  const tables = state.tables.map((t) => {
    if (
      t.status === 'assigned' &&
      t.match?.matchId &&
      t.match.matchId.toString() === matchId.toString()
    ) {
      changed = true
      return { tableNumber: t.tableNumber, status: 'available' }
    }
    return t
  })
  if (changed) {
    await saveTableState(
      tables,
      state.matchQueue || [],
      state.groupTableMap,
      { teamTableMap: state.teamTableMap },
    )
  }
}

export const rebuildMatchQueue = async () => {
  const events = await getStartedEvents()
  const allMatchItems = extractAllRemainingMatches(events)
  const matchQueue = buildMatchQueue(allMatchItems)

  const savedState = await loadTableState()
  // An empty array is truthy, so `|| createInitialTables()` would keep it and
  // leave the club with zero tables — every match queued, none ever assigned,
  // and no error anywhere. Treat empty as "not initialised".
  let tables = savedState?.tables?.length
    ? savedState.tables
    : createInitialTables()

  // Reconcile
  tables = reconcileTableAssignments(tables, allMatchItems)

  // Filter out matches already assigned to tables
  const assignedMatchIds = getAssignedMatchIds(tables)
  const unassignedQueue = filterOutAssignedMatches(matchQueue, assignedMatchIds)

  // Assign
  const result = assignTablesToMatches(
    tables,
    unassignedQueue,
    allMatchItems,
    savedState?.groupTableMap,
    savedState?.teamTableMap,
  )
  await saveTableState(
    result.tables,
    result.remainingQueue,
    result.groupTableMap,
    { teamTableMap: result.teamTableMap },
  )

  // Notify players of any match that just landed on a table.
  await notifyNewlyAssignedMatches(savedState?.tables, result.tables)

  return { tables: result.tables, matchQueue: result.remainingQueue }
}
