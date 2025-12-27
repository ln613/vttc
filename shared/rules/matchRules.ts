import type { Player } from '../types/Player'
import type { Team } from '../types/Tournament'
import type {
  Game,
  GameConfig,
  Match,
  MatchConfig,
  TeamMatch,
  TeamMatchConfig,
  TeamAssignment,
  GameType,
} from '../types/Match'
import {
  DEFAULT_GAME_CONFIG,
  SHORT_GAME_CONFIG,
  LONG_GAME_CONFIG,
  DEFAULT_MATCH_CONFIG,
  SEMIFINAL_MATCH_CONFIG,
  HANDICAP_RATING_DIVISOR,
  MAX_HANDICAP_POINTS,
} from '../types/Match'

// ==================== GAME RULES ====================

/**
 * Validate game configuration
 */
export const validateGameConfig = (config: GameConfig): void => {
  if (config.targetPoints <= 0) {
    throw new Error('Target points must be positive')
  }
  if (config.handicap !== undefined && (config.handicap < 0 || config.handicap > MAX_HANDICAP_POINTS)) {
    throw new Error(`Handicap must be between 0 and ${MAX_HANDICAP_POINTS}`)
  }
  // Handicap game cannot be short (7 points) or long (21 points)
  if (config.type === 'handicap' && config.targetPoints !== 11) {
    throw new Error('Handicap game cannot be short or long game')
  }
}

/**
 * Get target points for a game type
 */
export const getTargetPoints = (type: GameType): number => {
  switch (type) {
    case 'short':
      return 7
    case 'long':
      return 21
    default:
      return 11
  }
}

/**
 * Get deuce point (point at which alternating serves starts and must win by 2)
 */
export const getDeucePoint = (targetPoints: number): number => {
  return targetPoints - 1 // 10 for 11-point, 6 for 7-point, 20 for 21-point
}

/**
 * Check if the game is at deuce
 */
export const isAtDeuce = (
  score1: number,
  score2: number,
  targetPoints: number,
): boolean => {
  const deucePoint = getDeucePoint(targetPoints)
  return score1 >= deucePoint && score2 >= deucePoint
}

/**
 * Determine the winner of a game
 */
export const determineGameWinner = (
  score1: number,
  score2: number,
  config: GameConfig,
): 1 | 2 | undefined => {
  const { targetPoints, isGolden } = config
  const deucePoint = getDeucePoint(targetPoints)

  // Check if either side reached target points
  if (score1 < targetPoints && score2 < targetPoints) {
    return undefined // Game not finished
  }

  // Golden game: first to target wins
  if (isGolden) {
    if (score1 >= targetPoints) return 1
    if (score2 >= targetPoints) return 2
    return undefined
  }

  // Regular game: must win by 2 at deuce
  if (score1 >= deucePoint && score2 >= deucePoint) {
    // At deuce, must lead by 2
    if (score1 - score2 >= 2) return 1
    if (score2 - score1 >= 2) return 2
    return undefined
  }

  // Not at deuce, first to target wins
  if (score1 >= targetPoints) return 1
  if (score2 >= targetPoints) return 2
  return undefined
}

/**
 * Check if it's time to alternate serve (every 2 points normally, every 1 at deuce)
 */
export const shouldAlternateServe = (
  totalPoints: number,
  isDeuce: boolean,
): boolean => {
  if (isDeuce) {
    return true // Alternate every point at deuce
  }
  return totalPoints % 2 === 0 // Alternate every 2 points normally
}

/**
 * Calculate handicap points based on rating difference
 */
export const calculateHandicap = (
  rating1: number,
  rating2: number,
  divisor: number = HANDICAP_RATING_DIVISOR,
): { side: 1 | 2; points: number } => {
  const diff = Math.abs(rating1 - rating2)
  const points = Math.min(Math.floor(diff / divisor), MAX_HANDICAP_POINTS)

  // Higher rated player gives points to lower rated
  const side: 1 | 2 = rating1 > rating2 ? 2 : 1

  return { side, points }
}

/**
 * Get combined rating for a side (for handicap calculation)
 */
export const getSideRating = (players: Player[]): number => {
  return players.reduce((sum, p) => sum + p.rating, 0)
}

/**
 * Create a handicap game config
 */
export const createHandicapGameConfig = (
  side1Players: Player[],
  side2Players: Player[],
  isGolden: boolean = false,
): GameConfig => {
  const rating1 = getSideRating(side1Players)
  const rating2 = getSideRating(side2Players)
  const { points } = calculateHandicap(rating1, rating2)

  return {
    type: 'handicap',
    targetPoints: 11,
    isGolden,
    handicap: points,
  }
}

/**
 * Get starting score for a handicap game
 */
export const getHandicapStartingScore = (
  side1Players: Player[],
  side2Players: Player[],
): { score1: number; score2: number } => {
  const rating1 = getSideRating(side1Players)
  const rating2 = getSideRating(side2Players)
  const { side, points } = calculateHandicap(rating1, rating2)

  return {
    score1: side === 1 ? points : 0,
    score2: side === 2 ? points : 0,
  }
}

/**
 * Create a new game
 */
export const createGame = (
  id: string,
  config: GameConfig = DEFAULT_GAME_CONFIG,
  startingScore1: number = 0,
  startingScore2: number = 0,
): Game => {
  return {
    id,
    config,
    score1: startingScore1,
    score2: startingScore2,
    winningSide: undefined,
  }
}

/**
 * Update game score and check for winner
 */
export const updateGameScore = (
  game: Game,
  score1: number,
  score2: number,
): Game => {
  const winningSide = determineGameWinner(score1, score2, game.config)
  return {
    ...game,
    score1,
    score2,
    winningSide,
  }
}

/**
 * Get game config based on type
 */
export const getGameConfig = (
  type: GameType,
  isGolden: boolean = false,
): GameConfig => {
  let config: GameConfig

  switch (type) {
    case 'short':
      config = { ...SHORT_GAME_CONFIG }
      break
    case 'long':
      config = { ...LONG_GAME_CONFIG }
      break
    default:
      config = { ...DEFAULT_GAME_CONFIG }
  }

  return { ...config, isGolden }
}

// ==================== MATCH RULES ====================

/**
 * Validate match configuration
 */
export const validateMatchConfig = (config: MatchConfig): void => {
  const validGameCounts = [1, 3, 5, 7]
  if (!validGameCounts.includes(config.numberOfGames)) {
    throw new Error('Number of games must be 1, 3, 5, or 7')
  }
}

/**
 * Calculate games needed to win a match
 */
export const gamesNeededToWin = (numberOfGames: number): number => {
  return Math.ceil(numberOfGames / 2)
}

/**
 * Determine the winner of a match
 */
export const determineMatchWinner = (
  gamesWon1: number,
  gamesWon2: number,
  config: MatchConfig,
): 1 | 2 | undefined => {
  const needed = gamesNeededToWin(config.numberOfGames)

  if (config.isSuddenDeath) {
    // Sudden death: first to win majority
    if (gamesWon1 >= needed) return 1
    if (gamesWon2 >= needed) return 2
    return undefined
  } else {
    // Non-sudden death: play all games, most wins
    const totalPlayed = gamesWon1 + gamesWon2
    if (totalPlayed < config.numberOfGames) return undefined
    if (gamesWon1 > gamesWon2) return 1
    if (gamesWon2 > gamesWon1) return 2
    return undefined // Tie (shouldn't happen with odd number of games)
  }
}

/**
 * Check if match is complete
 */
export const isMatchComplete = (
  gamesWon1: number,
  gamesWon2: number,
  config: MatchConfig,
): boolean => {
  return determineMatchWinner(gamesWon1, gamesWon2, config) !== undefined
}

/**
 * Get match config based on round (semifinals/finals get best of 5)
 */
export const getMatchConfigForRound = (
  roundName: string,
): MatchConfig => {
  if (roundName === 'Semifinal' || roundName === 'Final') {
    return { ...SEMIFINAL_MATCH_CONFIG }
  }
  return { ...DEFAULT_MATCH_CONFIG }
}

/**
 * Create a new match
 */
export const createMatch = (
  id: string,
  side1: Player[],
  side2: Player[],
  config: MatchConfig = DEFAULT_MATCH_CONFIG,
): Match => {
  return {
    id,
    config,
    side1,
    side2,
    games: [],
    gamesWon1: 0,
    gamesWon2: 0,
    winningSide: undefined,
  }
}

/**
 * Add a game result to a match
 */
export const addGameToMatch = (match: Match, game: Game): Match => {
  if (match.winningSide) {
    throw new Error('Match is already complete')
  }

  const newGames = [...match.games, game]
  const gamesWon1 = match.gamesWon1 + (game.winningSide === 1 ? 1 : 0)
  const gamesWon2 = match.gamesWon2 + (game.winningSide === 2 ? 1 : 0)
  const winningSide = determineMatchWinner(gamesWon1, gamesWon2, match.config)

  return {
    ...match,
    games: newGames,
    gamesWon1,
    gamesWon2,
    winningSide,
  }
}

/**
 * Update match with all games
 */
export const updateMatch = (match: Match, games: Game[]): Match => {
  const gamesWon1 = games.filter((g) => g.winningSide === 1).length
  const gamesWon2 = games.filter((g) => g.winningSide === 2).length
  const winningSide = determineMatchWinner(gamesWon1, gamesWon2, match.config)

  return {
    ...match,
    games,
    gamesWon1,
    gamesWon2,
    winningSide,
  }
}

// ==================== TEAM MATCH RULES ====================

/**
 * Get the number of matches in a team match based on type
 */
export const getTeamMatchCount = (type: TeamMatchConfig['type']): number => {
  switch (type) {
    case 'type1':
      return 3
    case 'type2':
      return 5
    case 'type3':
      return 5
    default:
      return 3
  }
}

/**
 * Calculate matches needed to win a team match
 */
export const teamMatchesNeededToWin = (totalMatches: number): number => {
  return Math.ceil(totalMatches / 2)
}

/**
 * Get match lineup for a team match type
 * Returns array of [homePlayers, awayPlayers] for each match
 */
export const getTeamMatchLineup = (
  type: TeamMatchConfig['type'],
  homeAssignment: TeamAssignment,
  awayAssignment: TeamAssignment,
): { home: Player[]; away: Player[]; isDoubles: boolean }[] => {
  const { A, B, C } = homeAssignment
  const { A: X, B: Y, C: Z } = awayAssignment

  switch (type) {
    case 'type1':
      // Team of 2, 3 matches
      return [
        { home: [A], away: [X], isDoubles: false }, // A vs X
        { home: [B], away: [Y], isDoubles: false }, // B vs Y
        { home: [A, B], away: [X, Y], isDoubles: true }, // AB vs XY
      ]

    case 'type2':
      // Team of 2, 5 matches
      return [
        { home: [A], away: [X], isDoubles: false }, // A vs X
        { home: [B], away: [Y], isDoubles: false }, // B vs Y
        { home: [A, B], away: [X, Y], isDoubles: true }, // AB vs XY
        { home: [A], away: [Y], isDoubles: false }, // A vs Y
        { home: [B], away: [X], isDoubles: false }, // B vs X
      ]

    case 'type3':
      // Team of 3, 5 matches
      if (!C || !Z) {
        throw new Error('Type 3 team match requires 3 players per team')
      }
      return [
        { home: [B, C], away: [Y, Z], isDoubles: true }, // BC vs YZ
        { home: [A], away: [X], isDoubles: false }, // A vs X
        { home: [C], away: [Z], isDoubles: false }, // C vs Z
        { home: [A], away: [Y], isDoubles: false }, // A vs Y
        { home: [B], away: [X], isDoubles: false }, // B vs X
      ]

    default:
      throw new Error(`Unknown team match type: ${type}`)
  }
}

/**
 * Derive remaining team members from provided assignment
 */
export const deriveTeamAssignment = (
  team: Team,
  providedAssignment: Partial<TeamAssignment>,
  nop: 2 | 3 | 4,
): TeamAssignment => {
  const assignedIds = new Set(
    Object.values(providedAssignment)
      .filter((p): p is Player => p !== undefined)
      .map((p) => p.id),
  )

  const remaining = team.players.filter((p) => !assignedIds.has(p.id))

  if (nop === 2) {
    // A is provided, derive B
    return {
      A: providedAssignment.A!,
      B: remaining[0],
    }
  }

  if (nop === 3) {
    // A, B provided, derive C
    return {
      A: providedAssignment.A!,
      B: providedAssignment.B!,
      C: remaining[0],
    }
  }

  if (nop === 4) {
    // A, B, C provided, derive D
    return {
      A: providedAssignment.A!,
      B: providedAssignment.B!,
      C: providedAssignment.C!,
      D: remaining[0],
    }
  }

  return providedAssignment as TeamAssignment
}

/**
 * Determine the winner of a team match
 */
export const determineTeamMatchWinner = (
  homeWins: number,
  awayWins: number,
  totalMatches: number,
): 'home' | 'away' | undefined => {
  const needed = teamMatchesNeededToWin(totalMatches)

  // Team matches are always sudden death
  if (homeWins >= needed) return 'home'
  if (awayWins >= needed) return 'away'
  return undefined
}

/**
 * Create a new team match
 */
export const createTeamMatch = (
  id: string,
  homeTeam: Team,
  awayTeam: Team,
  homeAssignment: TeamAssignment,
  awayAssignment: TeamAssignment,
  config: TeamMatchConfig,
): TeamMatch => {
  return {
    id,
    config,
    homeTeam,
    awayTeam,
    homeAssignment,
    awayAssignment,
    matches: [],
    matchesWon: { home: 0, away: 0 },
    winningSide: undefined,
  }
}

/**
 * Add a match result to a team match
 */
export const addMatchToTeamMatch = (
  teamMatch: TeamMatch,
  match: Match,
  isHomeWin: boolean,
): TeamMatch => {
  if (teamMatch.winningSide) {
    throw new Error('Team match is already complete')
  }

  const newMatches = [...teamMatch.matches, match]
  const homeWins = teamMatch.matchesWon.home + (isHomeWin ? 1 : 0)
  const awayWins = teamMatch.matchesWon.away + (isHomeWin ? 0 : 1)
  const totalMatches = getTeamMatchCount(teamMatch.config.type)
  const winningSide = determineTeamMatchWinner(homeWins, awayWins, totalMatches)

  return {
    ...teamMatch,
    matches: newMatches,
    matchesWon: { home: homeWins, away: awayWins },
    winningSide,
  }
}

/**
 * Check if team match is complete
 */
export const isTeamMatchComplete = (teamMatch: TeamMatch): boolean => {
  return teamMatch.winningSide !== undefined
}

/**
 * Get the next match to be played in a team match
 */
export const getNextTeamMatchToPlay = (
  teamMatch: TeamMatch,
): { home: Player[]; away: Player[]; isDoubles: boolean; matchIndex: number } | undefined => {
  if (teamMatch.winningSide) return undefined

  const lineup = getTeamMatchLineup(
    teamMatch.config.type,
    teamMatch.homeAssignment,
    teamMatch.awayAssignment,
  )

  const playedCount = teamMatch.matches.length
  if (playedCount >= lineup.length) return undefined

  return {
    ...lineup[playedCount],
    matchIndex: playedCount,
  }
}
