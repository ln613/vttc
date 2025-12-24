import type { Player } from '../types/Player'
import type { Team, Tournament } from '../types/Tournament'

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
 * Calculate seeding value for a player
 */
export const getPlayerSeeding = (player: Player): number => {
  return player.rating
}

/**
 * Calculate seeding value for a team based on number of players per team (nop)
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
 * Create a group stage for a tournament
 */
export const createGroupStage = <T extends Player | Team>(
  participants: T[],
  nop: number,
): { type: 'group'; groups: T[][] } => {
  const groups = formGroupsWithSnakeSeeding(participants, nop)
  return {
    type: 'group',
    groups,
  }
}
