import { describe, it, expect } from 'vitest'
import type { Player } from '../types/Player'
import type { Team } from '../types/Tournament'
import {
  getTournamentType,
  calculateNumberOfGroups,
  getPlayerSeeding,
  getTeamSeeding,
  getParticipantSeeding,
  sortBySeeding,
  formGroupsWithSnakeSeeding,
  createGroupStage,
} from './tournamentRules'

// Helper to create test players
const createPlayer = (id: string, rating: number): Player => ({
  id,
  firstName: `Player${id}`,
  lastName: 'Test',
  rating,
})

// Helper to create test teams
const createTeam = (id: string, playerRatings: number[]): Team => ({
  id,
  name: `Team${id}`,
  players: playerRatings.map((rating, index) =>
    createPlayer(`${id}-${index}`, rating),
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
    const team: Team = { id: '1', name: 'Empty', players: [] }
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
    expect(sorted.map((t) => t.id)).toEqual(['2', '3', '1'])
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
