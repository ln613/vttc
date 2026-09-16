// League scheduling, exactly as laid out in specs/rules/league.md.
//
// Plain JavaScript, and deliberately so: the Netlify functions generate the
// schedule and the browser reads it back, and neither can import the other's
// build. Types live alongside in leagueSchedule.d.ts. Everything here is
// pure — no db, no dates beyond arithmetic on YYYY-MM-DD strings.

// ==================== Length of league ====================

/**
 * Rounds/weeks per phase. With T = n/2 (or (n-1)/2) tables at most one team
 * has a bye each week, so a phase is a single round robin.
 */
export const getRoundsPerPhase = (teamCount) => {
  if (teamCount < 2) return 0
  return teamCount % 2 === 0 ? teamCount - 1 : teamCount
}

/** L = R * P */
export const getTotalRounds = (teamCount, phases) =>
  getRoundsPerPhase(teamCount) * Math.max(1, phases)

// ==================== Scheduling ====================

const mod = (value, m) => ((value % m) + m) % m

/** Teams 1..n without `fixedTeam`, in natural order, as a 0-based lookup. */
const indicesExcluding = (n, fixedTeam) => {
  const teams = []
  for (let t = 1; t <= n; t++) if (t !== fixedTeam) teams.push(t)
  return teams
}

/**
 * Index pairs a, b (a != b, neither equal to k) with (a + b) = 2k mod (n-1).
 * Each unordered pair is produced once.
 */
const pairIndicesForRound = (k, modulus) => {
  const target = mod(2 * k, modulus)
  const pairs = []
  const seen = new Set([k])
  for (let a = 0; a < modulus; a++) {
    if (seen.has(a)) continue
    const b = mod(target - a, modulus)
    if (b === a || seen.has(b)) continue
    seen.add(a)
    seen.add(b)
    pairs.push([a, b])
  }
  return pairs
}

const withoutPhantom = (pairs, phantom) => {
  if (!phantom) return { pairs }
  let bye
  const real = []
  for (const [a, b] of pairs) {
    if (a === phantom) bye = b
    else if (b === phantom) bye = a
    else real.push([a, b])
  }
  return { pairs: real, bye }
}

/**
 * The geometric circle method, rotating clockwise.
 *
 * Team `fixedTeam` stays put; the remaining n-1 teams map to zero-based
 * indices in their natural order. In round r the fixed team plays the team
 * at index k = (n - 2 - r) mod (n - 1), and the rest pair up as indices a, b
 * with (a + b) mod (n - 1) = 2k mod (n - 1).
 *
 * Odd team counts run the same algorithm over n + 1 slots; whoever draws the
 * phantom team has the bye that week.
 *
 * Returns, per round, pairs of 1-based team numbers plus the bye team.
 */
export const generatePhasePairings = (teamCount, fixedTeam = 1) => {
  if (teamCount < 2) return []
  const isOdd = teamCount % 2 === 1
  // A phantom team makes the count even; its opponent sits the round out.
  const n = isOdd ? teamCount + 1 : teamCount
  const phantom = isOdd ? n : 0

  const rotating = indicesExcluding(n, fixedTeam)
  const modulus = n - 1

  const rounds = []
  for (let r = 0; r < modulus; r++) {
    const k = mod(n - 2 - r, modulus)
    const pairs = [[fixedTeam, rotating[k]]]
    for (const [a, b] of pairIndicesForRound(k, modulus)) {
      pairs.push([rotating[a], rotating[b]])
    }
    rounds.push(withoutPhantom(pairs, phantom))
  }
  return rounds
}

// ==================== Home / Away ====================

const isHomeByRule = (a, b, k, modulus, indexOf, fixedTeam, round) => {
  // The fixed team alternates by round, which also alternates its opponent.
  if (a === fixedTeam) return round % 2 === 0
  if (b === fixedTeam) return round % 2 === 1
  const da = mod((indexOf.get(a) ?? 0) - k, modulus)
  return da % 2 === 1
}

/**
 * Target home matches per team. Even counts allow n/2 or n/2 - 1 (the spec's
 * two permitted splits); odd counts want an even split of the n - 1 matches
 * each team actually plays.
 */
const homeTargetRange = (teamCount) =>
  teamCount % 2 === 0
    ? [teamCount / 2 - 1, teamCount / 2]
    : [(teamCount - 1) / 2, (teamCount - 1) / 2]

const countHomeMatches = (rounds) => {
  const counts = new Map()
  for (const round of rounds) {
    for (const [home, away] of round.pairs) {
      counts.set(home, (counts.get(home) ?? 0) + 1)
      counts.set(away, counts.get(away) ?? 0)
    }
  }
  return counts
}

const deviation = (count, min, max) =>
  count < min ? min - count : count > max ? count - max : 0

const longestRun = (rounds, team) => {
  let longest = 0
  let run = 0
  let previous = null
  for (const round of rounds) {
    const pair = round.pairs.find(([h, a]) => h === team || a === team)
    if (!pair) continue // a bye breaks the run
    const side = pair[0] === team ? 'home' : 'away'
    run = side === previous ? run + 1 : 1
    previous = side
    if (run > longest) longest = run
  }
  return longest
}

/** No team may play more than 2 consecutive home or away matches. */
const flipKeepsRunsLegal = (rounds, roundIndex, pairIndex) => {
  const [home, away] = rounds[roundIndex].pairs[pairIndex]
  const original = rounds[roundIndex].pairs[pairIndex]
  rounds[roundIndex].pairs[pairIndex] = [away, home]
  const legal = longestRun(rounds, home) <= 2 && longestRun(rounds, away) <= 2
  rounds[roundIndex].pairs[pairIndex] = original
  return legal
}

const findBalancingFlip = (rounds, homeCount, min, max) => {
  for (let r = 0; r < rounds.length; r++) {
    for (let p = 0; p < rounds[r].pairs.length; p++) {
      const [home, away] = rounds[r].pairs[p]
      const before =
        deviation(homeCount.get(home) ?? 0, min, max) +
        deviation(homeCount.get(away) ?? 0, min, max)
      const after =
        deviation((homeCount.get(home) ?? 0) - 1, min, max) +
        deviation((homeCount.get(away) ?? 0) + 1, min, max)
      if (after >= before) continue
      if (!flipKeepsRunsLegal(rounds, r, p)) continue
      return { roundIndex: r, pairIndex: p }
    }
  }
  return null
}

const balanceHomeCounts = (rounds, teamCount) => {
  const [min, max] = homeTargetRange(teamCount)
  const homeCount = countHomeMatches(rounds)

  // Bounded: every accepted flip strictly reduces total imbalance.
  for (let pass = 0; pass < teamCount * 4; pass++) {
    const flip = findBalancingFlip(rounds, homeCount, min, max)
    if (!flip) break
    const { roundIndex, pairIndex } = flip
    const [home, away] = rounds[roundIndex].pairs[pairIndex]
    rounds[roundIndex].pairs[pairIndex] = [away, home]
    homeCount.set(home, (homeCount.get(home) ?? 0) - 1)
    homeCount.set(away, (homeCount.get(away) ?? 0) + 1)
  }
  return rounds
}

/**
 * Orient every pair into [home, away].
 *
 * The base rule keeps each rotating team alternating perfectly. A team's
 * distance from the fixed team's opponent, d = (index - k) mod (n - 1),
 * grows by exactly one per round, so "home when d is odd" flips every week;
 * and since d(home) + d(away) = n - 1, which is odd, exactly one side of
 * every pair qualifies. The fixed team itself alternates by round parity.
 * A team therefore only ever repeats a designation across the week it meets
 * the fixed team — two in a row, never three.
 *
 * A balancing pass then trades orientations that even out the home counts
 * without introducing a third consecutive home or away.
 */
export const assignHomeAway = (rounds, teamCount, fixedTeam = 1) => {
  const isOdd = teamCount % 2 === 1
  const n = isOdd ? teamCount + 1 : teamCount
  const rotating = indicesExcluding(n, fixedTeam)
  const indexOf = new Map()
  rotating.forEach((team, i) => indexOf.set(team, i))
  const modulus = n - 1

  const oriented = rounds.map((round, r) => {
    const k = mod(n - 2 - r, modulus)
    const pairs = round.pairs.map(([a, b]) =>
      isHomeByRule(a, b, k, modulus, indexOf, fixedTeam, r) ? [a, b] : [b, a],
    )
    return { ...round, pairs }
  })

  return balanceHomeCounts(oriented, teamCount)
}

// ==================== Table assignment ====================

const useKey = (team, table) => `${team}:${table}`

const recordTableUse = (pairs, assignment, lastWeekTable, phaseTableUse) => {
  lastWeekTable.clear()
  pairs.forEach(([home, away], i) => {
    const table = assignment[i]
    if (table == null) return
    for (const team of [home, away]) {
      lastWeekTable.set(team, table)
      const key = useKey(team, table)
      phaseTableUse.set(key, (phaseTableUse.get(key) ?? 0) + 1)
    }
  })
}

const solveRoundTables = (
  pairs,
  tables,
  lastWeekTable,
  phaseTableUse,
  rules,
) => {
  const chosen = []
  const taken = new Set()

  const allows = (pairIndex, table) =>
    pairs[pairIndex].every((team) => {
      if (rules.avoidLastWeek && lastWeekTable.get(team) === table) return false
      return (phaseTableUse.get(useKey(team, table)) ?? 0) < rules.capPerPhase
    })

  const place = (pairIndex) => {
    if (pairIndex === pairs.length) return true
    for (const table of tables) {
      if (taken.has(table) || !allows(pairIndex, table)) continue
      taken.add(table)
      chosen[pairIndex] = table
      if (place(pairIndex + 1)) return true
      taken.delete(table)
      chosen[pairIndex] = undefined
    }
    return false
  }

  return place(0) ? chosen : null
}

/**
 * Teams rotate on tables every week: no team on the same table as last week,
 * and no team on the same table more than twice per phase.
 *
 * Solved per round as a small assignment problem by backtracking. If a round
 * cannot satisfy both rules the "twice per phase" cap is relaxed first, then
 * the last-week rule — a schedule with a repeat beats no schedule at all.
 */
export const assignTables = (rounds, tables, roundsPerPhase) => {
  const lastWeekTable = new Map()
  const phaseTableUse = new Map()
  const assignments = []

  rounds.forEach((round, roundIndex) => {
    if (roundIndex % roundsPerPhase === 0) phaseTableUse.clear()

    const assignment =
      solveRoundTables(round.pairs, tables, lastWeekTable, phaseTableUse, {
        capPerPhase: 2,
        avoidLastWeek: true,
      }) ??
      solveRoundTables(round.pairs, tables, lastWeekTable, phaseTableUse, {
        capPerPhase: Infinity,
        avoidLastWeek: true,
      }) ??
      solveRoundTables(round.pairs, tables, lastWeekTable, phaseTableUse, {
        capPerPhase: Infinity,
        avoidLastWeek: false,
      }) ??
      round.pairs.map((_, i) => tables[i % tables.length])

    assignments.push(assignment)
    recordTableUse(round.pairs, assignment, lastWeekTable, phaseTableUse)
  })

  return assignments
}

// ==================== Dates ====================

/** Dates are local calendar days (YYYY-MM-DD), so no timezone maths. */
export const addWeeks = (date, weeks) => {
  const [year, month, day] = date.split('-').map(Number)
  const d = new Date(year, month - 1, day + weeks * 7)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ==================== Full schedule ====================

const repeatPhases = (phase, phases) => {
  const out = []
  for (let p = 0; p < Math.max(1, phases); p++) {
    // Each phase is scheduled identically, but table assignment mutates the
    // rounds it is given, so hand it copies.
    out.push(
      ...phase.map((r) => ({ ...r, pairs: r.pairs.map((p2) => [...p2]) })),
    )
  }
  return out
}

/**
 * The whole league: every phase's pairings, oriented home/away, placed on
 * tables and dated a week apart from the start date.
 */
export const generateLeagueSchedule = ({
  participantIds,
  phases,
  tables,
  startDate,
}) => {
  const teamCount = participantIds.length
  if (teamCount < 2) return []

  const roundsPerPhase = getRoundsPerPhase(teamCount)
  const phasePairings = assignHomeAway(
    generatePhasePairings(teamCount),
    teamCount,
  )

  const allRounds = repeatPhases(phasePairings, phases)
  const tableAssignments = assignTables(allRounds, tables, roundsPerPhase)

  return allRounds.map((round, roundIndex) => ({
    roundIndex,
    phase: Math.floor(roundIndex / roundsPerPhase),
    date: addWeeks(startDate, roundIndex),
    byeParticipantId: round.bye ? participantIds[round.bye - 1] : undefined,
    pairings: round.pairs.map(([home, away], i) => ({
      homeParticipantId: participantIds[home - 1],
      awayParticipantId: participantIds[away - 1],
      tableNumber: tableAssignments[roundIndex][i],
    })),
  }))
}

// ==================== Format ====================

export const LEAGUE_FORMATS = ['RR Singles', 'Singles and Doubles']

/**
 * RR Singles: every player in team 1 plays every player in team 2. Round d
 * pairs home slot i with away slot (i + d), which for a team of 3 gives
 * A-X, B-Y, C-Z, A-Y, B-Z, C-X, A-Z, B-X, C-Y.
 */
export const getRoundRobinSinglesLineup = (teamSize) => {
  const lineup = []
  for (let d = 0; d < teamSize; d++) {
    for (let i = 0; i < teamSize; i++) {
      lineup.push({ homeSlots: [i], awaySlots: [(i + d) % teamSize] })
    }
  }
  return lineup
}

/**
 * Sub-matches per team match. RR Singles is every pairing of players;
 * Singles and Doubles reuses the tournament team-match schedules in
 * specs/rules/match.md, which are best of 5 for teams of 2 and 3.
 */
export const getLeagueSubMatchCount = (format, teamSize) =>
  format === 'RR Singles' ? teamSize * teamSize : 5

/** "Best of 9", "Best of 5"… as shown on the Number of Matches section. */
export const getLeagueMatchesLabel = (format, teamSize) =>
  `Best of ${getLeagueSubMatchCount(format, teamSize)}`

/**
 * Team sizes the format has a defined schedule for. specs/rules/match.md
 * only lays out team matches for 2 and 3 players, so Singles and Doubles
 * stops there; RR Singles is generated and works for any size.
 */
export const getSupportedTeamSizes = (format) =>
  format === 'RR Singles' ? ['2', '3', '4'] : ['2', '3']

// ==================== Ratings ====================

/**
 * A player's rating as it stood on a given date.
 *
 * A league's rating limits are judged once, against the squad as it was when
 * the season started. Using today's rating instead would let a team that was
 * legal in September become illegal in November purely because someone
 * improved — and would change the answer every time the page is opened.
 *
 * `history` is TTCan's list of rating periods ({ periodId, period, rating }).
 * Returns undefined when the player has no period on or before the date,
 * which is the case for anyone who joined mid-season.
 */
export const ratingAtDate = (history, onDate) => {
  if (!Array.isArray(history) || history.length === 0) return undefined
  if (!onDate) return undefined
  const cutoff = new Date(onDate).getTime()
  if (Number.isNaN(cutoff)) return undefined

  let best
  for (const entry of history) {
    const at = new Date(entry.period).getTime()
    if (Number.isNaN(at) || at > cutoff) continue
    if (!best || entry.periodId > best.periodId) best = entry
  }
  return best?.rating
}

// ==================== Players ====================

/**
 * A team fields exactly `teamSize` players on a match day, chosen from a
 * roster that may be larger. The match schedule for a round can only be
 * generated once every team has picked.
 */
export const isRoundSelectionComplete = (
  selections,
  playingParticipantIds,
  teamSize,
) =>
  playingParticipantIds.every(
    (id) =>
      (selections.find((s) => s.participantId === id)?.playerIds.length ??
        0) === teamSize,
  )

/**
 * A player may sit on several rosters but can only play for one team on a
 * given match day. Returns the ids of players picked by more than one team.
 */
export const findDoubleBookedPlayers = (selections) => {
  const seen = new Set()
  const clashes = new Set()
  for (const selection of selections) {
    for (const id of selection.playerIds || []) {
      if (seen.has(id)) clashes.add(id)
      seen.add(id)
    }
  }
  return [...clashes]
}

/** New players can be added to a roster until the given round starts. */
export const isRosterOpen = (
  currentRoundIndex,
  rosterOpenUntilRound,
  totalRounds,
) => currentRoundIndex <= (rosterOpenUntilRound ?? totalRounds - 1)
