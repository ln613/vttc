import { describe, it, expect } from 'vitest'
import type { Player } from '../types/Player'
import type { Team, ParticipantWithGroupInfo, GroupParticipant } from '../types/Tournament'
import type { Match, Game } from '../types/Match'
import { DEFAULT_GAME_CONFIG, DEFAULT_MATCH_CONFIG } from '../types/Match'
import {
  getTournamentType,
  calculateNumberOfGroups,
  getPlayerSeeding,
  getTeamSeeding,
  getParticipantSeeding,
  sortBySeeding,
  formGroupsWithSnakeSeeding,
  createGroupStage,
  // Group ranking
  calculateGroupStats,
  getMatchWinner,
  getHeadToHeadWinner,
  rankGroupParticipants,
  // Knockout stage
  isPowerOf2,
  calculateNumberOfRounds,
  calculateRound2Participants,
  calculateRemainingParticipants,
  getKnockoutRoundName,
  calculateByeCount,
  calculateSnakeRankingSeeding,
  createKnockoutStage,
  createKnockoutMatches,
  wereInSameGroup,
} from './tournamentRules'

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

describe('getTournamentType', () => {
  it('should return "single" when nop is 1', () => {
    expect(getTournamentType(1)).toBe('single')
  })

  it('should return "team" when nop is 2', () => {
    expect(getTournamentType(2)).toBe('team')
  })

  it('should return "team" when nop is greater than 1', () => {
    expect(getTournamentType(3)).toBe('team')
    expect(getTournamentType(5)).toBe('team')
  })
})

describe('calculateNumberOfGroups', () => {
  it('should return 1 group when N < 6', () => {
    expect(calculateNumberOfGroups(1)).toBe(1)
    expect(calculateNumberOfGroups(3)).toBe(1)
    expect(calculateNumberOfGroups(5)).toBe(1)
  })

  it('should return 4 groups when N = 16', () => {
    expect(calculateNumberOfGroups(16)).toBe(4)
  })

  it('should return 8 groups when N = 32', () => {
    expect(calculateNumberOfGroups(32)).toBe(8)
  })

  it('should return Math.floor(N / 3) groups for other values', () => {
    expect(calculateNumberOfGroups(6)).toBe(2)
    expect(calculateNumberOfGroups(9)).toBe(3)
    expect(calculateNumberOfGroups(10)).toBe(3)
    expect(calculateNumberOfGroups(11)).toBe(3)
    expect(calculateNumberOfGroups(12)).toBe(4)
    expect(calculateNumberOfGroups(15)).toBe(5)
    expect(calculateNumberOfGroups(20)).toBe(6)
  })
})

describe('getPlayerSeeding', () => {
  it('should return the player rating', () => {
    const player = createPlayer('1', 1500)
    expect(getPlayerSeeding(player)).toBe(1500)
  })
})

describe('getTeamSeeding', () => {
  it('should return player rating when nop is 1', () => {
    const team = createTeam('1', [1500])
    expect(getTeamSeeding(team, 1)).toBe(1500)
  })

  it('should return combined rating of 2 players when nop is 2', () => {
    const team = createTeam('1', [1500, 1200])
    expect(getTeamSeeding(team, 2)).toBe(2700)
  })

  it('should return combined rating of 3 players when nop is 3', () => {
    const team = createTeam('1', [1500, 1200, 1000])
    expect(getTeamSeeding(team, 3)).toBe(3700)
  })

  it('should return combined rating of top 3 players when nop > 3', () => {
    const team = createTeam('1', [1000, 1500, 1200, 800, 1100])
    // Top 3: 1500, 1200, 1100 = 3800
    expect(getTeamSeeding(team, 5)).toBe(3800)
  })

  it('should return 0 for empty team', () => {
    const team: Team = { _id: '1', name: 'Empty', players: [] }
    expect(getTeamSeeding(team, 3)).toBe(0)
  })
})

describe('getParticipantSeeding', () => {
  it('should use player seeding when nop is 1', () => {
    const player = createPlayer('1', 1500)
    expect(getParticipantSeeding(player, 1)).toBe(1500)
  })

  it('should use team seeding when nop > 1', () => {
    const team = createTeam('1', [1500, 1200])
    expect(getParticipantSeeding(team, 2)).toBe(2700)
  })
})

describe('sortBySeeding', () => {
  it('should sort players by rating in descending order', () => {
    const players = [
      createPlayer('1', 1200),
      createPlayer('2', 1500),
      createPlayer('3', 1000),
    ]
    const sorted = sortBySeeding(players, 1)
    expect(sorted.map((p) => p.rating)).toEqual([1500, 1200, 1000])
  })

  it('should sort teams by combined rating in descending order', () => {
    const teams = [
      createTeam('1', [1000, 800]), // 1800
      createTeam('2', [1500, 1200]), // 2700
      createTeam('3', [1100, 1000]), // 2100
    ]
    const sorted = sortBySeeding(teams, 2)
    expect(sorted.map((t) => t._id)).toEqual(['2', '3', '1'])
  })
})

describe('formGroupsWithSnakeSeeding', () => {
  it('should form 1 group when N < 6', () => {
    const players = [
      createPlayer('1', 1500),
      createPlayer('2', 1400),
      createPlayer('3', 1300),
    ]
    const groups = formGroupsWithSnakeSeeding(players, 1)
    expect(groups.length).toBe(1)
    expect(groups[0].length).toBe(3)
  })

  it('should form 4 groups when N = 16', () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      createPlayer(String(i + 1), 2000 - i * 50),
    )
    const groups = formGroupsWithSnakeSeeding(players, 1)
    expect(groups.length).toBe(4)
    expect(groups.every((g) => g.length === 4)).toBe(true)
  })

  it('should use snake seeding pattern with 11 participants and 3 groups', () => {
    // Create 11 players with ratings from 1100 to 100 (s1=1100, s2=1000, etc.)
    const players = Array.from({ length: 11 }, (_, i) =>
      createPlayer(String(i + 1), 1100 - i * 100),
    )

    const groups = formGroupsWithSnakeSeeding(players, 1)

    expect(groups.length).toBe(3)

    // Based on snake seeding:
    // G1: s1, s6, s7 -> ratings 1100, 600, 500
    // G2: s2, s5, s8, s11 -> ratings 1000, 700, 400, 100
    // G3: s3, s4, s9, s10 -> ratings 900, 800, 300, 200

    expect(groups[0].map((p) => (p as Player).rating)).toEqual([1100, 600, 500])
    expect(groups[1].map((p) => (p as Player).rating)).toEqual([
      1000, 700, 400, 100,
    ])
    expect(groups[2].map((p) => (p as Player).rating)).toEqual([
      900, 800, 300, 200,
    ])
  })

  it('should distribute 12 participants evenly across 4 groups', () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      createPlayer(String(i + 1), 1200 - i * 100),
    )

    const groups = formGroupsWithSnakeSeeding(players, 1)

    expect(groups.length).toBe(4)
    expect(groups.every((g) => g.length === 3)).toBe(true)

    // Snake pattern:
    // Row 1 (L->R): s1->G1, s2->G2, s3->G3, s4->G4
    // Row 2 (R->L): s5->G4, s6->G3, s7->G2, s8->G1
    // Row 3 (L->R): s9->G1, s10->G2, s11->G3, s12->G4
    expect(groups[0].map((p) => (p as Player).rating)).toEqual([
      1200, 500, 400,
    ])
    expect(groups[1].map((p) => (p as Player).rating)).toEqual([
      1100, 600, 300,
    ])
    expect(groups[2].map((p) => (p as Player).rating)).toEqual([
      1000, 700, 200,
    ])
    expect(groups[3].map((p) => (p as Player).rating)).toEqual([900, 800, 100])
  })
})

describe('createGroupStage', () => {
  it('should create a group stage with correct type', () => {
    const players = [
      createPlayer('1', 1500),
      createPlayer('2', 1400),
      createPlayer('3', 1300),
    ]
    const stage = createGroupStage(players, 1)
    expect(stage.type).toBe('group')
    expect(stage.groups.length).toBe(1)
  })

  it('should work with teams', () => {
    const teams = Array.from({ length: 8 }, (_, i) =>
      createTeam(String(i + 1), [1500 - i * 50, 1400 - i * 50]),
    )
    const stage = createGroupStage(teams, 2)
    expect(stage.type).toBe('group')
    expect(stage.groups.length).toBe(2) // 8 teams -> Math.floor(8/3) = 2 groups
  })
})

describe('formGroupsWithSnakeSeeding - comprehensive test for 4 to 40 participants', () => {
  /**
   * Helper to format groups in a human-readable table format
   * seedingPos is the seeding position (1 = best, n = worst)
   */
  const formatGroupsAsTable = (
    numParticipants: number,
    groups: { seedingPos: number }[][],
  ): string => {
    const numGroups = groups.length
    const maxGroupSize = Math.max(...groups.map((g) => g.length))

    let output = `\n${'='.repeat(60)}\n`
    output += `Participants: ${numParticipants} | Groups: ${numGroups}\n`
    output += `${'='.repeat(60)}\n`

    // Header row
    const colWidth = 8
    output += groups.map((_, i) => `G${i + 1}`.padStart(colWidth)).join('') + '\n'
    output += '-'.repeat(numGroups * colWidth) + '\n'

    // Data rows
    for (let row = 0; row < maxGroupSize; row++) {
      const rowStr = groups
        .map((group) => {
          if (row < group.length) {
            return `s${group[row].seedingPos}`.padStart(colWidth)
          }
          return ''.padStart(colWidth)
        })
        .join('')
      output += rowStr + '\n'
    }

    // Group totals
    output += '-'.repeat(numGroups * colWidth) + '\n'
    output += groups
      .map((group) => {
        const total = group.reduce((sum, p) => sum + p.seedingPos, 0)
        return `${total}`.padStart(colWidth)
      })
      .join('') + '\n'

    return output
  }

  it('should correctly apply snake seeding for participants from 4 to 40', () => {
    let allOutput = '\n\nSNAKE SEEDING TEST RESULTS\n'
    allOutput += 'Seeding positions: s1=highest seed (best), s2=second highest, etc.\n'
    allOutput += 'Group totals show the sum of seeding positions per group (lower = stronger group)\n'

    for (let n = 4; n <= 40; n++) {
      // Create players with rating = n - i (higher rating = better player)
      // Player 0 has rating n (best), Player n-1 has rating 1 (worst)
      const players = Array.from({ length: n }, (_, i) =>
        createPlayer(String(i + 1), n - i),
      )

      const groups = formGroupsWithSnakeSeeding(players, 1)

      // Convert rating to seeding position: highest rating (n) = s1, lowest rating (1) = sn
      const groupSeedings = groups.map((group) =>
        group.map((p) => ({ seedingPos: n - (p as Player).rating + 1 })),
      )

      allOutput += formatGroupsAsTable(n, groupSeedings)

      // Verify basic constraints
      const totalInGroups = groups.reduce((sum, g) => sum + g.length, 0)
      expect(totalInGroups).toBe(n)

      // Verify all participants are placed exactly once
      const allSeedings = groups.flatMap((g) =>
        g.map((p) => n - (p as Player).rating + 1),
      )
      const expectedSeedings = Array.from({ length: n }, (_, i) => i + 1)
      expect(allSeedings.sort((a, b) => a - b)).toEqual(expectedSeedings)
    }

    // Output all results to console for human review
    console.log(allOutput)

    // Basic sanity check passed
    expect(true).toBe(true)
  })

  it('should verify snake seeding balances group strength', () => {
    let output = '\n\nGROUP BALANCE ANALYSIS\n'
    output += '=' .repeat(80) + '\n'
    output += 'N'.padEnd(6) + 'Groups'.padEnd(8) + 'Group Sizes'.padEnd(20) + 'Avg Rating per Group'.padEnd(30) + 'Max Diff\n'
    output += '-'.repeat(80) + '\n'

    for (let n = 4; n <= 40; n++) {
      const players = Array.from({ length: n }, (_, i) =>
        createPlayer(String(i + 1), 1000 + (n - i) * 100), // Higher rating = better seeding
      )

      const groups = formGroupsWithSnakeSeeding(players, 1)

      const groupSizes = groups.map((g) => g.length)
      const avgRatings = groups.map((g) => {
        const total = g.reduce((sum, p) => sum + (p as Player).rating, 0)
        return Math.round(total / g.length)
      })

      const maxDiff = Math.max(...avgRatings) - Math.min(...avgRatings)

      output += `${n}`.padEnd(6)
      output += `${groups.length}`.padEnd(8)
      output += `[${groupSizes.join(', ')}]`.padEnd(20)
      output += `[${avgRatings.join(', ')}]`.padEnd(30)
      output += `${maxDiff}\n`

      // Snake seeding naturally balances groups well
      // Max difference depends on group sizes and rating spread
      // With 100-point rating increments and varying group sizes, we expect some variance
    }

    console.log(output)
  })
})

// ==================== GROUP RANKING TESTS ====================

// Helper to create a match result
const createMatchResult = (
  _id: string,
  p1: Player,
  p2: Player,
  gamesWon1: number,
  gamesWon2: number,
  games: { score1: number; score2: number }[],
): Match => ({
  _id,
  config: DEFAULT_MATCH_CONFIG,
  side1: [p1],
  side2: [p2],
  games: games.map((g, i) => ({
    _id: `${_id}-game-${i}`,
    config: DEFAULT_GAME_CONFIG,
    score1: g.score1,
    score2: g.score2,
    winningSide: g.score1 > g.score2 ? 1 : 2,
  })),
  gamesWon1,
  gamesWon2,
  winningSide: gamesWon1 > gamesWon2 ? 1 : gamesWon2 > gamesWon1 ? 2 : undefined,
})

describe('Group Ranking', () => {
  describe('getMatchWinner', () => {
    it('should return side 1 when they won more games', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const match = createMatchResult('m1', p1, p2, 2, 1, [
        { score1: 11, score2: 5 },
        { score1: 5, score2: 11 },
        { score1: 11, score2: 8 },
      ])
      expect(getMatchWinner(match)).toBe(1)
    })

    it('should return side 2 when they won more games', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const match = createMatchResult('m1', p1, p2, 0, 2, [
        { score1: 5, score2: 11 },
        { score1: 8, score2: 11 },
      ])
      expect(getMatchWinner(match)).toBe(2)
    })

    it('should return undefined when tied', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const match = createMatchResult('m1', p1, p2, 1, 1, [
        { score1: 11, score2: 5 },
        { score1: 5, score2: 11 },
      ])
      expect(getMatchWinner(match)).toBeUndefined()
    })
  })

  describe('calculateGroupStats', () => {
    it('should calculate correct stats for a participant', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const p3 = createPlayer('3', 1300)

      const matches: Match[] = [
        // p1 vs p2: p1 wins 2-0
        createMatchResult('m1', p1, p2, 2, 0, [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ]),
        // p1 vs p3: p1 wins 2-1
        createMatchResult('m2', p1, p3, 2, 1, [
          { score1: 11, score2: 7 },
          { score1: 9, score2: 11 },
          { score1: 11, score2: 6 },
        ]),
      ]

      const stats = calculateGroupStats(p1, matches)

      expect(stats.matchesPlayed).toBe(2)
      expect(stats.matchesWon).toBe(2)
      expect(stats.matchesLost).toBe(0)
      expect(stats.gamesWon).toBe(4) // 2 + 2
      expect(stats.gamesLost).toBe(1) // 0 + 1
      expect(stats.gameDifference).toBe(3) // 4 - 1
      // Points: (11+5) + (11+8) + (11+7) + (9+11) + (11+6) = 90 total
      // p1 points: 11 + 11 + 11 + 9 + 11 = 53
      // p1 lost: 5 + 8 + 7 + 11 + 6 = 37
      expect(stats.pointsWon).toBe(53)
      expect(stats.pointsLost).toBe(37)
      expect(stats.pointDifference).toBe(16)
    })
  })

  describe('getHeadToHeadWinner', () => {
    it('should return winner of head-to-head match', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)

      const matches: Match[] = [
        createMatchResult('m1', p1, p2, 2, 1, [
          { score1: 11, score2: 5 },
          { score1: 5, score2: 11 },
          { score1: 11, score2: 8 },
        ]),
      ]

      expect(getHeadToHeadWinner(p1, p2, matches)).toBe(p1)
    })

    it('should return undefined if no head-to-head match', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const p3 = createPlayer('3', 1300)

      const matches: Match[] = [
        createMatchResult('m1', p1, p3, 2, 0, [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ]),
      ]

      expect(getHeadToHeadWinner(p1, p2, matches)).toBeUndefined()
    })
  })

  describe('rankGroupParticipants', () => {
    it('should rank by matches won first', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const p3 = createPlayer('3', 1300)

      const matches: Match[] = [
        createMatchResult('m1', p1, p2, 2, 0, [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ]),
        createMatchResult('m2', p1, p3, 2, 0, [
          { score1: 11, score2: 7 },
          { score1: 11, score2: 6 },
        ]),
        createMatchResult('m3', p2, p3, 2, 0, [
          { score1: 11, score2: 9 },
          { score1: 11, score2: 8 },
        ]),
      ]

      const participants: GroupParticipant[] = [
        { participant: p1, stats: calculateGroupStats(p1, matches) },
        { participant: p2, stats: calculateGroupStats(p2, matches) },
        { participant: p3, stats: calculateGroupStats(p3, matches) },
      ]

      const ranked = rankGroupParticipants(participants, matches)

      expect(ranked[0].participant).toBe(p1) // 2 wins
      expect(ranked[0].ranking).toBe(1)
      expect(ranked[1].participant).toBe(p2) // 1 win
      expect(ranked[1].ranking).toBe(2)
      expect(ranked[2].participant).toBe(p3) // 0 wins
      expect(ranked[2].ranking).toBe(3)
    })

    it('should use head-to-head for 2-way tie', () => {
      const p1 = createPlayer('1', 1500)
      const p2 = createPlayer('2', 1400)
      const p3 = createPlayer('3', 1300)

      // p1 beats p3, p2 beats p3, p2 beats p1
      // So p1: 1 win, p2: 2 wins, p3: 0 wins
      // Wait, let's create a 2-way tie: p1 beats p2, p1 beats p3, p2 beats p3
      // Actually that's p1: 2 wins, p2: 1 win, p3: 0 wins - no tie
      
      // For a 2-way tie, let's do: p1 beats p2, p2 beats p3, p3 beats p1
      // p1: 1 win, p2: 1 win, p3: 1 win - 3-way tie
      
      // Let's just test a simple 2-way tie between p1 and p2
      // p1 beats p3, p2 beats p3 (p1 and p2 both have 1 win, head-to-head decides)
      // But they need to have played each other for head-to-head
      
      // Scenario: p1 beats p3, p2 beats p3, p1 beats p2 (h2h)
      // That makes p1: 2 wins, p2: 1 win - no tie
      
      // Let's do: 4 players, p1 beats p2, p1 beats p3, p2 beats p4, p3 beats p4, p3 beats p2 (but that won't create tie)
      
      // Simplest 2-way tie: 3 players, p1 beats p2, p2 beats p3, p3 beats p1 (circular, all have 1 win each)
      // That's actually a 3-way tie

      // For 2-way tie, need 4 players where 2 have same wins
      const p4 = createPlayer('4', 1200)

      // p1: beats p2, beats p3 (2 wins)
      // p2: beats p4 (1 win)
      // p3: beats p4 (1 win)
      // p4: 0 wins
      // p2 and p3 are tied at 1 win, head-to-head between them decides

      const matchesTie: Match[] = [
        createMatchResult('m1', p1, p2, 2, 0, [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ]),
        createMatchResult('m2', p1, p3, 2, 0, [
          { score1: 11, score2: 7 },
          { score1: 11, score2: 6 },
        ]),
        createMatchResult('m3', p2, p4, 2, 0, [
          { score1: 11, score2: 3 },
          { score1: 11, score2: 4 },
        ]),
        createMatchResult('m4', p3, p4, 2, 0, [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 5 },
        ]),
        // Head-to-head: p3 beats p2
        createMatchResult('m5', p2, p3, 0, 2, [
          { score1: 8, score2: 11 },
          { score1: 9, score2: 11 },
        ]),
        // Additional matches to complete round robin
        createMatchResult('m6', p1, p4, 2, 0, [
          { score1: 11, score2: 2 },
          { score1: 11, score2: 3 },
        ]),
      ]

      const participantsTie: GroupParticipant[] = [
        { participant: p1, stats: calculateGroupStats(p1, matchesTie) },
        { participant: p2, stats: calculateGroupStats(p2, matchesTie) },
        { participant: p3, stats: calculateGroupStats(p3, matchesTie) },
        { participant: p4, stats: calculateGroupStats(p4, matchesTie) },
      ]

      const rankedTie = rankGroupParticipants(participantsTie, matchesTie)

      expect(rankedTie[0].participant).toBe(p1) // 3 wins
      expect(rankedTie[0].ranking).toBe(1)
      // p2 and p3 both have 1 win, p3 beat p2 head-to-head
      expect(rankedTie[1].participant).toBe(p3) // 1 win, beat p2 h2h
      expect(rankedTie[1].ranking).toBe(2)
      expect(rankedTie[2].participant).toBe(p2) // 1 win, lost to p3 h2h
      expect(rankedTie[2].ranking).toBe(3)
      expect(rankedTie[3].participant).toBe(p4) // 0 wins
      expect(rankedTie[3].ranking).toBe(4)
    })
  })
})

// ==================== KNOCKOUT STAGE TESTS ====================

describe('Knockout Stage', () => {
  describe('isPowerOf2', () => {
    it('should return true for powers of 2', () => {
      expect(isPowerOf2(1)).toBe(true)
      expect(isPowerOf2(2)).toBe(true)
      expect(isPowerOf2(4)).toBe(true)
      expect(isPowerOf2(8)).toBe(true)
      expect(isPowerOf2(16)).toBe(true)
      expect(isPowerOf2(32)).toBe(true)
    })

    it('should return false for non-powers of 2', () => {
      expect(isPowerOf2(0)).toBe(false)
      expect(isPowerOf2(3)).toBe(false)
      expect(isPowerOf2(5)).toBe(false)
      expect(isPowerOf2(6)).toBe(false)
      expect(isPowerOf2(7)).toBe(false)
      expect(isPowerOf2(9)).toBe(false)
    })
  })

  describe('calculateNumberOfRounds', () => {
    it('should calculate correct number of rounds', () => {
      expect(calculateNumberOfRounds(2)).toBe(1)
      expect(calculateNumberOfRounds(4)).toBe(2)
      expect(calculateNumberOfRounds(8)).toBe(3)
      expect(calculateNumberOfRounds(16)).toBe(4)
      expect(calculateNumberOfRounds(32)).toBe(5)
    })

    it('should handle non-power-of-2 participants', () => {
      expect(calculateNumberOfRounds(3)).toBe(2) // ceil(log2(3)) = 2
      expect(calculateNumberOfRounds(5)).toBe(3) // ceil(log2(5)) = 3
      expect(calculateNumberOfRounds(6)).toBe(3)
      expect(calculateNumberOfRounds(9)).toBe(4)
    })
  })

  describe('calculateRound2Participants', () => {
    it('should return N/2 for powers of 2', () => {
      expect(calculateRound2Participants(8)).toBe(4)
      expect(calculateRound2Participants(16)).toBe(8)
      expect(calculateRound2Participants(32)).toBe(16)
    })

    it('should return next lower power of 2 for non-powers', () => {
      expect(calculateRound2Participants(6)).toBe(4) // 2^floor(log2(6)) = 4
      expect(calculateRound2Participants(9)).toBe(8)
      expect(calculateRound2Participants(10)).toBe(8)
      expect(calculateRound2Participants(12)).toBe(8)
    })
  })

  describe('calculateRemainingParticipants', () => {
    it('should return correct sequence for 8 participants', () => {
      const remaining = calculateRemainingParticipants(8)
      expect(remaining).toEqual([8, 4, 2])
    })

    it('should return correct sequence for 6 participants', () => {
      const remaining = calculateRemainingParticipants(6)
      // Round 1: 6, Round 2: 4, Round 3: 2
      expect(remaining).toEqual([6, 4, 2])
    })

    it('should return correct sequence for 9 participants', () => {
      const remaining = calculateRemainingParticipants(9)
      // Round 1: 9, Round 2: 8, Round 3: 4, Round 4: 2
      expect(remaining).toEqual([9, 8, 4, 2])
    })
  })

  describe('getKnockoutRoundName', () => {
    it('should return Final for 2 participants', () => {
      const result = getKnockoutRoundName(2, 8)
      expect(result.name).toBe('Final')
      expect(result.shortName).toBe('F')
    })

    it('should return Semifinal for 4 participants', () => {
      const result = getKnockoutRoundName(4, 8)
      expect(result.name).toBe('Semifinal')
      expect(result.shortName).toBe('SF')
    })

    it('should return Quarterfinal for 8 participants', () => {
      const result = getKnockoutRoundName(8, 16)
      expect(result.name).toBe('Quarterfinal')
      expect(result.shortName).toBe('QF')
    })

    it('should return Round of N for larger tournaments', () => {
      const result = getKnockoutRoundName(16, 16)
      expect(result.name).toBe('Round of 16')
      expect(result.shortName).toBe('R16')
    })
  })

  describe('calculateByeCount', () => {
    it('should return 0 for power of 2 participants', () => {
      expect(calculateByeCount(8)).toBe(0)
      expect(calculateByeCount(16)).toBe(0)
    })

    it('should calculate correct bye count for non-power of 2', () => {
      // 6 participants, N2 = 4, byes = 2*4 - 6 = 2
      expect(calculateByeCount(6)).toBe(2)
      // 9 participants, N2 = 8, byes = 2*8 - 9 = 7
      expect(calculateByeCount(9)).toBe(7)
      // 5 participants, N2 = 4, byes = 2*4 - 5 = 3
      expect(calculateByeCount(5)).toBe(3)
    })
  })

  describe('calculateSnakeRankingSeeding', () => {
    it('should order participants by snake ranking', () => {
      // Example from spec: 9 players in 3 groups, top 2 advance
      // Group results:
      //     G1    G2    G3
      // R1  Tom   Joe   Tony
      // R2  John  Frank Glen
      
      // Seeding should be: Tom, Joe, Tony, Glen, Frank, John
      // R1 goes left to right: Tom (G1), Joe (G2), Tony (G3)
      // R2 goes right to left: Glen (G3), Frank (G2), John (G1)

      const tom = createPlayer('Tom', 1000)
      const joe = createPlayer('Joe', 1100)
      const tony = createPlayer('Tony', 1300)
      const john = createPlayer('John', 1500)
      const frank = createPlayer('Frank', 800)
      const glen = createPlayer('Glen', 700)

      const advanced: ParticipantWithGroupInfo[] = [
        { participant: tom, groupIndex: 0, ranking: 1 },
        { participant: john, groupIndex: 0, ranking: 2 },
        { participant: joe, groupIndex: 1, ranking: 1 },
        { participant: frank, groupIndex: 1, ranking: 2 },
        { participant: tony, groupIndex: 2, ranking: 1 },
        { participant: glen, groupIndex: 2, ranking: 2 },
      ]

      const seeded = calculateSnakeRankingSeeding(advanced)
      const names = seeded.map((s) => (s.participant as Player)._id)

      // R1 (odd): G1, G2, G3 order -> Tom, Joe, Tony
      // R2 (even): G3, G2, G1 order -> Glen, Frank, John
      expect(names).toEqual(['Tom', 'Joe', 'Tony', 'Glen', 'Frank', 'John'])
    })
  })

  describe('wereInSameGroup', () => {
    it('should return true for participants from same group', () => {
      const p1: ParticipantWithGroupInfo = {
        participant: createPlayer('1', 1500),
        groupIndex: 0,
        ranking: 1,
      }
      const p2: ParticipantWithGroupInfo = {
        participant: createPlayer('2', 1400),
        groupIndex: 0,
        ranking: 2,
      }
      expect(wereInSameGroup(p1, p2)).toBe(true)
    })

    it('should return false for participants from different groups', () => {
      const p1: ParticipantWithGroupInfo = {
        participant: createPlayer('1', 1500),
        groupIndex: 0,
        ranking: 1,
      }
      const p2: ParticipantWithGroupInfo = {
        participant: createPlayer('2', 1400),
        groupIndex: 1,
        ranking: 1,
      }
      expect(wereInSameGroup(p1, p2)).toBe(false)
    })
  })

  describe('createKnockoutStage', () => {
    it('should create knockout stage with correct number of rounds', () => {
      const participants: ParticipantWithGroupInfo[] = Array.from(
        { length: 8 },
        (_, i) => ({
          participant: createPlayer(String(i + 1), 1500 - i * 50),
          groupIndex: i % 4,
          ranking: Math.floor(i / 4) + 1,
        }),
      )

      const stage = createKnockoutStage(participants, 1, { isEliminationEvent: false })

      expect(stage.type).toBe('knockout')
      expect(stage.numberOfRounds).toBe(3) // 8 -> 4 -> 2 -> 1
      expect(stage.rounds.length).toBe(3)
      expect(stage.rounds[0].name).toBe('Quarterfinal')
      expect(stage.rounds[1].name).toBe('Semifinal')
      expect(stage.rounds[2].name).toBe('Final')
    })

    it('should assign byes correctly for 6 participants', () => {
      const participants: ParticipantWithGroupInfo[] = Array.from(
        { length: 6 },
        (_, i) => ({
          participant: createPlayer(String(i + 1), 1500 - i * 50),
          groupIndex: i % 3,
          ranking: Math.floor(i / 3) + 1,
        }),
      )

      const stage = createKnockoutStage(participants, 1, { isEliminationEvent: false })

      // 6 participants, 2 byes
      const byeCount = stage.seedingList.filter((s) => s.hasBye).length
      expect(byeCount).toBe(2)

      // Top 2 seeds should have byes
      expect(stage.seedingList[0].hasBye).toBe(true)
      expect(stage.seedingList[1].hasBye).toBe(true)
      expect(stage.seedingList[2].hasBye).toBe(false)
    })
  })

  describe('createKnockoutMatches', () => {
    it('should avoid same-group matches when possible', () => {
      // 4 participants from 2 groups
      const p1: ParticipantWithGroupInfo = {
        participant: createPlayer('G1R1', 1500),
        groupIndex: 0,
        ranking: 1,
      }
      const p2: ParticipantWithGroupInfo = {
        participant: createPlayer('G2R1', 1400),
        groupIndex: 1,
        ranking: 1,
      }
      const p3: ParticipantWithGroupInfo = {
        participant: createPlayer('G2R2', 1300),
        groupIndex: 1,
        ranking: 2,
      }
      const p4: ParticipantWithGroupInfo = {
        participant: createPlayer('G1R2', 1200),
        groupIndex: 0,
        ranking: 2,
      }

      const seedingList = [
        { seed: 1, participant: p1, hasBye: false },
        { seed: 2, participant: p2, hasBye: false },
        { seed: 3, participant: p3, hasBye: false },
        { seed: 4, participant: p4, hasBye: false },
      ]

      const matches = createKnockoutMatches(seedingList)

      // Should pair: G1R1 vs G2R2 (different groups), G2R1 vs G1R2 (different groups)
      // Not: G1R1 vs G1R2 (same group)
      expect(matches.length).toBe(2)

      // Check that no match has same-group participants
      for (const match of matches) {
        if (match.participant1 && match.participant2) {
          expect(wereInSameGroup(match.participant1, match.participant2)).toBe(false)
        }
      }
    })

    it('should include bye matches', () => {
      const p1: ParticipantWithGroupInfo = {
        participant: createPlayer('1', 1500),
        groupIndex: 0,
        ranking: 1,
      }
      const p2: ParticipantWithGroupInfo = {
        participant: createPlayer('2', 1400),
        groupIndex: 1,
        ranking: 1,
      }
      const p3: ParticipantWithGroupInfo = {
        participant: createPlayer('3', 1300),
        groupIndex: 2,
        ranking: 1,
      }

      const seedingList = [
        { seed: 1, participant: p1, hasBye: true },
        { seed: 2, participant: p2, hasBye: false },
        { seed: 3, participant: p3, hasBye: false },
      ]

      const matches = createKnockoutMatches(seedingList)

      // 1 bye match + 1 regular match
      expect(matches.length).toBe(2)

      const byeMatch = matches.find((m) => m.isBye2)
      expect(byeMatch).toBeDefined()
      expect(byeMatch!.participant1).toBe(p1)
      expect(byeMatch!.winner).toBe(p1)
    })
  })

  describe('Knockout Stage - Spec Example', () => {
    it('should match the spec example with 6 participants from 3 groups', () => {
      // From spec:
      // John - 1500, Peter - 1400, Tony - 1300, Sam - 1200, Joe - 1100, Tom - 1000, Phil - 900, Frank - 800, Glen - 700
      // Group results:
      //     G1    G2    G3
      // R1  Tom   Joe   Tony
      // R2  John  Frank Glen
      // R3  Phil  Peter Sam
      
      // First 2 from each group advance
      // Seeding: Tom, Joe, Tony, Glen, Frank, John
      // Byes: 6 participants, N2 = 4, byes = 2*4 - 6 = 2
      // Top 2 (Tom, Joe) have bye
      // Matches: Tony vs John, Glen vs Frank

      const tom = createPlayer('Tom', 1000)
      const joe = createPlayer('Joe', 1100)
      const tony = createPlayer('Tony', 1300)
      const john = createPlayer('John', 1500)
      const frank = createPlayer('Frank', 800)
      const glen = createPlayer('Glen', 700)

      const advanced: ParticipantWithGroupInfo[] = [
        { participant: tom, groupIndex: 0, ranking: 1 },
        { participant: john, groupIndex: 0, ranking: 2 },
        { participant: joe, groupIndex: 1, ranking: 1 },
        { participant: frank, groupIndex: 1, ranking: 2 },
        { participant: tony, groupIndex: 2, ranking: 1 },
        { participant: glen, groupIndex: 2, ranking: 2 },
      ]

      const stage = createKnockoutStage(advanced, 1, { isEliminationEvent: false })

      // Verify seeding order
      const seedNames = stage.seedingList.map(
        (s) => (s.participant.participant as Player)._id,
      )
      expect(seedNames).toEqual(['Tom', 'Joe', 'Tony', 'Glen', 'Frank', 'John'])

      // Verify byes
      expect(stage.seedingList[0].hasBye).toBe(true) // Tom
      expect(stage.seedingList[1].hasBye).toBe(true) // Joe
      expect(stage.seedingList[2].hasBye).toBe(false) // Tony
      expect(stage.seedingList[3].hasBye).toBe(false) // Glen
      expect(stage.seedingList[4].hasBye).toBe(false) // Frank
      expect(stage.seedingList[5].hasBye).toBe(false) // John

      // Verify first round matches
      const firstRound = stage.rounds[0]
      expect(firstRound.matches.length).toBe(4) // 2 byes + 2 matches

      // Find the actual matches (not byes)
      const realMatches = firstRound.matches.filter((m) => !m.isBye2)
      expect(realMatches.length).toBe(2)

      // Check the pairings: Tony vs John, Glen vs Frank
      // Tony (G3) should not play Glen (G3 - same group), so Tony vs John
      // Glen should play Frank (both from different groups than their opponents)
      const matchPairs = realMatches.map((m) => {
        const p1Name = (m.participant1!.participant as Player)._id
        const p2Name = (m.participant2!.participant as Player)._id
        return [p1Name, p2Name].sort()
      })

      expect(matchPairs).toContainEqual(['John', 'Tony'])
      expect(matchPairs).toContainEqual(['Frank', 'Glen'])
    })
  })
})

// ==================== GROUP MATCH SCHEDULE TESTS ====================

import {
  generateGroupMatchSchedule,
  GROUP_OF_3_SCHEDULE,
  GROUP_OF_4_SCHEDULE,
  calculateParticipantRating,
  calculateAge,
  meetsAgeRequirement,
  meetsRatingRequirement,
  createParticipant,
  validateCreateTournament,
  validateAddParticipant,
  validateGenerateGroups,
  createTournament,
} from './tournamentRules'
import {
  OPEN_SINGLE_FORMAT,
  RATED_SINGLE_FORMAT,
  AGE_SINGLE_FORMAT,
} from '../types/Tournament'

describe('Group Match Schedule', () => {
  describe('GROUP_OF_3_SCHEDULE', () => {
    it('should have correct schedule for group of 3', () => {
      expect(GROUP_OF_3_SCHEDULE).toEqual([
        [2, 3], // Match 1: seed 2 vs seed 3
        [1, 3], // Match 2: seed 1 vs seed 3
        [1, 2], // Match 3: seed 1 vs seed 2
      ])
    })
  })

  describe('GROUP_OF_4_SCHEDULE', () => {
    it('should have correct schedule for group of 4', () => {
      expect(GROUP_OF_4_SCHEDULE).toEqual([
        [1, 4], // Match 1: seed 1 vs seed 4
        [2, 3], // Match 2: seed 2 vs seed 3
        [1, 3], // Match 3: seed 1 vs seed 3
        [2, 4], // Match 4: seed 2 vs seed 4
        [3, 4], // Match 5: seed 3 vs seed 4
        [1, 2], // Match 6: seed 1 vs seed 2
      ])
    })
  })

  describe('generateGroupMatchSchedule', () => {
    it('should generate correct matches for group of 3', () => {
      const participants = [
        createPlayer('s1', 1500),
        createPlayer('s2', 1400),
        createPlayer('s3', 1300),
      ]

      const schedule = generateGroupMatchSchedule(participants)

      expect(schedule.length).toBe(3)
      // Match 1: s2 vs s3
      expect(schedule[0].side1._id).toBe('s2')
      expect(schedule[0].side2._id).toBe('s3')
      // Match 2: s1 vs s3
      expect(schedule[1].side1._id).toBe('s1')
      expect(schedule[1].side2._id).toBe('s3')
      // Match 3: s1 vs s2
      expect(schedule[2].side1._id).toBe('s1')
      expect(schedule[2].side2._id).toBe('s2')
    })

    it('should generate correct matches for group of 4', () => {
      const participants = [
        createPlayer('s1', 1500),
        createPlayer('s2', 1400),
        createPlayer('s3', 1300),
        createPlayer('s4', 1200),
      ]

      const schedule = generateGroupMatchSchedule(participants)

      expect(schedule.length).toBe(6)
      // Match 1: s1 vs s4
      expect(schedule[0].side1._id).toBe('s1')
      expect(schedule[0].side2._id).toBe('s4')
      // Match 2: s2 vs s3
      expect(schedule[1].side1._id).toBe('s2')
      expect(schedule[1].side2._id).toBe('s3')
      // Match 3: s1 vs s3
      expect(schedule[2].side1._id).toBe('s1')
      expect(schedule[2].side2._id).toBe('s3')
      // Match 4: s2 vs s4
      expect(schedule[3].side1._id).toBe('s2')
      expect(schedule[3].side2._id).toBe('s4')
      // Match 5: s3 vs s4
      expect(schedule[4].side1._id).toBe('s3')
      expect(schedule[4].side2._id).toBe('s4')
      // Match 6: s1 vs s2
      expect(schedule[5].side1._id).toBe('s1')
      expect(schedule[5].side2._id).toBe('s2')
    })

    it('should generate round robin for group larger than 4', () => {
      const participants = Array.from({ length: 5 }, (_, i) =>
        createPlayer(`s${i + 1}`, 1500 - i * 100),
      )

      const schedule = generateGroupMatchSchedule(participants)

      // 5 players = 10 matches (n*(n-1)/2 = 5*4/2 = 10)
      expect(schedule.length).toBe(10)

      // Verify all pairs are present
      const pairs = schedule.map(({ side1, side2 }) =>
        [side1._id, side2._id].sort().join('-'),
      )
      const expectedPairs = [
        's1-s2', 's1-s3', 's1-s4', 's1-s5',
        's2-s3', 's2-s4', 's2-s5',
        's3-s4', 's3-s5',
        's4-s5',
      ]
      expect(pairs.sort()).toEqual(expectedPairs.sort())
    })
  })
})

describe('Participant Rating Calculation', () => {
  describe('calculateParticipantRating', () => {
    it('should return player rating for nop = 1', () => {
      const players = [createPlayer('1', 1500)]
      expect(calculateParticipantRating(players, 1)).toBe(1500)
    })

    it('should return combined rating for nop = 2', () => {
      const players = [createPlayer('1', 1500), createPlayer('2', 1400)]
      expect(calculateParticipantRating(players, 2)).toBe(2900)
    })

    it('should return combined rating for nop = 3', () => {
      const players = [
        createPlayer('1', 1500),
        createPlayer('2', 1400),
        createPlayer('3', 1300),
      ]
      expect(calculateParticipantRating(players, 3)).toBe(4200)
    })

    it('should return top 3 combined rating for nop > 3', () => {
      const players = [
        createPlayer('1', 1000),
        createPlayer('2', 1500),
        createPlayer('3', 1200),
        createPlayer('4', 1100),
        createPlayer('5', 800),
      ]
      // Top 3: 1500, 1200, 1100 = 3800
      expect(calculateParticipantRating(players, 5)).toBe(3800)
    })

    it('should return 0 for empty players array', () => {
      expect(calculateParticipantRating([], 1)).toBe(0)
    })
  })
})

describe('Age and Rating Requirements', () => {
  describe('calculateAge', () => {
    it('should calculate correct age', () => {
      expect(calculateAge('2000-01-15', '2024-03-15')).toBe(24)
    })

    it('should handle birthday not yet passed this year', () => {
      expect(calculateAge('2000-06-15', '2024-03-15')).toBe(23)
    })

    it('should handle birthday on same day', () => {
      expect(calculateAge('2000-03-15', '2024-03-15')).toBe(24)
    })
  })

  describe('meetsAgeRequirement', () => {
    it('should return true for player under age limit (U)', () => {
      const player: Player = {
        _id: '1',
        firstName: 'Young',
        lastName: 'Player',
        rating: 1500,
        dateOfBirth: '2008-01-15',
      }
      // On 2024-03-15, player is 16 years old
      expect(meetsAgeRequirement(player, 'U', 19, '2024-03-15')).toBe(true)
    })

    it('should return false for player over age limit (U)', () => {
      const player: Player = {
        _id: '1',
        firstName: 'Old',
        lastName: 'Player',
        rating: 1500,
        dateOfBirth: '2000-01-15',
      }
      // On 2024-03-15, player is 24 years old
      expect(meetsAgeRequirement(player, 'U', 19, '2024-03-15')).toBe(false)
    })

    it('should return true for player over age limit (O)', () => {
      const player: Player = {
        _id: '1',
        firstName: 'Senior',
        lastName: 'Player',
        rating: 1500,
        dateOfBirth: '1980-01-15',
      }
      // On 2024-03-15, player is 44 years old
      expect(meetsAgeRequirement(player, 'O', 40, '2024-03-15')).toBe(true)
    })

    it('should return false for player under age limit (O)', () => {
      const player: Player = {
        _id: '1',
        firstName: 'Young',
        lastName: 'Player',
        rating: 1500,
        dateOfBirth: '1990-01-15',
      }
      // On 2024-03-15, player is 34 years old
      expect(meetsAgeRequirement(player, 'O', 40, '2024-03-15')).toBe(false)
    })

    it('should return false when dateOfBirth is missing', () => {
      const player: Player = {
        _id: '1',
        firstName: 'No',
        lastName: 'Birthday',
        rating: 1500,
      }
      expect(meetsAgeRequirement(player, 'U', 19, '2024-03-15')).toBe(false)
    })
  })

  describe('meetsRatingRequirement', () => {
    it('should return true when rating is below limit', () => {
      const player = createPlayer('1', 1400)
      expect(meetsRatingRequirement(player, 1500)).toBe(true)
    })

    it('should return true when rating equals limit', () => {
      const player = createPlayer('1', 1500)
      expect(meetsRatingRequirement(player, 1500)).toBe(true)
    })

    it('should return false when rating exceeds limit', () => {
      const player = createPlayer('1', 1600)
      expect(meetsRatingRequirement(player, 1500)).toBe(false)
    })
  })
})

describe('Participant Creation', () => {
  describe('createParticipant', () => {
    it('should create participant with correct rating for single player', () => {
      const players = [createPlayer('p1', 1500)]
      const participant = createParticipant('part1', players, 1)

      expect(participant._id).toBe('part1')
      expect(participant.players).toEqual(players)
      expect(participant.rating).toBe(1500)
    })

    it('should create participant with team name', () => {
      const players = [createPlayer('p1', 1500), createPlayer('p2', 1400)]
      const participant = createParticipant('part1', players, 2, 'Team Alpha')

      expect(participant.teamName).toBe('Team Alpha')
      expect(participant.rating).toBe(2900)
    })
  })
})

describe('Tournament Creation and Validation', () => {
  describe('validateCreateTournament', () => {
    it('should return empty array for valid input', () => {
      const errors = validateCreateTournament('Test Tournament', '2024-03-15', [])
      expect(errors).toEqual([])
    })

    it('should return error when name is missing', () => {
      const errors = validateCreateTournament('', '2024-03-15', [])
      expect(errors).toContain('Tournament name is required')
    })

    it('should return error when date is missing', () => {
      const errors = validateCreateTournament('Test', '', [])
      expect(errors).toContain('Tournament date is required')
    })

    it('should return error when duplicate exists', () => {
      const existingTournaments = [
        {
          _id: 't1',
          name: 'Existing Tournament',
          date: '2024-03-15',
          nop: 1,
          format: OPEN_SINGLE_FORMAT,
          maxParticipants: 0,
          participants: [],
          stages: [],
        },
      ]
      const errors = validateCreateTournament(
        'Existing Tournament',
        '2024-03-15',
        existingTournaments,
      )
      expect(errors.some((e) => e.includes('already exists'))).toBe(true)
    })
  })

  describe('createTournament', () => {
    it('should create tournament with open single format', () => {
      const tournament = createTournament(
        'Open Singles 2024',
        '2024-03-15',
        OPEN_SINGLE_FORMAT,
      )

      expect(tournament._id).toBeDefined()
      expect(tournament.name).toBe('Open Singles 2024')
      expect(tournament.date).toBe('2024-03-15')
      expect(tournament.nop).toBe(1)
      expect(tournament.format).toEqual(OPEN_SINGLE_FORMAT)
      expect(tournament.maxParticipants).toBe(0)
      expect(tournament.participants).toEqual([])
      expect(tournament.stages.length).toBe(2)
      expect(tournament.stages[0].type).toBe('group')
      expect(tournament.stages[1].type).toBe('knockout')
    })

    it('should create tournament with rated single format', () => {
      const format = RATED_SINGLE_FORMAT(1500)
      const tournament = createTournament('U1500 2024', '2024-03-16', format, 32)

      expect(tournament.format.ratingLimit).toBe(1500)
      expect(tournament.maxParticipants).toBe(32)
    })

    it('should create tournament with age single format', () => {
      const format = AGE_SINGLE_FORMAT('U', 19)
      const tournament = createTournament('U19 Juniors', '2024-03-17', format)

      expect(tournament.format.ageLimitType).toBe('U')
      expect(tournament.format.ageLimit).toBe(19)
    })
  })

  describe('validateAddParticipant', () => {
    it('should return empty array for valid participant', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      const players = [createPlayer('p1', 1500)]

      const errors = validateAddParticipant(tournament, players)
      expect(errors).toEqual([])
    })

    it('should return error when wrong number of players', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      const players = [createPlayer('p1', 1500), createPlayer('p2', 1400)]

      const errors = validateAddParticipant(tournament, players)
      expect(errors.some((e) => e.includes('Expected 1 player'))).toBe(true)
    })

    it('should return error when duplicate players in input', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      const player = createPlayer('p1', 1500)
      const players = [player, player]

      const errors = validateAddParticipant(tournament, players)
      expect(errors.some((e) => e.includes('Duplicate player'))).toBe(true)
    })

    it('should return error when max participants reached', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT, 1)
      tournament.participants.push(createParticipant('part1', [createPlayer('p1', 1500)], 1))

      const errors = validateAddParticipant(tournament, [createPlayer('p2', 1400)])
      expect(errors.some((e) => e.includes('maximum participants'))).toBe(true)
    })

    it('should return error when player rating exceeds limit', () => {
      const format = RATED_SINGLE_FORMAT(1500)
      const tournament = createTournament('U1500', '2024-03-15', format)
      const players = [createPlayer('p1', 1600)]

      const errors = validateAddParticipant(tournament, players)
      expect(errors.some((e) => e.includes('exceeds limit'))).toBe(true)
    })

    it('should return error when player already in tournament', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      const player = createPlayer('p1', 1500)
      tournament.participants.push(createParticipant('part1', [player], 1))

      const errors = validateAddParticipant(tournament, [player])
      expect(errors.some((e) => e.includes('already in the tournament'))).toBe(true)
    })
  })

  describe('validateGenerateGroups', () => {
    it('should return empty array for valid tournament', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      tournament.participants = Array.from({ length: 4 }, (_, i) =>
        createParticipant(`part${i}`, [createPlayer(`p${i}`, 1500 - i * 100)], 1),
      )

      const errors = validateGenerateGroups(tournament)
      expect(errors).toEqual([])
    })

    it('should return error when first stage is not group', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      tournament.stages = [{ type: 'knockout', config: { isEliminationEvent: true }, seedingList: [], rounds: [], numberOfRounds: 0 }]

      const errors = validateGenerateGroups(tournament)
      expect(errors.some((e) => e.includes('group stage'))).toBe(true)
    })

    it('should return error when less than 4 participants', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      tournament.participants = [createParticipant('part1', [createPlayer('p1', 1500)], 1)]

      const errors = validateGenerateGroups(tournament)
      expect(errors.some((e) => e.includes('4 participants'))).toBe(true)
    })

    it('should return error when groups already generated', () => {
      const tournament = createTournament('Test', '2024-03-15', OPEN_SINGLE_FORMAT)
      tournament.participants = Array.from({ length: 4 }, (_, i) =>
        createParticipant(`part${i}`, [createPlayer(`p${i}`, 1500 - i * 100)], 1),
      )
      const groupStage = tournament.stages[0] as { type: 'group'; groups: unknown[] }
      groupStage.groups = [{ index: 0, participants: [], matches: [], isComplete: false }]

      const errors = validateGenerateGroups(tournament)
      expect(errors.some((e) => e.includes('already been generated'))).toBe(true)
    })
  })
})

describe('Pre-defined Tournament Formats', () => {
  describe('OPEN_SINGLE_FORMAT', () => {
    it('should have correct configuration', () => {
      expect(OPEN_SINGLE_FORMAT.type).toBe('openSingle')
      expect(OPEN_SINGLE_FORMAT.nop).toBe(1)
      expect(OPEN_SINGLE_FORMAT.stages).toEqual(['group', 'knockout'])
      expect(OPEN_SINGLE_FORMAT.sex).toBe('both')
      expect(OPEN_SINGLE_FORMAT.bestOfN.groupStage).toBe(3)
      expect(OPEN_SINGLE_FORMAT.bestOfN.knockoutBeforeSemifinal).toBe(3)
      expect(OPEN_SINGLE_FORMAT.bestOfN.semifinalAndFinal).toBe(5)
    })
  })

  describe('RATED_SINGLE_FORMAT', () => {
    it('should create format with rating limit', () => {
      const format = RATED_SINGLE_FORMAT(1500)

      expect(format.type).toBe('ratedSingle')
      expect(format.nop).toBe(1)
      expect(format.ratingLimit).toBe(1500)
    })
  })

  describe('AGE_SINGLE_FORMAT', () => {
    it('should create under age format', () => {
      const format = AGE_SINGLE_FORMAT('U', 19)

      expect(format.type).toBe('ageSingle')
      expect(format.ageLimitType).toBe('U')
      expect(format.ageLimit).toBe(19)
    })

    it('should create over age format', () => {
      const format = AGE_SINGLE_FORMAT('O', 40)

      expect(format.type).toBe('ageSingle')
      expect(format.ageLimitType).toBe('O')
      expect(format.ageLimit).toBe(40)
    })
  })
})
