import type { Match } from './Match'
import type { Event } from './Tournament'
import type { Player } from './Player'

/**
 * Table number (1-8)
 */
export type TableNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

/**
 * All table numbers
 */
export const ALL_TABLES: TableNumber[] = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Table order based on court condition for high quality matches
 * 6 > 7 > 2 = 3 > 5 > 4 > 1 > 8
 */
export const TABLE_ORDER: TableNumber[] = [6, 7, 2, 3, 5, 4, 1, 8]

/**
 * Match status on a table
 */
export type TableMatchStatus =
  | 'not_started'
  | 'in_progress'
  | 'finished_unconfirmed'

/**
 * A table with its current match assignment
 */
export interface TableAssignment {
  tableNumber: TableNumber
  match?: MatchQueueItem
  status: 'available' | 'assigned'
}

/**
 * Stage info for a match in the queue
 */
export type MatchStageType = 'group' | 'knockout'

export type KnockoutRoundName =
  | 'Quarterfinal'
  | 'Semifinal'
  | 'Final'
  | string

/**
 * A match in the match queue
 */
export interface MatchQueueItem {
  matchId: string
  eventId: string
  eventName: string
  // League matches only: the two teams, shown in place of the event and
  // group name, which say nothing useful for a league.
  teamNames?: { side1: string; side2: string }
  match: Match
  stageType: MatchStageType
  stageName: string // "Group 1", "Semifinal", "Final"...
  groupIndex?: number // for group stage
  roundName?: KnockoutRoundName // for knockout stage
  groupSize?: number // 3 or 4+ for group matches
  groupKey?: string // unique key for group-of-3 grouping: "eventId-groupIndex"
  matchStatus: TableMatchStatus
  tableNumber?: TableNumber
  event: EventSummary
  // For team sub-matches: pointer to the parent team match, the index of
  // this sub-match within parent.subMatches[], and the table the parent
  // is locked to.
  parent?: Match
  parentMatchId?: string
  subMatchIndex?: number
  lockedTableNumber?: TableNumber
  // Set when a team match holds this table but its next sub-match cannot
  // start yet: who it is waiting for, and where they are playing.
  waitingFor?: WaitingForPlayer[] | null
}

export interface WaitingForPlayer {
  playerId: string
  playerName: string
  tableNumber: number | null
}

/**
 * Simplified event info for table rules evaluation
 */
export interface EventSummary {
  _id: string
  eventName: string
  type: 'Single' | 'Double' | 'Team'
  nop: number
  restriction: 'Open' | 'Rated' | 'Age'
  ratingLimit?: number
  ageLimitType?: 'U' | 'O'
  ageLimit?: number
  date: string
  time: string
  stages: ('group' | 'knockout')[]
  eventType?: 'tournament' | 'league'
}

/**
 * Live score state for a table
 */
export interface TableLiveScore {
  tableNumber: TableNumber
  match?: MatchQueueItem
}

/**
 * Complete live score data
 */
export interface LiveScoreData {
  tables: TableAssignment[]
  matchQueue: MatchQueueItem[]
  /** Matches no further device can join. */
  activeSessionMatchIds?: string[]
  /** Matches whose Scorer seat is taken — all a non-tablet could have had. */
  scorerHeldMatchIds?: string[]
  /** Whether the match-day password may be used by someone with no account. */
  allowPublicUmpire?: boolean
}
