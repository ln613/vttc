import { getDB, toObjectId } from './db.js'
import { autoGenerateForEvent } from './eventHandlers.js'

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
const getStartedEvents = async () => {
  const db = getDB()
  const today = new Date().toISOString().split('T')[0]
  const events = await db
    .collection(EVENTS_COLLECTION)
    .find({ date: today })
    .toArray()

  const now = new Date()
  return events.filter((e) => hasEventStarted(e, now))
}

const hasEventStarted = (event, now) => {
  if (!event.time) return true // no time means started
  const eventTime = parseEventTime(event.time)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  return currentMinutes >= eventTime
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

      items.push({
        matchId: match._id,
        eventId: event._id.toString(),
        eventName: event.eventName,
        match,
        stageType: 'group',
        stageName: `Group ${group.index + 1}`,
        groupIndex: group.index,
        groupSize,
        groupKey,
        matchStatus: getMatchStatus(match),
        event: eventSummary,
      })
    }
  }
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

      items.push({
        matchId: km.match._id,
        eventId: event._id.toString(),
        eventName: event.eventName,
        match: km.match,
        stageType: 'knockout',
        stageName: round.name,
        roundName: round.name,
        matchStatus: getMatchStatus(km.match),
        event: eventSummary,
      })
    }
  }
}

const isMatchFinishedAndConfirmed = (match) =>
  match.winningSide != null && match.confirmed === true

const getMatchStatus = (match) => {
  if (match.winningSide != null) return 'not_started' // finished but not confirmed, treat as not started for table display
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
const saveTableState = async (tables, matchQueue) => {
  const db = getDB()
  await db.collection(TABLE_STATE_COLLECTION).updateOne(
    { docId: TABLE_STATE_DOC_ID },
    {
      $set: {
        docId: TABLE_STATE_DOC_ID,
        tables,
        matchQueue,
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
      if (allowed.includes(6)) return [6]
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

  return entries.flatMap((e) => e.matches)
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
const assignTablesToMatches = (tables, queue, allItems) => {
  const updatedTables = tables.map((t) => ({ ...t }))
  const remainingQueue = []
  const playersOnTables = getPlayersOnTables(updatedTables)
  const assignedGroupKeys = new Set()

  for (const item of queue) {
    // Group of 3: check all players in the group
    if (item.groupKey && item.groupSize === 3) {
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

    const availableTables = updatedTables
      .filter((t) => t.status === 'available')
      .map((t) => t.tableNumber)

    if (availableTables.length === 0) {
      remainingQueue.push(item)
      continue
    }

    const allowedTables = getAllowedTables(item, availableTables)
    if (allowedTables.length === 0) {
      remainingQueue.push(item)
      continue
    }

    const tableNumber = allowedTables[0]
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

    if (item.groupKey && item.groupSize === 3) {
      assignedGroupKeys.add(item.groupKey)
    }
  }

  return { tables: updatedTables, remainingQueue }
}

// ==================== API HANDLERS ====================

/**
 * Get live score data (tables + match queue)
 */
export const getLiveScore = async () => {
  let events = await getStartedEvents()

  // Always attempt auto-generation for any started event that needs it,
  // even if other events are mid-play. autoGenerateForEvent is a no-op
  // when the event already has its groups/schedule generated.
  const anyChanged = await autoGenerateForStartedEvents(events)
  if (anyChanged) {
    events = await getStartedEvents()
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
  const result = assignTablesToMatches(tables, unassignedQueue, allMatchItems)
  await saveTableState(result.tables, result.remainingQueue)

  return { tables: result.tables, matchQueue: result.remainingQueue }
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
  const result = assignTablesToMatches(tables, unassignedQueue, allMatchItems)
  await saveTableState(result.tables, result.remainingQueue)

  return { tables: result.tables, matchQueue: result.remainingQueue }
}
