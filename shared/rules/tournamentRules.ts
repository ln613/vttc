import type { Player } from '../types/Player'
import type {
  Team,
  GroupParticipant,
  Group,
  GroupStage,
  GroupStageConfig,
  ParticipantWithGroupInfo,
  KnockoutStage,
  KnockoutStageConfig,
  KnockoutRound,
  KnockoutMatch,
  KnockoutSeedingEntry,
  Event,
} from '../types/Tournament'
import {
  DEFAULT_GROUP_STAGE_CONFIG,
  type Participant,
  type Tournament,
  type BestOfNConfig,
} from '../types/Tournament'
import type { Match, MatchConfig } from '../types/Match'
import { DEFAULT_MATCH_CONFIG } from '../types/Match'

/**
 * Get the tournament type based on number of players per team
 */
export const getTournamentType = (nop: number): 'single' | 'team' => {
  return nop === 1 ? 'single' : 'team'
}

/**
 * Calculate the number of groups based on total number of players/teams
 * - N < 6: 1 group
 * - N = 16: 4 groups
 * - N = 32: 8 groups
 * - otherwise, Math.floor(N / 3) groups
 */
export const calculateNumberOfGroups = (totalParticipants: number): number => {
  if (totalParticipants < 6) return 1
  if (totalParticipants === 16) return 4
  if (totalParticipants === 32) return 8
  return Math.floor(totalParticipants / 3)
}

/**
 * Calculate seeding value for a player (Rating Based Seeding - RBS)
 */
export const getPlayerSeeding = (player: Player): number => {
  return player.rating
}

/**
 * Calculate seeding value for a team based on number of players per team (nop)
 * Rating Based Seeding (RBS):
 * - nop = 1: the player's rating
 * - nop = 2 or 3: the combined rating of the 2 or 3 players in the team
 * - nop > 3: the combined rating of the top 3 players in the team
 */
export const getTeamSeeding = (team: Team, nop: number): number => {
  if (!team.players || team.players.length === 0) return 0

  if (nop === 1) {
    return team.players[0]?.rating || 0
  }

  if (nop <= 3) {
    return team.players.reduce((sum, player) => sum + player.rating, 0)
  }

  // nop > 3: use top 3 players' combined rating
  const sortedPlayers = [...team.players].sort((a, b) => b.rating - a.rating)
  return sortedPlayers.slice(0, 3).reduce((sum, player) => sum + player.rating, 0)
}

/**
 * Get seeding value for a participant (player or team)
 */
export const getParticipantSeeding = (
  participant: Player | Team,
  nop: number,
): number => {
  if (nop === 1) {
    return getPlayerSeeding(participant as Player)
  }
  return getTeamSeeding(participant as Team, nop)
}

/**
 * Sort participants by seeding (highest first)
 */
export const sortBySeeding = <T extends Player | Team>(
  participants: T[],
  nop: number,
): T[] => {
  return [...participants].sort(
    (a, b) => getParticipantSeeding(b, nop) - getParticipantSeeding(a, nop),
  )
}

/**
 * Form groups using "snake seeding" method
 *
 * Example with 11 participants and 3 groups:
 * G1    G2    G3
 * s1    s2    s3
 * s6    s5    s4
 * s7    s8    s9
 *       s11   s10
 *
 * The pattern alternates direction each row:
 * Row 1: left to right (s1, s2, s3)
 * Row 2: right to left (s6, s5, s4)
 * Row 3: left to right (s7, s8, s9)
 * Row 4: right to left (s11, s10)
 */
export const formGroupsWithSnakeSeeding = <T extends Player | Team>(
  participants: T[],
  nop: number,
): T[][] => {
  const sortedParticipants = sortBySeeding(participants, nop)
  const numberOfGroups = calculateNumberOfGroups(sortedParticipants.length)

  const groups: T[][] = Array.from({ length: numberOfGroups }, () => [])

  sortedParticipants.forEach((participant, index) => {
    const row = Math.floor(index / numberOfGroups)
    const positionInRow = index % numberOfGroups

    // Snake pattern: even rows go left-to-right, odd rows go right-to-left
    const groupIndex =
      row % 2 === 0 ? positionInRow : numberOfGroups - 1 - positionInRow

    groups[groupIndex].push(participant)
  })

  return groups
}

/**
 * Get participant ID
 */
export const getParticipantId = (participant: Player | Team): string => {
  return participant._id
}

/**
 * Check if two participants are the same
 */
export const isSameParticipant = (
  p1: Player | Team,
  p2: Player | Team,
): boolean => {
  return getParticipantId(p1) === getParticipantId(p2)
}

/**
 * Calculate match winner (side 1 or 2)
 */
export const getMatchWinner = (match: Match): 1 | 2 | undefined => {
  if (match.gamesWon1 > match.gamesWon2) return 1
  if (match.gamesWon2 > match.gamesWon1) return 2
  return undefined
}

/**
 * Calculate total points for a side in a match
 */
export const getTotalPointsInMatch = (
  match: Match,
  side: 1 | 2,
): { won: number; lost: number } => {
  let won = 0
  let lost = 0
  for (const game of match.games) {
    if (side === 1) {
      won += game.score1
      lost += game.score2
    } else {
      won += game.score2
      lost += game.score1
    }
  }
  return { won, lost }
}

/**
 * Determine which side a participant is on in a match
 */
export const getParticipantSideInMatch = (
  match: Match,
  participant: Player | Team,
): 1 | 2 | undefined => {
  const participantId = getParticipantId(participant)
  // For singles, side1 and side2 have one player each
  if (match.side1.some((p) => p._id === participantId)) return 1
  if (match.side2.some((p) => p._id === participantId)) return 2
  return undefined
}

/**
 * Calculate group match statistics for a participant
 */
export const calculateGroupStats = (
  participant: Player | Team,
  matches: Match[],
): {
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  gamesWon: number
  gamesLost: number
  gameDifference: number
  pointsWon: number
  pointsLost: number
  pointDifference: number
} => {
  let matchesPlayed = 0
  let matchesWon = 0
  let matchesLost = 0
  let gamesWon = 0
  let gamesLost = 0
  let pointsWon = 0
  let pointsLost = 0

  for (const match of matches) {
    const side = getParticipantSideInMatch(match, participant)
    if (!side) continue

    matchesPlayed++
    const winner = getMatchWinner(match)
    if (winner === side) {
      matchesWon++
    } else if (winner) {
      matchesLost++
    }

    if (side === 1) {
      gamesWon += match.gamesWon1
      gamesLost += match.gamesWon2
    } else {
      gamesWon += match.gamesWon2
      gamesLost += match.gamesWon1
    }

    const points = getTotalPointsInMatch(match, side)
    pointsWon += points.won
    pointsLost += points.lost
  }

  return {
    matchesPlayed,
    matchesWon,
    matchesLost,
    gamesWon,
    gamesLost,
    gameDifference: gamesWon - gamesLost,
    pointsWon,
    pointsLost,
    pointDifference: pointsWon - pointsLost,
  }
}

/**
 * Find head-to-head match between two participants
 */
export const findHeadToHeadMatch = (
  p1: Player | Team,
  p2: Player | Team,
  matches: Match[],
): Match | undefined => {
  return matches.find((match) => {
    const side1 = getParticipantSideInMatch(match, p1)
    const side2 = getParticipantSideInMatch(match, p2)
    return side1 && side2 && side1 !== side2
  })
}

/**
 * Determine head-to-head winner between two participants
 */
export const getHeadToHeadWinner = (
  p1: Player | Team,
  p2: Player | Team,
  matches: Match[],
): Player | Team | undefined => {
  const match = findHeadToHeadMatch(p1, p2, matches)
  if (!match) return undefined

  const side1 = getParticipantSideInMatch(match, p1)
  const winner = getMatchWinner(match)

  if (!winner) return undefined
  return winner === side1 ? p1 : p2
}

/**
 * Compare two participants for ranking (within a subset of matches)
 * Returns negative if p1 ranks higher, positive if p2 ranks higher, 0 if tied
 */
export const compareParticipantsForRanking = (
  p1: GroupParticipant,
  p2: GroupParticipant,
  matches: Match[],
): number => {
  // 1. Number of matches won
  if (p1.stats.matchesWon !== p2.stats.matchesWon) {
    return p2.stats.matchesWon - p1.stats.matchesWon
  }

  // 2. Number of matches lost (lower is better)
  if (p1.stats.matchesLost !== p2.stats.matchesLost) {
    return p1.stats.matchesLost - p2.stats.matchesLost
  }

  // 3. Head-to-head (for 2-way tie only - this is called separately for multi-way ties)
  const h2hWinner = getHeadToHeadWinner(p1.participant, p2.participant, matches)
  if (h2hWinner) {
    return isSameParticipant(h2hWinner, p1.participant) ? -1 : 1
  }

  return 0
}

/**
 * Compare participants based on stats only (for multi-way ties)
 */
export const compareByStatsOnly = (
  p1: GroupParticipant,
  p2: GroupParticipant,
): number => {
  // a. Game Difference (GD)
  if (p1.stats.gameDifference !== p2.stats.gameDifference) {
    return p2.stats.gameDifference - p1.stats.gameDifference
  }

  // b. Games Won (GW)
  if (p1.stats.gamesWon !== p2.stats.gamesWon) {
    return p2.stats.gamesWon - p1.stats.gamesWon
  }

  // c. Point Difference (PD)
  if (p1.stats.pointDifference !== p2.stats.pointDifference) {
    return p2.stats.pointDifference - p1.stats.pointDifference
  }

  // d. Points Won (PW)
  return p2.stats.pointsWon - p1.stats.pointsWon
}

/**
 * Get matches only between a subset of participants
 */
export const getMatchesBetweenParticipants = (
  participants: GroupParticipant[],
  allMatches: Match[],
): Match[] => {
  const participantIds = new Set(
    participants.map((gp) => getParticipantId(gp.participant)),
  )

  return allMatches.filter((match) => {
    // Both sides must be in the participant set
    const side1InSet = match.side1.some((p) => participantIds.has(p._id))
    const side2InSet = match.side2.some((p) => participantIds.has(p._id))
    return side1InSet && side2InSet
  })
}

/**
 * Recalculate stats for participants based on a subset of matches
 */
export const recalculateStatsForSubset = (
  participants: GroupParticipant[],
  matches: Match[],
): GroupParticipant[] => {
  return participants.map((gp) => ({
    ...gp,
    stats: calculateGroupStats(gp.participant, matches),
  }))
}

/**
 * Sub-group participants by matches lost (within a MW tie group)
 */
const subGroupByMatchesLost = (
  participants: GroupParticipant[],
): Map<number, GroupParticipant[]> => {
  const byML = new Map<number, GroupParticipant[]>()
  for (const p of participants) {
    const ml = p.stats.matchesLost
    if (!byML.has(ml)) {
      byML.set(ml, [])
    }
    byML.get(ml)!.push(p)
  }
  return byML
}

/**
 * Resolve a tied group using head-to-head (2-way) or subset stats (3+ way)
 */
const resolveTiedGroup = (
  tied: GroupParticipant[],
  matches: Match[],
  ranked: GroupParticipant[],
  startRank: number,
): number => {
  let currentRank = startRank

  if (tied.length === 1) {
    ranked.push({ ...tied[0], ranking: currentRank })
    currentRank++
  } else if (tied.length === 2) {
    // 2-way tie: use head-to-head
    const winner = getHeadToHeadWinner(
      tied[0].participant,
      tied[1].participant,
      matches,
    )

    if (winner) {
      const [first, second] = isSameParticipant(winner, tied[0].participant)
        ? [tied[0], tied[1]]
        : [tied[1], tied[0]]
      ranked.push({ ...first, ranking: currentRank })
      ranked.push({ ...second, ranking: currentRank + 1 })
    } else {
      // Tie remains, use stats
      const sortedTie = [...tied].sort(compareByStatsOnly)
      for (const p of sortedTie) {
        ranked.push({ ...p, ranking: currentRank })
        currentRank++
      }
      return currentRank
    }
    currentRank += 2
  } else {
    // 3+ way tie: use subset stats
    const subsetMatches = getMatchesBetweenParticipants(tied, matches)
    const recalculated = recalculateStatsForSubset(tied, subsetMatches)

    // Sort by the tie-breaker rules
    const sortedTie = [...recalculated].sort(compareByStatsOnly)

    for (const p of sortedTie) {
      // Find the original participant to preserve full stats
      const original = tied.find((t) =>
        isSameParticipant(t.participant, p.participant),
      )!
      ranked.push({ ...original, ranking: currentRank })
      currentRank++
    }
  }

  return currentRank
}

/**
 * Rank participants within a group
 */
export const rankGroupParticipants = (
  participants: GroupParticipant[],
  matches: Match[],
): GroupParticipant[] => {
  // Sort by matches won first
  const sorted = [...participants].sort(
    (a, b) => b.stats.matchesWon - a.stats.matchesWon,
  )

  // Group by matches won to find ties
  const byMatchesWon = new Map<number, GroupParticipant[]>()
  for (const p of sorted) {
    const mw = p.stats.matchesWon
    if (!byMatchesWon.has(mw)) {
      byMatchesWon.set(mw, [])
    }
    byMatchesWon.get(mw)!.push(p)
  }

  const ranked: GroupParticipant[] = []
  let currentRank = 1

  // Process groups in order of matches won (descending)
  const matchesWonValues = Array.from(byMatchesWon.keys()).sort((a, b) => b - a)

  for (const mw of matchesWonValues) {
    const mwGroup = byMatchesWon.get(mw)!

    if (mwGroup.length === 1) {
      // No tie, assign rank directly
      ranked.push({ ...mwGroup[0], ranking: currentRank })
      currentRank++
    } else {
      // MW tied: sub-group by ML (lower ML is better)
      const byML = subGroupByMatchesLost(mwGroup)
      const mlValues = Array.from(byML.keys()).sort((a, b) => a - b)

      for (const ml of mlValues) {
        const mlGroup = byML.get(ml)!
        currentRank = resolveTiedGroup(mlGroup, matches, ranked, currentRank)
      }
    }
  }

  return ranked
}

/**
 * Create a group stage for a tournament
 */
export const createGroupStage = <T extends Player | Team>(
  participants: T[],
  nop: number,
  config: GroupStageConfig = DEFAULT_GROUP_STAGE_CONFIG,
): GroupStage => {
  const groupArrays = formGroupsWithSnakeSeeding(participants, nop)

  const groups: Group[] = groupArrays.map((groupParticipants, index) => ({
    index,
    participants: groupParticipants.map((participant) => ({
      participant,
      stats: {
        matchesPlayed: 0,
        matchesWon: 0,
        matchesLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        gameDifference: 0,
        pointsWon: 0,
        pointsLost: 0,
        pointDifference: 0,
      },
    })),
    matches: [],
    isComplete: false,
  }))

  return {
    type: 'group',
    config,
    groups,
    advancedParticipants: [],
  }
}

/**
 * Update group rankings after matches are played
 */
export const updateGroupRankings = (group: Group): Group => {
  const rankedParticipants = rankGroupParticipants(
    group.participants,
    group.matches,
  )
  return {
    ...group,
    participants: rankedParticipants,
  }
}

/**
 * Get participants who advance from a group
 */
export const getAdvancingParticipants = (
  group: Group,
  advancingCount: number,
): ParticipantWithGroupInfo[] => {
  const sorted = [...group.participants].sort(
    (a, b) => (a.ranking || 999) - (b.ranking || 999),
  )

  return sorted.slice(0, advancingCount).map((gp) => ({
    participant: gp.participant,
    groupIndex: group.index,
    ranking: gp.ranking || 0,
  }))
}

/**
 * Complete a group stage and determine advancing participants
 */
export const completeGroupStage = (stage: GroupStage): GroupStage => {
  const updatedGroups = stage.groups.map((group) => ({
    ...updateGroupRankings(group),
    isComplete: true,
  }))

  const advancedParticipants: ParticipantWithGroupInfo[] = []
  for (const group of updatedGroups) {
    const advancing = getAdvancingParticipants(group, stage.config.advancingCount)
    advancedParticipants.push(...advancing)
  }

  return {
    ...stage,
    groups: updatedGroups,
    advancedParticipants,
  }
}

// ==================== KNOCKOUT STAGE LOGIC ====================

/**
 * Check if a number is a power of 2
 */
export const isPowerOf2 = (n: number): boolean => {
  return n > 0 && (n & (n - 1)) === 0
}

/**
 * Calculate the number of rounds in a knockout stage
 */
export const calculateNumberOfRounds = (participantCount: number): number => {
  return Math.ceil(Math.log2(participantCount))
}

/**
 * Calculate remaining participants in round 2
 */
export const calculateRound2Participants = (n: number): number => {
  if (isPowerOf2(n)) return n / 2
  return Math.pow(2, Math.floor(Math.log2(n)))
}

/**
 * Calculate remaining participants for each round
 */
export const calculateRemainingParticipants = (
  totalParticipants: number,
): number[] => {
  const rounds = calculateNumberOfRounds(totalParticipants)
  const remaining: number[] = [totalParticipants]

  if (rounds < 2) return remaining

  const n2 = calculateRound2Participants(totalParticipants)
  remaining.push(n2)

  // Subsequent rounds are half of the previous
  for (let i = 2; i < rounds; i++) {
    remaining.push(remaining[i - 1] / 2)
  }

  return remaining
}

/**
 * Get the name of a knockout round
 */
export const getKnockoutRoundName = (
  participantCount: number,
  totalParticipants: number,
): { name: string; shortName: string } => {
  let n: number
  if (isPowerOf2(participantCount)) {
    n = participantCount
  } else {
    n = Math.pow(2, Math.floor(Math.log2(totalParticipants)) + 1)
  }

  if (n > 8) {
    return { name: `Round of ${n}`, shortName: `R${n}` }
  }
  if (n === 8) {
    return { name: 'Quarterfinal', shortName: 'QF' }
  }
  if (n === 4) {
    return { name: 'Semifinal', shortName: 'SF' }
  }
  // n === 2
  return { name: 'Final', shortName: 'F' }
}

/**
 * Calculate snake ranking seeding for knockout stage (from group stage results)
 * Groups are arranged in snake order by ranking
 */
export const calculateSnakeRankingSeeding = (
  advancedParticipants: ParticipantWithGroupInfo[],
): ParticipantWithGroupInfo[] => {
  // Group by ranking
  const byRanking = new Map<number, ParticipantWithGroupInfo[]>()
  for (const p of advancedParticipants) {
    const r = p.ranking
    if (!byRanking.has(r)) {
      byRanking.set(r, [])
    }
    byRanking.get(r)!.push(p)
  }

  const rankings = Array.from(byRanking.keys()).sort((a, b) => a - b)
  const seeded: ParticipantWithGroupInfo[] = []

  // Snake pattern: odd rankings go left-to-right (by group index), even rankings go right-to-left
  for (const ranking of rankings) {
    const participants = byRanking.get(ranking)!
    const sorted = [...participants].sort((a, b) => {
      // Within same ranking, sort by group index
      return ranking % 2 === 1
        ? a.groupIndex - b.groupIndex // R1: G1, G2, G3
        : b.groupIndex - a.groupIndex // R2: G3, G2, G1
    })
    seeded.push(...sorted)
  }

  return seeded
}

/**
 * Calculate number of byes in first round
 */
export const calculateByeCount = (participantCount: number): number => {
  if (isPowerOf2(participantCount)) return 0
  const n2 = calculateRound2Participants(participantCount)
  return 2 * n2 - participantCount
}

/**
 * Create initial seeding list with bye information
 */
export const createInitialSeedingList = (
  participants: ParticipantWithGroupInfo[],
  isKnockoutOnly: boolean,
  nop: number,
): KnockoutSeedingEntry[] => {
  let seeded: ParticipantWithGroupInfo[]

  if (isKnockoutOnly) {
    // For knockout-only tournaments (KT), use rating-based seeding
    const sorted = [...participants].sort((a, b) => {
      return (
        getParticipantSeeding(b.participant, nop) -
        getParticipantSeeding(a.participant, nop)
      )
    })
    seeded = sorted
  } else {
    // For group + knockout tournaments (GT), use snake ranking seeding
    seeded = calculateSnakeRankingSeeding(participants)
  }

  const byeCount = calculateByeCount(seeded.length)

  return seeded.map((participant, index) => ({
    seed: index + 1,
    participant,
    hasBye: index < byeCount,
  }))
}

/**
 * Check if two participants were in the same group
 */
export const wereInSameGroup = (
  p1: ParticipantWithGroupInfo,
  p2: ParticipantWithGroupInfo,
): boolean => {
  return p1.groupIndex === p2.groupIndex
}

/**
 * Create knockout matches for a round
 * After removing bye participants, pair remaining participants:
 * - take 1 from top, 1 from bottom
 * - if same group, try next from bottom
 */
export const createKnockoutMatches = (
  seedingList: KnockoutSeedingEntry[],
): KnockoutMatch[] => {
  const matches: KnockoutMatch[] = []

  // Create bye "matches" first
  const byeEntries = seedingList.filter((e) => e.hasBye)
  for (const entry of byeEntries) {
    matches.push({
      participant1: entry.participant,
      participant2: undefined,
      isBye1: false,
      isBye2: true,
      winner: entry.participant,
    })
  }

  // Remaining participants to pair
  const remaining = seedingList
    .filter((e) => !e.hasBye)
    .map((e) => e.participant)

  // Pair participants
  while (remaining.length >= 2) {
    const top = remaining.shift()!
    let bottomIndex = remaining.length - 1
    let bottom = remaining[bottomIndex]

    // Try to find a participant from a different group
    while (bottomIndex > 0 && wereInSameGroup(top, bottom)) {
      bottomIndex--
      bottom = remaining[bottomIndex]
    }

    // Remove the selected bottom participant
    remaining.splice(bottomIndex, 1)

    matches.push({
      participant1: top,
      participant2: bottom,
      isBye1: false,
      isBye2: false,
    })
  }

  return matches
}

/**
 * Create subsequent round seeding list after matches are played
 */
export const createSubsequentRoundSeedingList = (
  previousSeedingList: KnockoutSeedingEntry[],
  previousMatches: KnockoutMatch[],
): KnockoutSeedingEntry[] => {
  const newList: KnockoutSeedingEntry[] = []
  const usedSeeds = new Set<number>()

  for (const match of previousMatches) {
    if (!match.winner) continue

    if (match.isBye2) {
      // Bye participant keeps their seed
      const entry = previousSeedingList.find(
        (e) =>
          e.participant &&
          isSameParticipant(e.participant.participant, match.winner!.participant),
      )
      if (entry && !usedSeeds.has(entry.seed)) {
        newList.push({
          seed: entry.seed,
          participant: match.winner,
          hasBye: false,
        })
        usedSeeds.add(entry.seed)
      }
    } else {
      // Winner takes the higher seed between the two participants
      const entry1 = previousSeedingList.find(
        (e) =>
          e.participant &&
          match.participant1 &&
          isSameParticipant(
            e.participant.participant,
            match.participant1.participant,
          ),
      )
      const entry2 = previousSeedingList.find(
        (e) =>
          e.participant &&
          match.participant2 &&
          isSameParticipant(
            e.participant.participant,
            match.participant2.participant,
          ),
      )

      const higherSeed = Math.min(entry1?.seed || 999, entry2?.seed || 999)
      if (!usedSeeds.has(higherSeed)) {
        newList.push({
          seed: higherSeed,
          participant: match.winner,
          hasBye: false,
        })
        usedSeeds.add(higherSeed)
      }
    }
  }

  // Sort by seed
  return newList.sort((a, b) => a.seed - b.seed)
}

/**
 * Create a knockout stage
 */
export const createKnockoutStage = (
  participants: ParticipantWithGroupInfo[],
  nop: number,
  config: KnockoutStageConfig,
): KnockoutStage => {
  const seedingList = createInitialSeedingList(
    participants,
    config.isKnockoutOnly,
    nop,
  )

  const numberOfRounds = calculateNumberOfRounds(participants.length)
  const remainingParticipants = calculateRemainingParticipants(participants.length)

  const rounds: KnockoutRound[] = []

  // Create first round
  const firstRoundMatches = createKnockoutMatches(seedingList)
  const firstRoundNames = getKnockoutRoundName(
    remainingParticipants[0],
    participants.length,
  )

  rounds.push({
    index: 0,
    name: firstRoundNames.name,
    shortName: firstRoundNames.shortName,
    participantCount: remainingParticipants[0],
    matches: firstRoundMatches,
    isComplete: false,
  })

  // Create placeholder rounds for subsequent rounds
  for (let i = 1; i < numberOfRounds; i++) {
    const roundNames = getKnockoutRoundName(
      remainingParticipants[i],
      participants.length,
    )
    rounds.push({
      index: i,
      name: roundNames.name,
      shortName: roundNames.shortName,
      participantCount: remainingParticipants[i],
      matches: [],
      isComplete: false,
    })
  }

  return {
    type: 'knockout',
    config,
    seedingList,
    rounds,
    numberOfRounds,
  }
}

/**
 * Advance to next round in knockout stage
 */
export const advanceKnockoutRound = (stage: KnockoutStage): KnockoutStage => {
  const currentRoundIndex = stage.rounds.findIndex((r) => !r.isComplete)
  if (currentRoundIndex === -1 || currentRoundIndex >= stage.rounds.length - 1) {
    return stage // No more rounds to advance
  }

  const currentRound = stage.rounds[currentRoundIndex]

  // Check if all matches in current round have winners
  const allMatchesComplete = currentRound.matches.every((m) => m.winner)
  if (!allMatchesComplete) {
    return stage // Current round not complete
  }

  // Mark current round as complete
  const updatedCurrentRound = { ...currentRound, isComplete: true }

  // Create seeding list for next round
  const nextSeedingList = createSubsequentRoundSeedingList(
    stage.seedingList,
    currentRound.matches,
  )

  // Create matches for next round
  const nextRoundMatches = createKnockoutMatches(nextSeedingList)
  const nextRound = {
    ...stage.rounds[currentRoundIndex + 1],
    matches: nextRoundMatches,
  }

  const updatedRounds = [...stage.rounds]
  updatedRounds[currentRoundIndex] = updatedCurrentRound
  updatedRounds[currentRoundIndex + 1] = nextRound

  return {
    ...stage,
    seedingList: nextSeedingList,
    rounds: updatedRounds,
  }
}

// ==================== GROUP MATCH SCHEDULE ====================

/**
 * Match schedule for a group of 3
 * - 1st match: seed 2 vs seed 3
 * - 2nd match: seed 1 vs seed 3
 * - 3rd match: seed 1 vs seed 2
 */
export const GROUP_OF_3_SCHEDULE: [number, number][] = [
  [2, 3],
  [1, 3],
  [1, 2],
]

/**
 * Match schedule for a group of 4
 * - 1st match: seed 1 vs seed 4
 * - 2nd match: seed 2 vs seed 3
 * - 3rd match: seed 1 vs seed 3
 * - 4th match: seed 2 vs seed 4
 * - 5th match: seed 3 vs seed 4
 * - 6th match: seed 1 vs seed 2
 */
export const GROUP_OF_4_SCHEDULE: [number, number][] = [
  [1, 4],
  [2, 3],
  [1, 3],
  [2, 4],
  [3, 4],
  [1, 2],
]

/**
 * Generate match schedule for a group
 */
export const generateGroupMatchSchedule = <T extends Player | Team>(
  participants: T[],
): { side1: T; side2: T }[] => {
  const size = participants.length

  if (size === 3) {
    return GROUP_OF_3_SCHEDULE.map(([s1, s2]) => ({
      side1: participants[s1 - 1],
      side2: participants[s2 - 1],
    }))
  }

  if (size === 4) {
    return GROUP_OF_4_SCHEDULE.map(([s1, s2]) => ({
      side1: participants[s1 - 1],
      side2: participants[s2 - 1],
    }))
  }

  // For groups larger than 4, generate round robin
  const schedule: { side1: T; side2: T }[] = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      schedule.push({
        side1: participants[i],
        side2: participants[j],
      })
    }
  }
  return schedule
}

// ==================== PARTICIPANT UTILITIES ====================

/**
 * Calculate participant rating for seeding
 * - nop = 1: player's rating
 * - nop = 2 or 3: combined rating of all players
 * - nop > 3: combined rating of top 3 players
 */
export const calculateParticipantRating = (
  players: Player[],
  nop: number,
): number => {
  if (players.length === 0) return 0

  if (nop === 1) {
    return players[0]?.rating || 0
  }

  if (nop <= 3) {
    return players.reduce((sum, p) => sum + p.rating, 0)
  }

  // nop > 3: use top 3 players
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  return sorted.slice(0, 3).reduce((sum, p) => sum + p.rating, 0)
}

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: string, referenceDate: string): number => {
  const dob = new Date(dateOfBirth)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--
  }
  return age
}

/**
 * Check if player meets age requirement
 */
export const meetsAgeRequirement = (
  player: Player,
  ageLimitType: 'U' | 'O',
  ageLimit: number,
  referenceDate: string,
): boolean => {
  if (!player.dateOfBirth) return false
  const age = calculateAge(player.dateOfBirth, referenceDate)

  if (ageLimitType === 'U') {
    return age <= ageLimit
  }
  return age >= ageLimit
}

/**
 * Check if player meets rating requirement
 */
export const meetsRatingRequirement = (
  player: Player,
  ratingLimit: number,
): boolean => {
  return player.rating <= ratingLimit
}

/**
 * Create a new participant
 */
export const createParticipant = (
  _id: string,
  players: Player[],
  nop: number,
  teamName?: string,
): Participant => {
  return {
    _id,
    players,
    teamName,
    rating: calculateParticipantRating(players, nop),
  }
}

// ==================== TOURNAMENT CREATION ====================

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create a new tournament (template)
 */
export const createTournament = (input: {
  name: string
  sex?: 'All' | 'Man' | 'Woman' | 'Mixed'
  type?: 'Single' | 'Double' | 'Team'
  teamSize?: number
  restriction?: 'Open' | 'Rated' | 'Age'
  ratingLimit?: number
  topPlayersRatingEnabled?: boolean
  topPlayersCount?: number
  topPlayersRatingLimit?: number
  ageLimitType?: 'U' | 'O'
  ageLimit?: number
  stages?: 'Group + Knockout' | 'Group Only (Big Round Robin)' | 'Knockout Only'
}): Tournament => {
  const type = input.type || 'Single'
  const teamSize = type === 'Team' ? (input.teamSize || 3) : undefined
  const nop = type === 'Single' ? 1 : type === 'Double' ? 2 : (teamSize || 3)
  const stagesType = input.stages || 'Group + Knockout'
  
  const stagesArray: ('group' | 'knockout')[] =
    stagesType === 'Group Only (Big Round Robin)'
      ? ['group']
      : stagesType === 'Knockout Only'
        ? ['knockout']
        : ['group', 'knockout']

  return {
    _id: generateId(),
    name: input.name,
    sex: input.sex || 'All',
    type,
    teamSize,
    nop,
    restriction: input.restriction || 'Open',
    ratingLimit: input.restriction === 'Rated' ? input.ratingLimit : undefined,
    topPlayersRatingEnabled: input.topPlayersRatingEnabled || false,
    topPlayersCount: input.topPlayersRatingEnabled ? input.topPlayersCount : undefined,
    topPlayersRatingLimit: input.topPlayersRatingEnabled ? input.topPlayersRatingLimit : undefined,
    ageLimitType: input.restriction === 'Age' ? input.ageLimitType : undefined,
    ageLimit: input.restriction === 'Age' ? input.ageLimit : undefined,
    stages: stagesArray,
    stagesType,
  }
}

/**
 * Get match config for a stage/round
 */
export const getMatchConfig = (
  bestOfN: BestOfNConfig,
  stageType: 'group' | 'knockout',
  roundName?: string,
): MatchConfig => {
  let numberOfGames: 1 | 3 | 5 | 7

  if (stageType === 'group') {
    numberOfGames = bestOfN.groupStage
  } else if (roundName === 'Semifinal' || roundName === 'Final') {
    numberOfGames = bestOfN.semifinalAndFinal
  } else {
    numberOfGames = bestOfN.knockoutBeforeSemifinal
  }

  return {
    ...DEFAULT_MATCH_CONFIG,
    numberOfGames,
  }
}

// ==================== VALIDATION ====================

/**
 * Validate tournament can be created (now just checks name uniqueness)
 */
export const validateCreateTournament = (
  name: string,
  existingTournaments: Tournament[],
): string[] => {
  const errors: string[] = []

  if (!name) {
    errors.push('Tournament name is required')
  }

  // Check for duplicate name
  const duplicate = existingTournaments.find((t) => t.name === name)
  if (duplicate) {
    errors.push('A tournament with the same name already exists')
  }

  return errors
}

/**
 * Validate event can be created
 */
export const validateCreateEvent = (
  name: string,
  date: string,
  existingEvents: Event[],
): string[] => {
  const errors: string[] = []

  if (!name) {
    errors.push('Event name is required')
  }
  if (!date) {
    errors.push('Event date is required')
  }

  // Check for duplicate name + date
  const duplicate = existingEvents.find(
    (e) => e.eventName === name && e.date === date,
  )
  if (duplicate) {
    errors.push('An event with the same name and date already exists')
  }

  return errors
}

/**
 * Validate participant can be added to an event
 */
export const validateAddParticipant = (
  event: Event,
  players: Player[],
): string[] => {
  const errors: string[] = []

  // Check number of players matches nop
  if (players.length !== event.nop) {
    errors.push(`Expected ${event.nop} player(s), got ${players.length}`)
  }

  // Check for duplicate players in input
  const playerIds = new Set<string>()
  for (const player of players) {
    if (playerIds.has(player._id)) {
      errors.push(`Duplicate player: ${player._id}`)
    }
    playerIds.add(player._id)
  }

  // Check max participants
  if (
    event.maxParticipants > 0 &&
    event.participants.length >= event.maxParticipants
  ) {
    errors.push('Event has reached maximum participants')
  }

  // Check rating requirement for Rated events
  if (event.restriction === 'Rated' && event.ratingLimit) {
    const ratingLimit = event.ratingLimit
    for (const player of players) {
      if (!meetsRatingRequirement(player, ratingLimit)) {
        errors.push(
          `Player ${player.firstName} ${player.lastName} rating (${player.rating}) exceeds limit (${ratingLimit})`,
        )
      }
    }
  }

  // Check age requirement for Age events
  if (event.restriction === 'Age' && event.ageLimitType && event.ageLimit) {
    const { ageLimitType, ageLimit } = event
    for (const player of players) {
      if (!meetsAgeRequirement(player, ageLimitType, ageLimit, event.date)) {
        const requirement =
          ageLimitType === 'U' ? `under ${ageLimit}` : `over ${ageLimit}`
        errors.push(
          `Player ${player.firstName} ${player.lastName} does not meet age requirement (${requirement})`,
        )
      }
    }
  }

  // Check if player is already in event
  for (const player of players) {
    const existing = event.participants.find((p: Participant) =>
      p.players.some((pl) => pl._id === player._id),
    )
    if (existing) {
      errors.push(
        `Player ${player.firstName} ${player.lastName} is already in the event`,
      )
    }
  }

  return errors
}

/**
 * Validate participant can be deleted from an event
 */
export const validateDeleteParticipant = (
  event: Event,
  participantId: string,
): string[] => {
  const errors: string[] = []

  const participant = event.participants.find(
    (p: Participant) => p._id === participantId,
  )
  if (!participant) {
    errors.push('Participant not found')
  }

  // Check if event has started
  const groupStage = event.eventStages.find((s) => s.type === 'group') as
    | GroupStage
    | undefined
  if (groupStage && groupStage.groups.length > 0) {
    errors.push('Cannot delete participant after event has started')
  }

  return errors
}

/**
 * Validate groups can be generated for an event
 */
export const validateGenerateGroups = (event: Event): string[] => {
  const errors: string[] = []

  // Check first stage is group stage
  if (event.stages.length === 0 || event.stages[0] !== 'group') {
    errors.push('Event does not have a group stage as first stage')
  }

  // Check minimum participants
  if (event.participants.length < 4) {
    errors.push('Minimum 4 participants required')
  }

  // Check if already started
  const groupStage = event.eventStages.find((s) => s.type === 'group') as
    | GroupStage
    | undefined
  if (groupStage && groupStage.groups.length > 0) {
    errors.push('Groups have already been generated')
  }

  return errors
}

/**
 * Validate knockout can be generated for an event
 */
export const validateGenerateKnockout = (event: Event): string[] => {
  const errors: string[] = []

  // Check last stage is knockout stage
  const hasKnockout = event.stages.includes('knockout')
  if (!hasKnockout) {
    errors.push('Event does not have a knockout stage')
  }

  const knockoutStage = event.eventStages.find((s) => s.type === 'knockout') as
    | KnockoutStage
    | undefined

  // Check minimum participants for knockout-only event
  if (event.stages[0] === 'knockout') {
    if (event.participants.length < 4) {
      errors.push('Minimum 4 participants required')
    }
  }

  // Check group stage is complete if exists
  const groupStage = event.eventStages.find((s) => s.type === 'group') as
    | GroupStage
    | undefined
  if (groupStage) {
    const allGroupsComplete = groupStage.groups.every((g) => g.isComplete)
    if (!allGroupsComplete) {
      errors.push('All group stage matches must be completed first')
    }
  }

  // Check if knockout already has rounds in progress
  if (knockoutStage && knockoutStage.rounds.length > 0) {
    const lastRound = knockoutStage.rounds[knockoutStage.rounds.length - 1]
    if (lastRound.isComplete && lastRound.participantCount === 2) {
      errors.push('Event is already complete')
    }

    // Check current round is complete
    const currentRound = knockoutStage.rounds.find((r) => !r.isComplete)
    if (currentRound && currentRound.matches.some((m) => !m.winner)) {
      errors.push('Current knockout round must be completed first')
    }
  }

  return errors
}

/**
 * Validate match can be finished in an event
 */
export const validateFinishMatch = (event: Event, matchId: string): string[] => {
  const errors: string[] = []

  // Find match in event
  let matchFound = false

  // Check group stage
  const groupStage = event.eventStages.find((s) => s.type === 'group') as
    | GroupStage
    | undefined
  if (groupStage) {
    for (const group of groupStage.groups) {
      const match = group.matches.find((m) => m._id === matchId)
      if (match) {
        matchFound = true
        if (match.winningSide !== undefined) {
          errors.push('Match is already finished')
        }
        break
      }
    }
  }

  // Check knockout stage
  if (!matchFound) {
    const knockoutStage = event.eventStages.find((s) => s.type === 'knockout') as
      | KnockoutStage
      | undefined
    if (knockoutStage) {
      for (const round of knockoutStage.rounds) {
        const knockoutMatch = round.matches.find((m) => m.match?._id === matchId)
        if (knockoutMatch) {
          matchFound = true
          if (knockoutMatch.winner !== undefined) {
            errors.push('Match is already finished')
          }
          break
        }
      }
    }
  }

  if (!matchFound) {
    errors.push('Match not found')
  }

  return errors
}
