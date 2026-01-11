import type { Player } from './Player'
import type { Team } from './Tournament'

/**
 * Game type variations
 */
export type GameType = 'standard' | 'golden' | 'short' | 'long' | 'handicap'

/**
 * Game configuration
 */
export interface GameConfig {
  type: GameType
  targetPoints: number // 11 for standard, 7 for short, 21 for long
  isGolden: boolean // No need to win by 2 after deuce
  handicap?: number // Points given to the weaker side (0-5)
}

/**
 * A game between 2 sides
 */
export interface Game {
  _id: string
  config: GameConfig
  score1: number // Points for side 1
  score2: number // Points for side 2
  winningSide?: 1 | 2
}

/**
 * Match configuration
 */
export interface MatchConfig {
  numberOfGames: 1 | 3 | 5 | 7 // Best of 1, 3, 5, or 7
  isSuddenDeath: boolean // Stop when one side wins majority
  gameConfig: GameConfig
}

/**
 * A single or double match between 2 sides
 */
export interface Match {
  _id: string
  config: MatchConfig
  side1: Player[] // 1 player for single, 2 for doubles
  side2: Player[]
  games: Game[]
  gamesWon1: number // Games won by side 1
  gamesWon2: number // Games won by side 2
  winningSide?: 1 | 2
}

/**
 * Team match types
 */
export type TeamMatchType = 'type1' | 'type2' | 'type3'

/**
 * Team member assignment labels
 */
export interface TeamAssignment {
  A: Player
  B: Player
  C?: Player // For nop >= 3
  D?: Player // For nop >= 4
}

/**
 * Team match configuration
 */
export interface TeamMatchConfig {
  type: TeamMatchType
  nop: 2 | 3 | 4 // Number of players per team
  matchConfig: MatchConfig // Config for individual matches
}

/**
 * A team match consisting of multiple matches
 */
export interface TeamMatch {
  _id: string
  config: TeamMatchConfig
  homeTeam: Team
  awayTeam: Team
  homeAssignment: TeamAssignment
  awayAssignment: TeamAssignment
  matches: Match[]
  matchesWon: { home: number; away: number }
  winningSide?: 'home' | 'away'
}

/**
 * Default game configurations
 */
export const DEFAULT_GAME_CONFIG: GameConfig = {
  type: 'standard',
  targetPoints: 11,
  isGolden: false,
}

export const SHORT_GAME_CONFIG: GameConfig = {
  type: 'short',
  targetPoints: 7,
  isGolden: false,
}

export const LONG_GAME_CONFIG: GameConfig = {
  type: 'long',
  targetPoints: 21,
  isGolden: false,
}

/**
 * Default match configurations
 */
export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  numberOfGames: 3,
  isSuddenDeath: true,
  gameConfig: DEFAULT_GAME_CONFIG,
}

export const SEMIFINAL_MATCH_CONFIG: MatchConfig = {
  numberOfGames: 5,
  isSuddenDeath: true,
  gameConfig: DEFAULT_GAME_CONFIG,
}

export const FINAL_MATCH_CONFIG: MatchConfig = {
  numberOfGames: 5,
  isSuddenDeath: true,
  gameConfig: DEFAULT_GAME_CONFIG,
}

/**
 * Handicap game points difference divisor (default 200)
 */
export const DEFAULT_HANDICAP_RATING_DIVISOR = 200

/**
 * Maximum handicap points (default 5)
 */
export const DEFAULT_MAX_HANDICAP_POINTS = 5

/**
 * Handicap configuration for a game/match
 */
export interface HandicapParams {
  divisor: number // D = rating difference divisor
  maxPoints: number // MP = max points given
}

/**
 * Default handicap parameters
 */
export const DEFAULT_HANDICAP_PARAMS: HandicapParams = {
  divisor: DEFAULT_HANDICAP_RATING_DIVISOR,
  maxPoints: DEFAULT_MAX_HANDICAP_POINTS,
}
