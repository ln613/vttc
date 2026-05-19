import type { Player } from './Player'
import type { Match } from './Match'

export interface Team {
  _id: string
  name: string
  players: Player[]
}

/**
 * Participant Sex options
 * - All: No restriction, both men and women can participate
 * - Man: Only for men
 * - Woman: Only for women
 * - Mixed: For single same as All; For double must be 1 man + 1 woman; For team must have at least 1 woman
 */
export type ParticipantSex = 'All' | 'Man' | 'Woman' | 'Mixed'

/**
 * Tournament type
 * - Single: nop = 1
 * - Double: nop = 2
 * - Team: nop > 2
 */
export type TournamentType = 'Single' | 'Double' | 'Team'

/**
 * Get tournament type from nop
 */
export const getTournamentType = (nop: number): TournamentType => {
  if (nop === 1) return 'Single'
  if (nop === 2) return 'Double'
  return 'Team'
}

/**
 * Get nop from tournament type and team size
 */
export const getNop = (type: TournamentType, teamSize?: number): number => {
  if (type === 'Single') return 1
  if (type === 'Double') return 2
  return teamSize || 3
}

/**
 * Tournament restriction type
 * - Open: no rating limit, no age limit
 * - Rated: rating restrictions apply
 * - Age: age restrictions apply
 */
export type TournamentRestriction = 'Open' | 'Rated' | 'Age'

/**
 * Age limit type (Under or Over)
 */
export type AgeLimitType = 'U' | 'O'

/**
 * Stages type
 */
export type StagesType =
  | 'Group + Knockout'
  | 'Group Only (Big Round Robin)'
  | 'Knockout Only'

/**
 * Number of qualifiers from group stage
 */
export type QualifiersCount = 'Top 1' | 'Top 2' | 'Top 3' | 'All'

/**
 * Best of N configuration for games in each match
 */
export interface BestOfNConfig {
  groupStage: 1 | 3 | 5 | 7
  knockoutBeforeSemifinal: 1 | 3 | 5 | 7
  semifinalAndFinal: 1 | 3 | 5 | 7
}

/**
 * Tournament participant (player or team)
 */
export interface Participant {
  _id: string
  players: Player[]
  teamName?: string
  rating: number // Computed rating for seeding
}

/**
 * Participant with group and ranking information (for knockout stage seeding)
 */
export interface ParticipantWithGroupInfo {
  participant: Player | Team
  groupIndex: number // G1 = 0, G2 = 1, etc.
  ranking: number // R1 = 1, R2 = 2, etc.
}

/**
 * Match statistics for a participant in a group
 */
export interface GroupMatchStats {
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  gamesWon: number
  gamesLost: number
  gameDifference: number // GW - GL
  pointsWon: number
  pointsLost: number
  pointDifference: number // PW - PL
}

/**
 * Group stage participant with stats
 */
export interface GroupParticipant {
  participant: Player | Team
  stats: GroupMatchStats
  ranking?: number
}

/**
 * A group in the group stage
 */
export interface Group {
  index: number // G1 = 0, G2 = 1, etc.
  participants: GroupParticipant[]
  matches: Match[]
  isComplete: boolean
}

/**
 * Group stage configuration
 */
export interface GroupStageConfig {
  advancingCount: number // Number of participants advancing from each group (default 2)
}

export interface GroupStage {
  type: 'group'
  config: GroupStageConfig
  groups: Group[]
  advancedParticipants: ParticipantWithGroupInfo[]
}

/**
 * Knockout round match
 */
export interface KnockoutMatch {
  match?: Match
  participant1?: ParticipantWithGroupInfo
  participant2?: ParticipantWithGroupInfo
  isBye1: boolean // Participant 1 has a bye
  isBye2: boolean // Participant 2 has a bye
  winner?: ParticipantWithGroupInfo
}

/**
 * Knockout round
 */
export interface KnockoutRound {
  index: number // 0 = first round
  name: string // "Round of 16", "Quarterfinal", "Semifinal", "Final"
  shortName: string // "R16", "QF", "SF", "F"
  participantCount: number
  matches: KnockoutMatch[]
  isComplete: boolean
}

/**
 * Knockout stage seeding list entry
 */
export interface KnockoutSeedingEntry {
  seed: number
  participant: ParticipantWithGroupInfo
  hasBye: boolean
}

/**
 * Knockout stage configuration
 */
export interface KnockoutStageConfig {
  isKnockoutOnly: boolean // KT (true) or GT (false)
}

export interface KnockoutStage {
  type: 'knockout'
  config: KnockoutStageConfig
  seedingList: KnockoutSeedingEntry[]
  rounds: KnockoutRound[]
  numberOfRounds: number
}

export type Stage = GroupStage | KnockoutStage

/**
 * Tournament - a template for events with common configuration
 */
export interface Tournament {
  _id: string
  name: string
  sex: ParticipantSex
  type: TournamentType
  teamSize?: number // Required if type = Team
  nop: number // Derived: 1 for Single, 2 for Double, teamSize for Team
  restriction: TournamentRestriction
  ratingLimit?: number // Required if restriction = Rated
  topPlayersRatingEnabled: boolean
  topPlayersCount?: number // Required if topPlayersRatingEnabled = true
  topPlayersRatingLimit?: number // Required if topPlayersRatingEnabled = true
  ageLimitType?: AgeLimitType // Required if restriction = Age
  ageLimit?: number // Required if restriction = Age
  stages: ('group' | 'knockout')[]
  stagesType: StagesType
}

/**
 * Event - a tournament on a specific date with specific participants
 * The event's `id` field (inherited from Tournament) is the unique event identifier.
 */
export interface Event extends Tournament {
  tournamentId: string
  date: string
  time: string // e.g. "8:00 AM", "8:30 AM", ... "6:00 PM"
  maxParticipants: number // 0 = unlimited
  eventName: string // Default: tournament name
  groupGames: BestOfOption // Number of games per match in group stage
  knockoutGames: BestOfOption // Number of games per match in knockout stage
  groupMatches?: BestOfOption // Number of matches per team match in group (Team only)
  knockoutMatches?: BestOfOption // Number of matches per team match in knockout (Team only)
  qualifiers: QualifiersCount
  handicapEnabled: boolean
  handicapDifference: number // D = rating difference divisor, default 200
  handicapMaxPoints: number // MP = max points given, default 5
  participants: Participant[]
  eventStages: Stage[]
}

/**
 * Best of option for games/matches
 */
export type BestOfOption =
  | 'Best of 3'
  | 'Best of 3 before Quarterfinal'
  | 'Best of 3 before Semifinal'
  | 'Best of 5'

/**
 * Default group stage configuration
 */
export const DEFAULT_GROUP_STAGE_CONFIG: GroupStageConfig = {
  advancingCount: 2,
}

/**
 * Default knockout stage configuration (Group + Knockout Tournament - GT)
 */
export const DEFAULT_KNOCKOUT_STAGE_CONFIG: KnockoutStageConfig = {
  isKnockoutOnly: false,
}

/**
 * Knockout Only tournament configuration (KT)
 */
export const KNOCKOUT_ONLY_CONFIG: KnockoutStageConfig = {
  isKnockoutOnly: true,
}

/**
 * Default Best of N configuration
 */
export const DEFAULT_BEST_OF_N: BestOfNConfig = {
  groupStage: 3,
  knockoutBeforeSemifinal: 3,
  semifinalAndFinal: 5,
}
