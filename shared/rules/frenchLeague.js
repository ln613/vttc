// French League team matches (specs/rules/match.md, "French League"): teams
// of 4, 6 singles, 2 doubles, 6 singles, on two tables. Used by both a
// French League tournament and a French League league format.
//
// Plain JavaScript so the Netlify functions and the browser share it; types
// live alongside in frenchLeague.d.ts.

export const FRENCH_LEAGUE = 'French League'

export const FRENCH_LEAGUE_TEAM_SIZE = 4

/** The team-match type a French League tie is stored with. */
export const FRENCH_LEAGUE_MATCH_TYPE = 'fl4'

/** A French League tie is played on two tables at once. */
export const FRENCH_LEAGUE_TABLES = 2

/**
 * Home slots are A, B, C, D (0-3), away X, Y, Z, W (0-3).
 *
 * Three phases: 6 singles, then the 2 doubles together, then 6 singles.
 * The two tables take turns down the list: odd matches on the tie's first
 * table (lane 0), even ones on its second (lane 1). The doubles wait until
 * all 6 singles before them are finished and start at the same time.
 *
 * Every player plays 3 singles and 1 doubles; the 4 singles pairings left
 * out are A-X, B-Y, C-Z, D-W. With two tables nobody can always rest
 * between singles — W (3, 5) and Z (4, 6) play twice in a row, each on the
 * same table — and everyone goes from the singles into the doubles.
 */
const FRENCH_LEAGUE_LINEUP = [
  // [home slots, away slots, phase]
  [[0], [1], 0],
  [[1], [0], 0],
  [[2], [3], 0],
  [[3], [2], 0],
  [[1], [3], 0],
  [[0], [2], 0],
  [[0, 2], [0, 2], 1],
  [[1, 3], [3, 1], 1],
  [[2], [0], 2],
  [[3], [1], 2],
  [[0], [3], 2],
  [[1], [2], 2],
  [[2], [1], 2],
  [[3], [0], 2],
]

/** The doubles phase: its matches start together, one on each table. */
const TOGETHER_PHASE = 1

export const getFrenchLeagueLineup = () =>
  FRENCH_LEAGUE_LINEUP.map(([homeSlots, awaySlots, phase], i) => ({
    homeSlots: [...homeSlots],
    awaySlots: [...awaySlots],
    phase,
    lane: i % FRENCH_LEAGUE_TABLES,
    startTogether: phase === TOGETHER_PHASE,
  }))

export const FRENCH_LEAGUE_MATCH_COUNT = FRENCH_LEAGUE_LINEUP.length

/** Is this tournament (or an event made from one) a French League? */
export const isFrenchLeagueTournament = (tournament) =>
  tournament?.type === 'Team' && tournament?.teamFormat === FRENCH_LEAGUE

const subMatchHasPlay = (sub) =>
  sub.winningSide != null ||
  (Array.isArray(sub.games) && sub.games.length > 0) ||
  (sub.initialServingSide != null && sub.leftSide != null)

/**
 * Does a team match's sub-match list mean the tie is under way?
 *
 * Normally sub-matches only appear once both sides have set their order of
 * play, so having them at all means it has begun. A French League tie is
 * laid out in advance (autoScheduled), so for it only a sub-match actually
 * being played counts.
 */
export const teamSubMatchesUnderWay = (match) => {
  const subs = Array.isArray(match?.subMatches) ? match.subMatches : []
  if (subs.length === 0) return false
  if (!match.autoScheduled) return true
  return subs.some(subMatchHasPlay)
}

// ==================== Points (league) ====================

// A French League league scores each sub-match in points, and the points go
// towards the standings (league.md, "French League"): 2 to the winner, 1 to
// the loser — so every result reads 2 : 1 — and 0 to a side that didn't
// show or defaulted (2 : 0).
export const FRENCH_LEAGUE_WIN_POINTS = 2
export const FRENCH_LEAGUE_LOSS_POINTS = 1
export const FRENCH_LEAGUE_FORFEIT_POINTS = 0

/** A French League team match played in a league (every sub-match counts). */
export const isFrenchLeagueLeagueTie = (match) =>
  match?.teamMatchType === FRENCH_LEAGUE_MATCH_TYPE && !!match?.playAllMatches

/**
 * A decided sub-match's points as [side 1, side 2]; null while it has no
 * winner. `forfeitedSide` marks the side that didn't show or defaulted.
 */
export const getFrenchLeagueSubPoints = (sub) => {
  if (sub?.winningSide !== 1 && sub?.winningSide !== 2) return null
  const loser = sub.winningSide === 1 ? 2 : 1
  const loserPoints =
    sub.forfeitedSide === loser
      ? FRENCH_LEAGUE_FORFEIT_POINTS
      : FRENCH_LEAGUE_LOSS_POINTS
  return sub.winningSide === 1
    ? [FRENCH_LEAGUE_WIN_POINTS, loserPoints]
    : [loserPoints, FRENCH_LEAGUE_WIN_POINTS]
}

/** A team match's points so far, [side 1, side 2], from the given sub-matches. */
export const getFrenchLeagueTiePoints = (subs) =>
  (subs || []).reduce(
    (total, sub) => {
      const points = getFrenchLeagueSubPoints(sub)
      return points ? [total[0] + points[0], total[1] + points[1]] : total
    },
    [0, 0],
  )
