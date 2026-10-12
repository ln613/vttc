// League rules that need the app's types. The scheduling algorithms
// themselves live in leagueSchedule.js, shared verbatim with the Netlify
// functions, and are re-exported here so the client has one import.
import type { LeaguePairing, LeagueStandingRow } from '../types/League'
import type { Match } from '../types/Match'
import type { Participant } from '../types/Tournament'
import {
  getFrenchLeagueSubPoints,
  isFrenchLeagueLeagueTie,
} from './frenchLeague.js'

export * from './leagueSchedule.js'

// ==================== Standings ====================

const emptyStandingRow = (participant: Participant): LeagueStandingRow => ({
  participantId: participant._id,
  teamName: participant.teamName || '',
  players: participant.players || [],
  roundsWon: 0,
  roundsLost: 0,
  matchesWon: 0,
  matchesLost: 0,
  gamesWon: 0,
  gamesLost: 0,
  points: 0,
})

const tallyTeamMatch = (
  match: Match,
  home: LeagueStandingRow,
  away: LeagueStandingRow,
) => {
  const scoresPoints = isFrenchLeagueLeagueTie(match)
  for (const sub of match.subMatches || []) {
    if (!sub.winningSide) continue
    if (scoresPoints) addSubPoints(sub, home, away)
    if (sub.winningSide === 1) {
      home.matchesWon++
      away.matchesLost++
    } else {
      away.matchesWon++
      home.matchesLost++
    }
    home.gamesWon += sub.gamesWon1 || 0
    home.gamesLost += sub.gamesWon2 || 0
    away.gamesWon += sub.gamesWon2 || 0
    away.gamesLost += sub.gamesWon1 || 0
  }
  if (match.winningSide === 1) {
    home.roundsWon++
    away.roundsLost++
  } else if (match.winningSide === 2) {
    away.roundsWon++
    home.roundsLost++
  }
}

const addSubPoints = (
  sub: Match,
  home: LeagueStandingRow,
  away: LeagueStandingRow,
) => {
  const points = getFrenchLeagueSubPoints(sub)
  if (!points) return
  home.points += points[0]
  away.points += points[1]
}

/**
 * Rank teams by rounds won, then total matches won, matches lost (fewer is
 * better), games won, and games lost (fewer is better). A French League
 * ranks on points first (league.md).
 */
export const computeLeagueStandings = (
  participants: Participant[],
  roundMatches: { pairings?: LeaguePairing[]; matches: Match[] }[],
  options: { byPoints?: boolean } = {},
): LeagueStandingRow[] => {
  const rows = new Map<string, LeagueStandingRow>()
  for (const participant of participants) {
    rows.set(participant._id, emptyStandingRow(participant))
  }

  for (const round of roundMatches) {
    for (const match of round.matches) {
      const home = rows.get(match.participantIds?.side1 ?? '')
      const away = rows.get(match.participantIds?.side2 ?? '')
      if (!home || !away) continue
      tallyTeamMatch(match, home, away)
    }
  }

  return [...rows.values()].sort(
    options.byPoints ? comparePointsFirst : compareStandingRows,
  )
}

const comparePointsFirst = (a: LeagueStandingRow, b: LeagueStandingRow) =>
  b.points - a.points || compareStandingRows(a, b)

export const compareStandingRows = (
  a: LeagueStandingRow,
  b: LeagueStandingRow,
): number =>
  b.roundsWon - a.roundsWon ||
  b.matchesWon - a.matchesWon ||
  a.matchesLost - b.matchesLost ||
  b.gamesWon - a.gamesWon ||
  a.gamesLost - b.gamesLost ||
  a.teamName.localeCompare(b.teamName)
