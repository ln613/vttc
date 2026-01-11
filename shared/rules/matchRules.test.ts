import { describe, it, expect } from 'vitest'
import type { Player } from '../types/Player'
import type { Team } from '../types/Tournament'
import type { Game, GameConfig, Match, MatchConfig } from '../types/Match'
import {
  DEFAULT_GAME_CONFIG,
  SHORT_GAME_CONFIG,
  LONG_GAME_CONFIG,
  DEFAULT_MATCH_CONFIG,
} from '../types/Match'
import {
  validateGameConfig,
  getTargetPoints,
  getDeucePoint,
  isAtDeuce,
  determineGameWinner,
  shouldAlternateServe,
  calculateHandicap,
  getSideRating,
  getHandicapStartingScore,
  createGame,
  updateGameScore,
  getGameConfig,
  validateMatchConfig,
  gamesNeededToWin,
  determineMatchWinner,
  isMatchComplete,
  getMatchConfigForRound,
  createMatch,
  addGameToMatch,
  getTeamMatchCount,
  teamMatchesNeededToWin,
  getTeamMatchLineup,
  deriveTeamAssignment,
  determineTeamMatchWinner,
} from './matchRules'

// Helper to create test players
const createPlayer = (_id: string, rating: number): Player => ({
  _id,
  firstName: `Player${_id}`,
  lastName: 'Test',
  rating,
})

// Helper to create test teams
const createTeam = (_id: string, playerRatings: number[]): Team => ({
  _id,
  name: `Team${_id}`,
  players: playerRatings.map((rating, index) =>
    createPlayer(`${_id}-${index}`, rating),
  ),
})

// ==================== GAME RULES TESTS ====================

describe('Game Rules', () => {
  describe('getTargetPoints', () => {
    it('should return 11 for standard game', () => {
      expect(getTargetPoints('standard')).toBe(11)
    })

    it('should return 7 for short game', () => {
      expect(getTargetPoints('short')).toBe(7)
    })

    it('should return 21 for long game', () => {
      expect(getTargetPoints('long')).toBe(21)
    })

    it('should return 11 for handicap game', () => {
      expect(getTargetPoints('handicap')).toBe(11)
    })

    it('should return 11 for golden game', () => {
      expect(getTargetPoints('golden')).toBe(11)
    })
  })

  describe('getDeucePoint', () => {
    it('should return 10 for 11-point game', () => {
      expect(getDeucePoint(11)).toBe(10)
    })

    it('should return 6 for 7-point game', () => {
      expect(getDeucePoint(7)).toBe(6)
    })

    it('should return 20 for 21-point game', () => {
      expect(getDeucePoint(21)).toBe(20)
    })
  })

  describe('isAtDeuce', () => {
    it('should return false when not at deuce point', () => {
      expect(isAtDeuce(5, 5, 11)).toBe(false)
      expect(isAtDeuce(9, 8, 11)).toBe(false)
    })

    it('should return true when both at deuce point', () => {
      expect(isAtDeuce(10, 10, 11)).toBe(true)
      expect(isAtDeuce(11, 10, 11)).toBe(true)
      expect(isAtDeuce(10, 11, 11)).toBe(true)
      expect(isAtDeuce(12, 11, 11)).toBe(true)
    })

    it('should work for short game', () => {
      expect(isAtDeuce(6, 6, 7)).toBe(true)
      expect(isAtDeuce(5, 5, 7)).toBe(false)
    })

    it('should work for long game', () => {
      expect(isAtDeuce(20, 20, 21)).toBe(true)
      expect(isAtDeuce(19, 19, 21)).toBe(false)
    })
  })

  describe('determineGameWinner', () => {
    it('should return undefined when game not finished', () => {
      expect(determineGameWinner(5, 5, DEFAULT_GAME_CONFIG)).toBeUndefined()
      expect(determineGameWinner(10, 9, DEFAULT_GAME_CONFIG)).toBeUndefined()
    })

    it('should return side 1 when they reach 11 first', () => {
      expect(determineGameWinner(11, 5, DEFAULT_GAME_CONFIG)).toBe(1)
      expect(determineGameWinner(11, 9, DEFAULT_GAME_CONFIG)).toBe(1)
    })

    it('should return side 2 when they reach 11 first', () => {
      expect(determineGameWinner(5, 11, DEFAULT_GAME_CONFIG)).toBe(2)
      expect(determineGameWinner(9, 11, DEFAULT_GAME_CONFIG)).toBe(2)
    })

    it('should require win by 2 at deuce', () => {
      expect(determineGameWinner(11, 10, DEFAULT_GAME_CONFIG)).toBeUndefined()
      expect(determineGameWinner(10, 11, DEFAULT_GAME_CONFIG)).toBeUndefined()
      expect(determineGameWinner(12, 10, DEFAULT_GAME_CONFIG)).toBe(1)
      expect(determineGameWinner(10, 12, DEFAULT_GAME_CONFIG)).toBe(2)
      expect(determineGameWinner(15, 13, DEFAULT_GAME_CONFIG)).toBe(1)
    })

    it('should not require win by 2 for golden game', () => {
      const goldenConfig: GameConfig = { ...DEFAULT_GAME_CONFIG, isGolden: true }
      expect(determineGameWinner(11, 10, goldenConfig)).toBe(1)
      expect(determineGameWinner(10, 11, goldenConfig)).toBe(2)
    })

    it('should work for short game', () => {
      expect(determineGameWinner(7, 5, SHORT_GAME_CONFIG)).toBe(1)
      expect(determineGameWinner(5, 7, SHORT_GAME_CONFIG)).toBe(2)
      expect(determineGameWinner(7, 6, SHORT_GAME_CONFIG)).toBeUndefined()
      expect(determineGameWinner(8, 6, SHORT_GAME_CONFIG)).toBe(1)
    })

    it('should work for long game', () => {
      expect(determineGameWinner(21, 15, LONG_GAME_CONFIG)).toBe(1)
      expect(determineGameWinner(15, 21, LONG_GAME_CONFIG)).toBe(2)
      expect(determineGameWinner(21, 20, LONG_GAME_CONFIG)).toBeUndefined()
      expect(determineGameWinner(22, 20, LONG_GAME_CONFIG)).toBe(1)
    })
  })

  describe('shouldAlternateServe', () => {
    it('should alternate every 2 points normally', () => {
      expect(shouldAlternateServe(0, false)).toBe(true)
      expect(shouldAlternateServe(1, false)).toBe(false)
      expect(shouldAlternateServe(2, false)).toBe(true)
      expect(shouldAlternateServe(3, false)).toBe(false)
    })

    it('should alternate every point at deuce', () => {
      expect(shouldAlternateServe(20, true)).toBe(true)
      expect(shouldAlternateServe(21, true)).toBe(true)
      expect(shouldAlternateServe(22, true)).toBe(true)
    })
  })

  describe('calculateHandicap', () => {
    it('should calculate handicap based on rating difference', () => {
      // 200 point difference = 1 point handicap
      const result = calculateHandicap(1500, 1300)
      expect(result.points).toBe(1)
      expect(result.side).toBe(2) // Lower rated gets points
    })

    it('should calculate handicap for larger differences', () => {
      // 614 point difference = 3 points (floor(614/200) = 3)
      const result = calculateHandicap(1521, 907)
      expect(result.points).toBe(3)
      expect(result.side).toBe(2)
    })

    it('should cap handicap at 5 points', () => {
      // 1500 point difference = 7.5, capped at 5
      const result = calculateHandicap(2000, 500)
      expect(result.points).toBe(5)
    })

    it('should give points to side 1 when side 2 has higher rating', () => {
      const result = calculateHandicap(1200, 1500)
      expect(result.side).toBe(1)
      expect(result.points).toBe(1)
    })

    it('should return 0 points for equal ratings', () => {
      const result = calculateHandicap(1500, 1500)
      expect(result.points).toBe(0)
    })

    it('should return 0 points for small rating difference', () => {
      // 150 point difference = 0 points (floor(150/200) = 0)
      const result = calculateHandicap(1500, 1350)
      expect(result.points).toBe(0)
    })
  })

  describe('getSideRating', () => {
    it('should sum ratings for all players on a side', () => {
      const players = [createPlayer('1', 1500), createPlayer('2', 1200)]
      expect(getSideRating(players)).toBe(2700)
    })

    it('should return single player rating', () => {
      const players = [createPlayer('1', 1500)]
      expect(getSideRating(players)).toBe(1500)
    })
  })

  describe('getHandicapStartingScore', () => {
    it('should give starting points to weaker side', () => {
      const side1 = [createPlayer('1', 1521)]
      const side2 = [createPlayer('2', 907)]

      const score = getHandicapStartingScore(side1, side2)
      expect(score.score1).toBe(0)
      expect(score.score2).toBe(3) // Lower rated side gets 3 points
    })

    it('should give points to side 1 if weaker', () => {
      const side1 = [createPlayer('1', 907)]
      const side2 = [createPlayer('2', 1521)]

      const score = getHandicapStartingScore(side1, side2)
      expect(score.score1).toBe(3)
      expect(score.score2).toBe(0)
    })
  })

  describe('createGame', () => {
    it('should create a game with default config', () => {
      const game = createGame('game-1')
      expect(game._id).toBe('game-1')
      expect(game.config).toEqual(DEFAULT_GAME_CONFIG)
      expect(game.score1).toBe(0)
      expect(game.score2).toBe(0)
      expect(game.winningSide).toBeUndefined()
    })

    it('should create a game with custom starting score', () => {
      const game = createGame('game-1', DEFAULT_GAME_CONFIG, 0, 3)
      expect(game.score1).toBe(0)
      expect(game.score2).toBe(3)
    })
  })

  describe('updateGameScore', () => {
    it('should update score and determine winner', () => {
      const game = createGame('game-1')
      const updated = updateGameScore(game, 11, 5)

      expect(updated.score1).toBe(11)
      expect(updated.score2).toBe(5)
      expect(updated.winningSide).toBe(1)
    })

    it('should not set winner if game not finished', () => {
      const game = createGame('game-1')
      const updated = updateGameScore(game, 10, 10)

      expect(updated.winningSide).toBeUndefined()
    })
  })

  describe('getGameConfig', () => {
    it('should return config for standard game', () => {
      const config = getGameConfig('standard')
      expect(config.targetPoints).toBe(11)
      expect(config.isGolden).toBe(false)
    })

    it('should return config for short game', () => {
      const config = getGameConfig('short')
      expect(config.targetPoints).toBe(7)
    })

    it('should return config for long game', () => {
      const config = getGameConfig('long')
      expect(config.targetPoints).toBe(21)
    })

    it('should set golden flag when requested', () => {
      const config = getGameConfig('standard', true)
      expect(config.isGolden).toBe(true)
    })
  })

  describe('validateGameConfig', () => {
    it('should throw for non-positive target points', () => {
      expect(() =>
        validateGameConfig({ ...DEFAULT_GAME_CONFIG, targetPoints: 0 }),
      ).toThrow('Target points must be positive')
    })

    it('should throw for handicap outside valid range', () => {
      expect(() =>
        validateGameConfig({ ...DEFAULT_GAME_CONFIG, handicap: -1 }),
      ).toThrow('Handicap must be between 0 and 5')

      expect(() =>
        validateGameConfig({ ...DEFAULT_GAME_CONFIG, handicap: 6 }),
      ).toThrow('Handicap must be between 0 and 5')
    })

    it('should throw for handicap game with non-11 points', () => {
      expect(() =>
        validateGameConfig({ type: 'handicap', targetPoints: 7, isGolden: false }),
      ).toThrow('Handicap game cannot be short or long game')
    })

    it('should not throw for valid config', () => {
      expect(() => validateGameConfig(DEFAULT_GAME_CONFIG)).not.toThrow()
      expect(() => validateGameConfig(SHORT_GAME_CONFIG)).not.toThrow()
      expect(() => validateGameConfig(LONG_GAME_CONFIG)).not.toThrow()
    })
  })
})

// ==================== MATCH RULES TESTS ====================

describe('Match Rules', () => {
  describe('gamesNeededToWin', () => {
    it('should return correct number for best of 1', () => {
      expect(gamesNeededToWin(1)).toBe(1)
    })

    it('should return correct number for best of 3', () => {
      expect(gamesNeededToWin(3)).toBe(2)
    })

    it('should return correct number for best of 5', () => {
      expect(gamesNeededToWin(5)).toBe(3)
    })

    it('should return correct number for best of 7', () => {
      expect(gamesNeededToWin(7)).toBe(4)
    })
  })

  describe('determineMatchWinner', () => {
    it('should return side 1 when they win majority (sudden death)', () => {
      const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, isSuddenDeath: true }
      expect(determineMatchWinner(2, 0, config)).toBe(1)
      expect(determineMatchWinner(2, 1, config)).toBe(1)
    })

    it('should return side 2 when they win majority (sudden death)', () => {
      const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, isSuddenDeath: true }
      expect(determineMatchWinner(0, 2, config)).toBe(2)
      expect(determineMatchWinner(1, 2, config)).toBe(2)
    })

    it('should return undefined when match not decided', () => {
      const config: MatchConfig = { ...DEFAULT_MATCH_CONFIG, isSuddenDeath: true }
      expect(determineMatchWinner(1, 1, config)).toBeUndefined()
      expect(determineMatchWinner(1, 0, config)).toBeUndefined()
    })

    it('should wait for all games in non-sudden death', () => {
      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        numberOfGames: 3,
        isSuddenDeath: false,
      }
      // Only 2 games played, need all 3
      expect(determineMatchWinner(2, 0, config)).toBeUndefined()
      // All 3 games played
      expect(determineMatchWinner(2, 1, config)).toBe(1)
    })

    it('should work for best of 5', () => {
      const config: MatchConfig = {
        ...DEFAULT_MATCH_CONFIG,
        numberOfGames: 5,
        isSuddenDeath: true,
      }
      expect(determineMatchWinner(3, 0, config)).toBe(1)
      expect(determineMatchWinner(3, 2, config)).toBe(1)
      expect(determineMatchWinner(2, 2, config)).toBeUndefined()
    })
  })

  describe('isMatchComplete', () => {
    it('should return true when match has a winner', () => {
      const config = DEFAULT_MATCH_CONFIG
      expect(isMatchComplete(2, 0, config)).toBe(true)
      expect(isMatchComplete(0, 2, config)).toBe(true)
    })

    it('should return false when match is ongoing', () => {
      const config = DEFAULT_MATCH_CONFIG
      expect(isMatchComplete(1, 0, config)).toBe(false)
      expect(isMatchComplete(1, 1, config)).toBe(false)
    })
  })

  describe('getMatchConfigForRound', () => {
    it('should return best of 5 for Semifinal', () => {
      const config = getMatchConfigForRound('Semifinal')
      expect(config.numberOfGames).toBe(5)
    })

    it('should return best of 5 for Final', () => {
      const config = getMatchConfigForRound('Final')
      expect(config.numberOfGames).toBe(5)
    })

    it('should return best of 3 for other rounds', () => {
      expect(getMatchConfigForRound('Quarterfinal').numberOfGames).toBe(3)
      expect(getMatchConfigForRound('Round of 16').numberOfGames).toBe(3)
    })
  })

  describe('createMatch', () => {
    it('should create a match with given players', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const match = createMatch('match-1', [p1], [p2])

      expect(match._id).toBe('match-1')
      expect(match.side1).toEqual([p1])
      expect(match.side2).toEqual([p2])
      expect(match.games).toEqual([])
      expect(match.gamesWon1).toBe(0)
      expect(match.gamesWon2).toBe(0)
      expect(match.winningSide).toBeUndefined()
    })
  })

  describe('addGameToMatch', () => {
    it('should add game and update games won', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const match = createMatch('match-1', [p1], [p2])

      const game: Game = {
        _id: 'game-1',
        config: DEFAULT_GAME_CONFIG,
        score1: 11,
        score2: 5,
        winningSide: 1,
      }

      const updated = addGameToMatch(match, game)
      expect(updated.games.length).toBe(1)
      expect(updated.gamesWon1).toBe(1)
      expect(updated.gamesWon2).toBe(0)
      expect(updated.winningSide).toBeUndefined() // Need 2 to win best of 3
    })

    it('should determine match winner when majority reached', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      let match = createMatch('match-1', [p1], [p2])

      const game1: Game = {
        _id: 'game-1',
        config: DEFAULT_GAME_CONFIG,
        score1: 11,
        score2: 5,
        winningSide: 1,
      }
      match = addGameToMatch(match, game1)

      const game2: Game = {
        _id: 'game-2',
        config: DEFAULT_GAME_CONFIG,
        score1: 11,
        score2: 7,
        winningSide: 1,
      }
      match = addGameToMatch(match, game2)

      expect(match.gamesWon1).toBe(2)
      expect(match.winningSide).toBe(1)
    })

    it('should throw if match is already complete', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      let match = createMatch('match-1', [p1], [p2])

      // Add 2 winning games
      match = addGameToMatch(match, {
        _id: 'game-1',
        config: DEFAULT_GAME_CONFIG,
        score1: 11,
        score2: 5,
        winningSide: 1,
      })
      match = addGameToMatch(match, {
        _id: 'game-2',
        config: DEFAULT_GAME_CONFIG,
        score1: 11,
        score2: 5,
        winningSide: 1,
      })

      expect(() =>
        addGameToMatch(match, {
          _id: 'game-3',
          config: DEFAULT_GAME_CONFIG,
          score1: 11,
          score2: 5,
          winningSide: 1,
        }),
      ).toThrow('Match is already complete')
    })
  })

  describe('validateMatchConfig', () => {
    it('should throw for invalid number of games', () => {
      expect(() =>
        validateMatchConfig({ ...DEFAULT_MATCH_CONFIG, numberOfGames: 2 as 1 | 3 | 5 | 7 }),
      ).toThrow('Number of games must be 1, 3, 5, or 7')
    })

    it('should not throw for valid configs', () => {
      expect(() =>
        validateMatchConfig({ ...DEFAULT_MATCH_CONFIG, numberOfGames: 1 }),
      ).not.toThrow()
      expect(() =>
        validateMatchConfig({ ...DEFAULT_MATCH_CONFIG, numberOfGames: 3 }),
      ).not.toThrow()
      expect(() =>
        validateMatchConfig({ ...DEFAULT_MATCH_CONFIG, numberOfGames: 5 }),
      ).not.toThrow()
      expect(() =>
        validateMatchConfig({ ...DEFAULT_MATCH_CONFIG, numberOfGames: 7 }),
      ).not.toThrow()
    })
  })
})

// ==================== TEAM MATCH RULES TESTS ====================

describe('Team Match Rules', () => {
  describe('getTeamMatchCount', () => {
    it('should return 3 for type1', () => {
      expect(getTeamMatchCount('type1')).toBe(3)
    })

    it('should return 5 for type2', () => {
      expect(getTeamMatchCount('type2')).toBe(5)
    })

    it('should return 5 for type3', () => {
      expect(getTeamMatchCount('type3')).toBe(5)
    })
  })

  describe('teamMatchesNeededToWin', () => {
    it('should return correct number for 3 matches', () => {
      expect(teamMatchesNeededToWin(3)).toBe(2)
    })

    it('should return correct number for 5 matches', () => {
      expect(teamMatchesNeededToWin(5)).toBe(3)
    })
  })

  describe('getTeamMatchLineup', () => {
    const homeAssignment = {
      A: createPlayer('A', 1500),
      B: createPlayer('B', 1400),
      C: createPlayer('C', 1300),
    }
    const awayAssignment = {
      A: createPlayer('X', 1450),
      B: createPlayer('Y', 1350),
      C: createPlayer('Z', 1250),
    }

    it('should return correct lineup for type1 (team of 2, 3 matches)', () => {
      const lineup = getTeamMatchLineup('type1', homeAssignment, awayAssignment)

      expect(lineup.length).toBe(3)
      // Match 1: A vs X (singles)
      expect(lineup[0].home).toEqual([homeAssignment.A])
      expect(lineup[0].away).toEqual([awayAssignment.A])
      expect(lineup[0].isDoubles).toBe(false)

      // Match 2: B vs Y (singles)
      expect(lineup[1].home).toEqual([homeAssignment.B])
      expect(lineup[1].away).toEqual([awayAssignment.B])
      expect(lineup[1].isDoubles).toBe(false)

      // Match 3: AB vs XY (doubles)
      expect(lineup[2].home).toEqual([homeAssignment.A, homeAssignment.B])
      expect(lineup[2].away).toEqual([awayAssignment.A, awayAssignment.B])
      expect(lineup[2].isDoubles).toBe(true)
    })

    it('should return correct lineup for type2 (team of 2, 5 matches)', () => {
      const lineup = getTeamMatchLineup('type2', homeAssignment, awayAssignment)

      expect(lineup.length).toBe(5)
      // Match 1: A vs X
      expect(lineup[0].home).toEqual([homeAssignment.A])
      expect(lineup[0].away).toEqual([awayAssignment.A])

      // Match 2: B vs Y
      expect(lineup[1].home).toEqual([homeAssignment.B])
      expect(lineup[1].away).toEqual([awayAssignment.B])

      // Match 3: AB vs XY
      expect(lineup[2].isDoubles).toBe(true)

      // Match 4: A vs Y
      expect(lineup[3].home).toEqual([homeAssignment.A])
      expect(lineup[3].away).toEqual([awayAssignment.B])

      // Match 5: B vs X
      expect(lineup[4].home).toEqual([homeAssignment.B])
      expect(lineup[4].away).toEqual([awayAssignment.A])
    })

    it('should return correct lineup for type3 (team of 3, 5 matches)', () => {
      const lineup = getTeamMatchLineup('type3', homeAssignment, awayAssignment)

      expect(lineup.length).toBe(5)
      // Match 1: BC vs YZ (doubles)
      expect(lineup[0].home).toEqual([homeAssignment.B, homeAssignment.C])
      expect(lineup[0].away).toEqual([awayAssignment.B, awayAssignment.C])
      expect(lineup[0].isDoubles).toBe(true)

      // Match 2: A vs X (singles)
      expect(lineup[1].home).toEqual([homeAssignment.A])
      expect(lineup[1].away).toEqual([awayAssignment.A])

      // Match 3: C vs Z
      expect(lineup[2].home).toEqual([homeAssignment.C])
      expect(lineup[2].away).toEqual([awayAssignment.C])

      // Match 4: A vs Y
      expect(lineup[3].home).toEqual([homeAssignment.A])
      expect(lineup[3].away).toEqual([awayAssignment.B])

      // Match 5: B vs X
      expect(lineup[4].home).toEqual([homeAssignment.B])
      expect(lineup[4].away).toEqual([awayAssignment.A])
    })
  })

  describe('deriveTeamAssignment', () => {
    it('should derive B for team of 2', () => {
      const team = createTeam('home', [1500, 1400])
      const A = team.players[0]

      const assignment = deriveTeamAssignment(team, { A }, 2)

      expect(assignment.A).toEqual(A)
      expect(assignment.B).toEqual(team.players[1])
    })

    it('should derive C for team of 3', () => {
      const team = createTeam('home', [1500, 1400, 1300])
      const A = team.players[0]
      const B = team.players[1]

      const assignment = deriveTeamAssignment(team, { A, B }, 3)

      expect(assignment.A).toEqual(A)
      expect(assignment.B).toEqual(B)
      expect(assignment.C).toEqual(team.players[2])
    })

    it('should derive D for team of 4', () => {
      const team = createTeam('home', [1500, 1400, 1300, 1200])
      const A = team.players[0]
      const B = team.players[1]
      const C = team.players[2]

      const assignment = deriveTeamAssignment(team, { A, B, C }, 4)

      expect(assignment.A).toEqual(A)
      expect(assignment.B).toEqual(B)
      expect(assignment.C).toEqual(C)
      expect(assignment.D).toEqual(team.players[3])
    })
  })

  describe('determineTeamMatchWinner', () => {
    it('should return home when they win majority', () => {
      expect(determineTeamMatchWinner(2, 0, 3)).toBe('home')
      expect(determineTeamMatchWinner(2, 1, 3)).toBe('home')
      expect(determineTeamMatchWinner(3, 0, 5)).toBe('home')
      expect(determineTeamMatchWinner(3, 2, 5)).toBe('home')
    })

    it('should return away when they win majority', () => {
      expect(determineTeamMatchWinner(0, 2, 3)).toBe('away')
      expect(determineTeamMatchWinner(1, 2, 3)).toBe('away')
      expect(determineTeamMatchWinner(0, 3, 5)).toBe('away')
      expect(determineTeamMatchWinner(2, 3, 5)).toBe('away')
    })

    it('should return undefined when not decided', () => {
      expect(determineTeamMatchWinner(1, 1, 3)).toBeUndefined()
      expect(determineTeamMatchWinner(2, 2, 5)).toBeUndefined()
      expect(determineTeamMatchWinner(1, 0, 3)).toBeUndefined()
    })
  })
})
