import { getDB, toObjectId } from './db.js'
import {
  autoGenerateForEvent,
  updateMatchInStages,
  createResetMatch,
} from './eventHandlers.js'
import { getActiveSessionMatchIds } from './matchSessionHandlers.js'

// "Group A", "Group B", … keyed off the 0-indexed group index.
const getGroupLetter = (i) =>
  i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(65 + Math.floor(i / 26) - 1) +
      String.fromCharCode(65 + (i % 26))
const getGroupName = (i) => `Group ${getGroupLetter(i)}`

const EVENTS_COLLECTION = 'events'
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

const getClubDate = () =>
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

const getStartedEvents = async () => {
  const db = getDB()
  const today = getClubDate()
  const yesterday = shiftClubDate(today, -1)
  const events = await db
    .collection(EVENTS_COLLECTION)
    .find({ date: { $gte: yesterday, $lte: today } })
    .toArray()

  return events.filter((e) => {
    if (!hasEventStarted(e)) return false
    if (e.date === today) return true
    // Past dates: keep only events that still have unfinished matches.
    return extractRemainingMatches(e).length > 0
  })
}

const shiftClubDate = (yyyyMmDd, days) => {
  const [y, m, d] = yyyyMmDd.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

const hasEventStarted = (event) => {
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

    for (const match of group.matches || []) {
      if (isMatchFinishedAndConfirmed(match)) continue
      if (isMatchPostponed(match)) continue

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
  parent.subMatches.forEach((sub, idx) => {
    if (isMatchFinishedAndConfirmed(sub)) return
    if (isMatchPostponed(sub)) return
    // Sub-matches cancelled because the team match has already been
    // decided are removed from the queue entirely.
    if (sub.cancelledAt) return
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
const saveTableState = async (tables, matchQueue, groupTableMap) => {
  const db = getDB()
  await db.collection(TABLE_STATE_COLLECTION).updateOne(
    { docId: TABLE_STATE_DOC_ID },
    {
      $set: {
        docId: TABLE_STATE_DOC_ID,
        tables,
        matchQueue,
        groupTableMap: groupTableMap || {},
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
}

// ==================== TABLE ASSIGNMENT LOGIC (SERVER-SIDE) ====================

const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8]
const TABLE_ORDER = [6, 7, 2, 3, 5, 4, 1, 8]

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
      const preferredOrder = [2, 3, 1, 4, ...TABLE_ORDER]
      return [...allowed].sort(
        (a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b),
      )
    }
    return sortByPreference(allowed, true)
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
  }

  return sortByPreference(allowed, false)
}

const sortByPreference = (tables, isLow) => {
  if (isLow) {
    const preferredOrder = [1, 4, ...TABLE_ORDER]
    return [...tables].sort(
      (a, b) => preferredOrder.indexOf(a) - preferredOrder.indexOf(b),
    )
  }

  const canUse1or4 = tables.some((t) => t === 1 || t === 4)
  if (canUse1or4) {
    const order = [1, 4, ...TABLE_ORDER]
    return [...tables].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  }

  return [...tables].sort(
    (a, b) => TABLE_ORDER.indexOf(a) - TABLE_ORDER.indexOf(b),
  )
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
 * Check group player conflict (for group of 3)
 */
const hasGroupPlayerConflict = (groupKey, allItems, playersOnTables) => {
  const groupItems = allItems.filter((i) => i.groupKey === groupKey)
  for (const item of groupItems) {
    if (hasPlayerConflict(item, playersOnTables)) return true
  }
  return false
}

/**
 * Assign tables to matches from the queue
 */
const assignTablesToMatches = (tables, queue, allItems, groupTableMap) => {
  const updatedTables = tables.map((t) => ({ ...t }))
  const remainingQueue = []
  const playersOnTables = getPlayersOnTables(updatedTables)
  const assignedGroupKeys = new Set()
  const updatedGroupTableMap = pruneGroupTableMap(groupTableMap || {}, allItems)

  for (const item of queue) {
    const isGroupOfThree = item.groupKey && item.groupSize === 3

    // Group of 3: check all players in the group
    if (isGroupOfThree) {
      if (assignedGroupKeys.has(item.groupKey)) {
        remainingQueue.push(item)
        continue
      }
      if (hasGroupPlayerConflict(item.groupKey, allItems, playersOnTables)) {
        remainingQueue.push(item)
        continue
      }
    } else {
      if (hasPlayerConflict(item, playersOnTables)) {
        remainingQueue.push(item)
        continue
      }
    }

    // Tables reserved for other groups of 3 are off-limits to this item.
    const myLockedTable = isGroupOfThree
      ? updatedGroupTableMap[item.groupKey]
      : undefined
    const reservedForOthers = new Set(
      Object.entries(updatedGroupTableMap)
        .filter(([key]) => key !== item.groupKey)
        .map(([, table]) => table),
    )

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

    // Group of 3 must reuse the table the group was first assigned to.
    let tableNumber = allowedTables[0]
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
  }

  return {
    tables: updatedTables,
    remainingQueue,
    groupTableMap: updatedGroupTableMap,
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

  // Load persisted table state
  const savedState = await loadTableState()
  let tables = savedState?.tables || createInitialTables()

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
  )
  await saveTableState(
    result.tables,
    result.remainingQueue,
    result.groupTableMap,
  )

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
  for (const event of events) {
    const changed = await autoGenerateForEvent(event)
    if (changed) anyChanged = true
  }
  return anyChanged
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
  const tables = state?.tables || createInitialTables()
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
  )

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
    )
  }
}

export const rebuildMatchQueue = async () => {
  const events = await getStartedEvents()
  const allMatchItems = extractAllRemainingMatches(events)
  const matchQueue = buildMatchQueue(allMatchItems)

  const savedState = await loadTableState()
  let tables = savedState?.tables || createInitialTables()

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
  )
  await saveTableState(
    result.tables,
    result.remainingQueue,
    result.groupTableMap,
  )

  return { tables: result.tables, matchQueue: result.remainingQueue }
}
