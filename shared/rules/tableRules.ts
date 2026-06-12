import type {
  TableNumber,
  MatchQueueItem,
  TableAssignment,
  EventSummary,
  LiveScoreData,
} from '../types/Table'
import { ALL_TABLES, TABLE_ORDER } from '../types/Table'

// ==================== EVENT CLASSIFICATION ====================

/**
 * Check if event is a low-tier event (table 8 allowed for any stage)
 * - single event with rating limit 1000 and below
 * - team event with combined rating limit 2000 and below
 * - single event with max age 13 and below
 */
export const isLowTierEvent = (event: EventSummary): boolean => {
  if (isSingleRatedBelow(event, 1000)) return true
  if (isTeamRatedBelow(event, 2000)) return true
  if (isSingleUnderAge(event, 13)) return true
  return false
}

const isSingleRatedBelow = (event: EventSummary, limit: number): boolean =>
  event.type === 'Single' &&
  event.restriction === 'Rated' &&
  event.ratingLimit != null &&
  event.ratingLimit <= limit

const isTeamRatedBelow = (event: EventSummary, limit: number): boolean =>
  event.type === 'Team' &&
  event.restriction === 'Rated' &&
  event.ratingLimit != null &&
  event.ratingLimit <= limit

const isSingleUnderAge = (event: EventSummary, age: number): boolean =>
  event.type === 'Single' &&
  event.restriction === 'Age' &&
  event.ageLimitType === 'U' &&
  event.ageLimit != null &&
  event.ageLimit <= age

/**
 * Check if event is a high-tier event (stricter table rules)
 * - open singles
 * - single event with rating limit 1500 and above
 * - team event with combined rating limit 2500 and above
 * - single event with max age 15 and above (Under 15+)
 * - single event with min age 40 and above (Over 40+)
 */
export const isHighTierEvent = (event: EventSummary): boolean => {
  if (isOpenSingles(event)) return true
  if (isSingleRatedAbove(event, 1500)) return true
  if (isTeamRatedAbove(event, 2500)) return true
  if (isSingleUnderAgeAbove(event, 15)) return true
  if (isSingleOverAgeAbove(event, 40)) return true
  return false
}

const isOpenSingles = (event: EventSummary): boolean =>
  event.type === 'Single' && event.restriction === 'Open'

const isSingleRatedAbove = (event: EventSummary, limit: number): boolean =>
  event.type === 'Single' &&
  event.restriction === 'Rated' &&
  event.ratingLimit != null &&
  event.ratingLimit >= limit

const isTeamRatedAbove = (event: EventSummary, limit: number): boolean =>
  event.type === 'Team' &&
  event.restriction === 'Rated' &&
  event.ratingLimit != null &&
  event.ratingLimit >= limit

const isSingleUnderAgeAbove = (event: EventSummary, age: number): boolean =>
  event.type === 'Single' &&
  event.restriction === 'Age' &&
  event.ageLimitType === 'U' &&
  event.ageLimit != null &&
  event.ageLimit >= age

const isSingleOverAgeAbove = (event: EventSummary, age: number): boolean =>
  event.type === 'Single' &&
  event.restriction === 'Age' &&
  event.ageLimitType === 'O' &&
  event.ageLimit != null &&
  event.ageLimit >= age

// ==================== STAGE CLASSIFICATION ====================

/**
 * Check if match is a knockout match
 */
export const isKnockoutMatch = (item: MatchQueueItem): boolean =>
  item.stageType === 'knockout'

/**
 * Check if match is a final
 */
export const isFinalMatch = (item: MatchQueueItem): boolean =>
  item.roundName === 'Final'

/**
 * Check if match is a semifinal
 */
export const isSemifinalMatch = (item: MatchQueueItem): boolean =>
  item.roundName === 'Semifinal'

// ==================== TABLE ASSIGNMENT RULES ====================

// Low-tier events: any table for any stage, preferring the worse courts
// first so the better tables stay free for high-level events.
const LOW_TIER_ORDER: TableNumber[] = [1, 4, 8, 2, 3, 5, 7, 6]
// High-tier events: tables 1 and 4 are never used; table 6 is preferred
// last so it stays free for the final.
const HIGH_TIER_ORDER: TableNumber[] = [2, 3, 5, 7, 6]

/**
 * Get allowed tables for a match based on rules (priority ordered)
 *
 * Rules (by priority):
 * 1. Table 8 should never be used for knockout matches
 * 2. Low-tier events: any table for any stage
 *    - table preference order: 1, 4, 8, 2, 3, 5, 7, 6
 *    - for semifinal and final, prefer table 2 or 3
 * 3. Non-low-tier events: table 8 not used at all
 * 4. High-tier events:
 *    - do not use table 1 and 4 at all
 *    - table preference order: 2, 3, 5, 7, 6
 *    - final should be on table 6
 *    - semi final should not be on table 5
 */
export const getAllowedTables = (
  item: MatchQueueItem,
  availableTables: TableNumber[],
): TableNumber[] => {
  const event = item.event
  const isLow = isLowTierEvent(event)
  const isHigh = isHighTierEvent(event)
  const isKnockout = isKnockoutMatch(item)
  const isFinal = isFinalMatch(item)
  const isSemifinal = isSemifinalMatch(item)

  let allowed = filterByRule1(availableTables, isKnockout)

  if (isLow) {
    // Low-tier semifinal/final prefers the central tables 2 or 3.
    if (isFinal || isSemifinal) {
      return sortByLowTierKnockoutPreference(allowed)
    }
    return sortByOrder(allowed, LOW_TIER_ORDER)
  }

  allowed = filterByRule3(allowed)

  if (isHigh) {
    allowed = filterByRule4(allowed, isFinal, isSemifinal)
    if (isFinal) {
      return filterForFinal(allowed)
    }
    return sortByOrder(allowed, HIGH_TIER_ORDER)
  }

  // Mid-tier events: no explicit preference order, use the general
  // court-condition order (table 8 already excluded by rule 3).
  return sortByOrder(allowed, TABLE_ORDER)
}

/**
 * Rule 1: Table 8 should never be used for knockout matches
 */
const filterByRule1 = (
  tables: TableNumber[],
  isKnockout: boolean,
): TableNumber[] => {
  if (!isKnockout) return tables
  return tables.filter((t) => t !== 8)
}

/**
 * Rule 3: For non-low-tier events, table 8 should not be used at all
 */
const filterByRule3 = (tables: TableNumber[]): TableNumber[] =>
  tables.filter((t) => t !== 8)

/**
 * Rule 4: High-tier event restrictions
 * - do not use table 1 and 4 at all
 * - semi final should not be on table 5
 */
const filterByRule4 = (
  tables: TableNumber[],
  isFinal: boolean,
  isSemifinal: boolean,
): TableNumber[] => {
  let filtered = tables.filter((t) => t !== 1 && t !== 4)
  if (isSemifinal) {
    filtered = filtered.filter((t) => t !== 5)
  }
  return filtered
}

/**
 * Final must be on table 6. If 6 is not available, defer assignment by
 * returning [] so the final stays in the queue until table 6 frees up.
 */
const filterForFinal = (tables: TableNumber[]): TableNumber[] =>
  tables.includes(6) ? [6] : []

// Low-tier semifinal/final preference: try table 2 or 3 first, then
// fall through to the general low-tier preference order.
const sortByLowTierKnockoutPreference = (
  tables: TableNumber[],
): TableNumber[] => {
  const preferredOrder: TableNumber[] = [2, 3, ...LOW_TIER_ORDER]
  return sortByOrder(tables, preferredOrder)
}

/**
 * Sort tables by an explicit preference order (tables not in the order
 * sort to the end, preserving their relative order).
 */
const sortByOrder = (
  tables: TableNumber[],
  order: TableNumber[],
): TableNumber[] => {
  const rank = (t: TableNumber) => {
    const i = order.indexOf(t)
    return i === -1 ? order.length : i
  }
  return [...tables].sort((a, b) => rank(a) - rank(b))
}

// ==================== MATCH QUEUE BUILDING ====================

/**
 * Get the stage priority for ordering
 * Higher number = later stage = higher priority
 */
export const getStagePriority = (item: MatchQueueItem): number => {
  if (item.stageType === 'group') return 0
  return getKnockoutRoundPriority(item.roundName)
}

const getKnockoutRoundPriority = (roundName?: string): number => {
  if (!roundName) return 1
  if (roundName === 'Final') return 5
  if (roundName === 'Semifinal') return 4
  if (roundName === 'Quarterfinal') return 3
  if (roundName.startsWith('Round of')) return 2
  return 1
}

/**
 * Parse event time to minutes since midnight for comparison
 */
export const parseEventTime = (time: string): number => {
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

/**
 * Compare two events for priority in the match queue
 * - if same stage/round level, earlier start time = higher priority
 * - later stage = higher priority
 */
export const compareEventPriority = (
  a: { stagePriority: number; eventTime: number },
  b: { stagePriority: number; eventTime: number },
): number => {
  if (a.stagePriority !== b.stagePriority) {
    return b.stagePriority - a.stagePriority // higher priority first
  }
  return a.eventTime - b.eventTime // earlier time first
}

/**
 * Build the match queue from events
 */
export const buildMatchQueue = (
  matchItems: MatchQueueItem[],
): MatchQueueItem[] => {
  if (matchItems.length === 0) return []

  const byEvent = groupMatchesByEvent(matchItems)
  const eventEntries = buildEventEntries(byEvent)
  const sortedEntries = sortEventEntries(eventEntries)

  return flattenEventEntries(sortedEntries)
}

const groupMatchesByEvent = (
  items: MatchQueueItem[],
): Map<string, MatchQueueItem[]> => {
  const map = new Map<string, MatchQueueItem[]>()
  for (const item of items) {
    const key = item.eventId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return map
}

interface EventEntry {
  eventId: string
  stagePriority: number
  eventTime: number
  matches: MatchQueueItem[]
}

const buildEventEntries = (
  byEvent: Map<string, MatchQueueItem[]>,
): EventEntry[] => {
  const entries: EventEntry[] = []
  for (const [eventId, matches] of byEvent) {
    const maxPriority = Math.max(...matches.map(getStagePriority))
    const eventTime = parseEventTime(matches[0]?.event.time || '')
    entries.push({ eventId, stagePriority: maxPriority, eventTime, matches })
  }
  return entries
}

const sortEventEntries = (entries: EventEntry[]): EventEntry[] =>
  [...entries].sort((a, b) =>
    compareEventPriority(
      { stagePriority: a.stagePriority, eventTime: a.eventTime },
      { stagePriority: b.stagePriority, eventTime: b.eventTime },
    ),
  )

const flattenEventEntries = (entries: EventEntry[]): MatchQueueItem[] =>
  entries.flatMap((e) => e.matches)

// ==================== TABLE ASSIGNMENT PROCESS ====================

/**
 * Get all players currently playing on tables
 */
export const getPlayersOnTables = (
  tables: TableAssignment[],
): Set<string> => {
  const playerIds = new Set<string>()
  for (const table of tables) {
    if (table.status !== 'assigned' || !table.match) continue
    addMatchPlayers(table.match, playerIds)
  }
  return playerIds
}

const addMatchPlayers = (item: MatchQueueItem, playerIds: Set<string>) => {
  const match = item.match
  if (!match) return
  for (const p of match.side1) playerIds.add(p._id.toString())
  for (const p of match.side2) playerIds.add(p._id.toString())
}

/**
 * Check if any player in the match is currently playing
 */
export const hasPlayerConflict = (
  item: MatchQueueItem,
  playersOnTables: Set<string>,
): boolean => {
  const match = item.match
  if (!match) return false
  for (const p of match.side1) {
    if (playersOnTables.has(p._id.toString())) return true
  }
  for (const p of match.side2) {
    if (playersOnTables.has(p._id.toString())) return true
  }
  return false
}

/**
 * Check if any player in a group of 3 is currently playing
 */
export const hasGroupPlayerConflict = (
  groupKey: string,
  allItems: MatchQueueItem[],
  playersOnTables: Set<string>,
): boolean => {
  const groupItems = allItems.filter((i) => i.groupKey === groupKey)
  for (const item of groupItems) {
    if (hasPlayerConflict(item, playersOnTables)) return true
  }
  return false
}

/**
 * Assign tables to matches from the queue
 * Returns updated tables and remaining queue
 */
export const assignTablesToMatches = (
  tables: TableAssignment[],
  queue: MatchQueueItem[],
  allItems: MatchQueueItem[],
): { tables: TableAssignment[]; remainingQueue: MatchQueueItem[] } => {
  const updatedTables = tables.map((t) => ({ ...t }))
  const remainingQueue: MatchQueueItem[] = []
  const playersOnTables = getPlayersOnTables(updatedTables)
  const assignedGroupKeys = new Set<string>()

  for (const item of queue) {
    const assigned = tryAssignMatch(
      item,
      updatedTables,
      playersOnTables,
      allItems,
      assignedGroupKeys,
    )
    if (!assigned) {
      remainingQueue.push(item)
    }
  }

  return { tables: updatedTables, remainingQueue }
}

const tryAssignMatch = (
  item: MatchQueueItem,
  tables: TableAssignment[],
  playersOnTables: Set<string>,
  allItems: MatchQueueItem[],
  assignedGroupKeys: Set<string>,
): boolean => {
  // Group of 3: check all players in the group
  if (item.groupKey && item.groupSize === 3) {
    if (assignedGroupKeys.has(item.groupKey)) return false // already assigned
    if (hasGroupPlayerConflict(item.groupKey, allItems, playersOnTables))
      return false
  } else {
    if (hasPlayerConflict(item, playersOnTables)) return false
  }

  const availableTables = getAvailableTableNumbers(tables)
  if (availableTables.length === 0) return false

  const allowedTables = getAllowedTables(item, availableTables)
  if (allowedTables.length === 0) return false

  const tableNumber = allowedTables[0]
  assignMatchToTable(tables, tableNumber, item, playersOnTables)

  if (item.groupKey && item.groupSize === 3) {
    assignedGroupKeys.add(item.groupKey)
  }

  return true
}

const getAvailableTableNumbers = (tables: TableAssignment[]): TableNumber[] =>
  tables
    .filter((t) => t.status === 'available')
    .map((t) => t.tableNumber)

const assignMatchToTable = (
  tables: TableAssignment[],
  tableNumber: TableNumber,
  item: MatchQueueItem,
  playersOnTables: Set<string>,
) => {
  const tableIndex = tables.findIndex((t) => t.tableNumber === tableNumber)
  if (tableIndex === -1) return

  tables[tableIndex] = {
    ...tables[tableIndex],
    match: { ...item, tableNumber },
    status: 'assigned',
  }

  // Add players to the "on tables" set
  const match = item.match
  if (match) {
    for (const p of match.side1) playersOnTables.add(p._id.toString())
    for (const p of match.side2) playersOnTables.add(p._id.toString())
  }
}

// ==================== INITIALIZATION ====================

/**
 * Create initial table state (all available)
 */
export const createInitialTables = (): TableAssignment[] =>
  ALL_TABLES.map((tableNumber) => ({
    tableNumber,
    status: 'available',
  }))

/**
 * Check if the auto-start condition is met:
 * - match queue is empty
 * - all tables are available
 * - there is an event already started
 */
export const shouldAutoStart = (
  tables: TableAssignment[],
  queue: MatchQueueItem[],
  hasStartedEvent: boolean,
): boolean => {
  if (queue.length > 0) return false
  if (!tables.every((t) => t.status === 'available')) return false
  return hasStartedEvent
}
