import type { Player } from './Player'
import type { Match } from './Match'

export interface Team {
  id: string
  name: string
  players: Player[]
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
  isEliminationEvent: boolean // EE (true) or GE (false)
}

export interface KnockoutStage {
  type: 'knockout'
  config: KnockoutStageConfig
  seedingList: KnockoutSeedingEntry[]
  rounds: KnockoutRound[]
  numberOfRounds: number
}

export type Stage = GroupStage | KnockoutStage

export interface Tournament {
  id: string
  name: string
  date: string
  nop: number
  stages: Stage[]
}

/**
 * Default group stage configuration
 */
export const DEFAULT_GROUP_STAGE_CONFIG: GroupStageConfig = {
  advancingCount: 2,
}

/**
 * Default knockout stage configuration (Group Event)
 */
export const DEFAULT_KNOCKOUT_STAGE_CONFIG: KnockoutStageConfig = {
  isEliminationEvent: false,
}

/**
 * Elimination event knockout stage configuration
 */
export const ELIMINATION_EVENT_CONFIG: KnockoutStageConfig = {
  isEliminationEvent: true,
}
