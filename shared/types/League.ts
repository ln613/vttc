import type { Player } from './Player'

/**
 * An event is either a tournament on a specific date, or a round/week in a
 * league on a specific league day of the week (specs/api/tournament.md).
 */
export type EventType = 'tournament' | 'league'

/**
 * League formats (specs/rules/league.md, "Format")
 * - RR Singles: every player in team 1 plays every player in team 2
 * - Singles and Doubles: same format as the team matches in tournaments
 */
export type LeagueFormat = 'RR Singles' | 'Singles and Doubles'

export const LEAGUE_FORMATS: LeagueFormat[] = [
  'RR Singles',
  'Singles and Doubles',
]

/** 0 = Sunday, matching Date.prototype.getDay(). */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/**
 * The "format" fields of a league. Copied unchanged onto every round/week
 * event of the league, so any round document describes the whole league.
 */
export interface LeagueConfig {
  format: LeagueFormat
  dayOfWeek: DayOfWeek
  startDate: string // The first round's date; matches dayOfWeek
  numOfPhases: number // Default 1
  allowPlayerSharing: boolean // Default false
  roundGames: 'Best of 3' | 'Best of 5' // Games per sub-match, default Best of 5
  roundsPerPhase: number // Derived from the team count at schedule time
  totalRounds: number // roundsPerPhase * numOfPhases
  /**
   * Rounds may still gain roster players up to (and including) this round
   * index. Defaults to the last round — new players can be added any time.
   */
  rosterOpenUntilRound?: number
}

/**
 * One team-vs-team fixture in a round/week. `bye` marks the single team that
 * sits the round out when the team count is odd.
 */
export interface LeaguePairing {
  homeParticipantId: string
  awayParticipantId: string
  tableNumber?: number
}

export interface LeagueRoundPlan {
  roundIndex: number // 0-based, across all phases
  phase: number // 0-based
  date: string
  pairings: LeaguePairing[]
  byeParticipantId?: string
}

/**
 * The players a team fields on a given match day. Teams may carry more
 * players on the roster than they field.
 */
export interface LeagueRoundSelection {
  participantId: string
  playerIds: string[]
}

/** A row of the Standing tab (specs/pages/Event Detail.md). */
export interface LeagueStandingRow {
  participantId: string
  teamName: string
  players: Player[]
  roundsWon: number // RW
  roundsLost: number
  matchesWon: number // MW
  matchesLost: number // ML
  gamesWon: number // GW
  gamesLost: number // GL
}
