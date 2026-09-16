// League rounds: generating the season's fixtures, recording who each team
// fields on a match day, and expanding a week into playable matches.
//
// A league round is an ordinary team event whose matches live in a single
// group, so once they exist the table queue, game play and live score all
// handle them without knowing leagues are a thing. Everything league-shaped
// lives here.
import { getDB, toObjectId } from './db.js'
import { club } from './club.js'
import { freeTableForMatch } from './liveScoreHandlers.js'
import { sanitizeForOutput } from './embeddedPlayers.js'
import {
  generateLeagueSchedule as buildSchedule,
  getRoundsPerPhase,
  getTotalRounds,
  getLeagueSubMatchCount,
  isRoundSelectionComplete,
  findDoubleBookedPlayers,
  ratingAtDate,
} from '../../../shared/rules/leagueSchedule.js'
import {
  generateId,
  getBestOfNumber,
  getTeamMatchType,
  buildLeagueRoundsFrom,
} from './eventHandlers.js'

const EVENTS_COLLECTION = 'events'
const PLAYERS_COLLECTION = 'players'
const TABLE_STATE_COLLECTION = 'tableState'
const TABLE_STATE_DOC_ID = 'current'

const throwError = (message) => {
  throw new Error(message)
}

const throwErrors = (errors) => {
  if (errors.length > 0) throwError(errors.join('\n'))
}

// ==================== Reading a league ====================

const loadRound = async (collection, _id) => {
  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')
  if (event.eventType !== 'league') throwError('Event is not a league round')
  return event
}

const leagueIdOf = (event) => event.leagueId || event._id.toString()

const loadRounds = (collection, leagueId) =>
  collection.find({ leagueId }).sort({ roundIndex: 1 }).toArray()

/**
 * Every round/week of a league, for the round dropdown and the standings.
 * Rounds carry their own matches, so this is the whole league in one read.
 */
export const getLeague = async (params) => {
  if (!params?.leagueId) throwError('League ID is required')

  const db = getDB()
  const rounds = await loadRounds(
    db.collection(EVENTS_COLLECTION),
    params.leagueId,
  )
  if (rounds.length === 0) throwError('League not found')

  const root = rounds[0]
  return sanitizeForOutput({
    // What each player was rated when the season started — see
    // leagueRatingMap. The client shows and checks these, not today's.
    leagueRatings: await leagueRatingMap(db, root),
    leagueId: params.leagueId,
    leagueName: root.leagueName,
    league: root.league,
    simulated: !!root.simulated,
    // The rating rules the Select Players dialog checks a line-up against.
    teamSize: root.nop,
    restriction: root.restriction,
    ratingLimit: root.ratingLimit,
    topPlayersRatingEnabled: !!root.topPlayersRatingEnabled,
    topPlayersCount: root.topPlayersCount,
    topPlayersRatingLimit: root.topPlayersRatingLimit,
    participants: root.participants || [],
    paidPlayerIds: root.paidPlayerIds || [],
    rounds: rounds.map(toRoundSummary),
  })
}

/**
 * playerId -> rating on the league's start date.
 *
 * The embedded roster snapshots only carry the rating at the time they were
 * written, and the rating history lives on the players collection, so this
 * is resolved here once rather than by every caller.
 */
const leagueRatingMap = async (db, root) => {
  const startDate = root.league?.startDate || root.date
  const ids = (root.participants || []).flatMap((p) =>
    (p.players || []).map((pl) => pl._id),
  )
  if (ids.length === 0) return {}

  const players = await db
    .collection(PLAYERS_COLLECTION)
    .find({ _id: { $in: ids.map(toObjectId) } }, { projection: { ttcanRatingHistory: 1 } })
    .toArray()

  const map = {}
  for (const player of players) {
    const rating = ratingAtDate(player.ttcanRatingHistory, startDate)
    if (rating != null) map[player._id.toString()] = rating
  }
  return map
}

const toRoundSummary = (round) => ({
  _id: round._id.toString(),
  roundIndex: round.roundIndex,
  date: round.date,
  time: round.time,
  pairings: round.leaguePairings || [],
  byeParticipantId: round.leagueByeParticipantId,
  selections: round.leagueSelections || [],
  matches: getRoundMatches(round),
})

const getRoundMatches = (round) => {
  const group = (round.eventStages || []).find((s) => s.type === 'group')
  return group?.groups?.[0]?.matches || []
}

// ==================== Roster ====================

/**
 * Every round of a league shares one roster. Registration writes to whichever
 * round the desk had open, so copy the result across the siblings.
 *
 * Called for every roster-changing endpoint (see handlers.js); a no-op for
 * tournaments, which is most of them.
 */
export const syncLeagueRoster = async (eventId) => {
  if (!eventId) return
  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await collection.findOne(
    { _id: toObjectId(eventId) },
    {
      projection: {
        eventType: 1,
        leagueId: 1,
        participants: 1,
        paidPlayerIds: 1,
      },
    },
  )
  if (!event || event.eventType !== 'league') return

  await collection.updateMany(
    { leagueId: leagueIdOf(event), _id: { $ne: event._id } },
    {
      $set: {
        participants: event.participants || [],
        paidPlayerIds: event.paidPlayerIds || [],
      },
    },
  )
}

// ==================== Generating the season ====================

/**
 * Build the whole league from the teams that registered: the circle-method
 * fixtures for every phase, home/away, table rotation, and one event per
 * round/week dated a week apart (league.md, "Scheduling").
 */
export const generateLeagueSchedule = async (body) => {
  if (!body?._id) throwError('Event ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)
  const leagueId = leagueIdOf(event)
  const rounds = await loadRounds(collection, leagueId)
  const root = rounds[0]

  validateGenerateSchedule(root, rounds)

  const participantIds = root.participants.map((p) => p._id)
  const plans = buildSchedule({
    participantIds,
    phases: root.league?.numOfPhases || 1,
    tables: club.tables?.all || [],
    startDate: root.league?.startDate || root.date,
  })

  const leagueMeta = {
    ...root.league,
    roundsPerPhase: getRoundsPerPhase(participantIds.length),
    totalRounds: getTotalRounds(
      participantIds.length,
      root.league?.numOfPhases || 1,
    ),
  }

  await collection.updateOne(
    { _id: root._id },
    {
      $set: {
        league: leagueMeta,
        leagueId,
        leaguePairings: plans[0].pairings,
        leagueByeParticipantId: plans[0].byeParticipantId,
        date: plans[0].date,
        updatedAt: new Date().toISOString(),
      },
    },
  )

  const later = buildLeagueRoundsFrom(
    { ...root, leagueId, league: leagueMeta },
    plans,
  )
  if (later.length > 0) await collection.insertMany(later)

  return { success: true, leagueId, rounds: plans.length }
}

const validateGenerateSchedule = (root, rounds) => {
  const errors = []
  const teamCount = (root.participants || []).length
  if (teamCount < 2) errors.push('A league needs at least 2 teams')
  if (rounds.length > 1)
    errors.push('The league schedule has already been generated')
  if (rounds.some((r) => getRoundMatches(r).length > 0)) {
    errors.push('Matches have already been generated for this league')
  }
  const tables = club.tables?.all || []
  const needed = Math.floor(teamCount / 2)
  if (tables.length < needed) {
    errors.push(
      `${teamCount} teams need ${needed} tables, and this club has ${tables.length}`,
    )
  }
  throwErrors(errors)
}

// ==================== Match-day player selection ====================

/**
 * Record the players a team fields this week. Teams may carry a larger
 * roster, and a shared player may sit on several rosters, but can only play
 * for one team on a given match day (league.md, "Players").
 */
export const saveLeagueRoundPlayers = async (body) => {
  if (!body?._id) throwError('Event ID is required')
  if (!body.participantId) throwError('Participant ID is required')
  if (!Array.isArray(body.playerIds)) throwError('playerIds must be an array')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)

  if (getRoundMatches(event).length > 0) {
    throwError('This round already has a match schedule')
  }

  const participant = (event.participants || []).find(
    (p) => p._id === body.participantId,
  )
  if (!participant) throwError('Team not found in this league')

  const selections = mergeSelection(
    event.leagueSelections || [],
    body.participantId,
    body.playerIds,
  )
  const leagueRatings = await leagueRatingMap(db, event)
  throwErrors(
    validateSelection(event, participant, body.playerIds, selections, leagueRatings),
  )

  await collection.updateOne(
    { _id: event._id },
    {
      $set: {
        leagueSelections: selections,
        updatedAt: new Date().toISOString(),
      },
    },
  )
  return { success: true, selections }
}

const mergeSelection = (selections, participantId, playerIds) => {
  const others = selections.filter((s) => s.participantId !== participantId)
  if (playerIds.length === 0) return others
  return [...others, { participantId, playerIds }]
}

const validateSelection = (event, participant, playerIds, selections, leagueRatings) => {
  const errors = []
  const teamSize = event.nop

  if (playerIds.length > teamSize) {
    errors.push(
      `A team fields ${teamSize} players; ${playerIds.length} selected`,
    )
  }
  if (new Set(playerIds).size !== playerIds.length) {
    errors.push('The same player is selected twice')
  }
  const rosterIds = new Set(
    (participant.players || []).map((p) => p._id.toString()),
  )
  for (const id of playerIds) {
    if (!rosterIds.has(id.toString())) {
      errors.push('A selected player is not on this team')
      break
    }
  }

  // A player can only play for one team on a match day.
  const clashes = findDoubleBookedPlayers(selections)
  if (clashes.length > 0) {
    errors.push(
      `${namePlayers(event, clashes)} already selected for another team this week`,
    )
  }

  // A rated league checks the line-up, not the roster.
  if (event.restriction === 'Rated' && event.ratingLimit) {
    errors.push(
      ...validateSelectionRating(event, participant, playerIds, leagueRatings),
    )
  }
  return errors
}

const namePlayers = (event, playerIds) => {
  const byId = new Map()
  for (const participant of event.participants || []) {
    for (const player of participant.players || []) {
      byId.set(player._id.toString(), `${player.firstName} ${player.lastName}`)
    }
  }
  return playerIds.map((id) => byId.get(id.toString()) || id).join(', ')
}

const validateSelectionRating = (event, participant, playerIds, leagueRatings) => {
  const errors = []
  const selected = (participant.players || []).filter((p) =>
    playerIds.includes(p._id.toString()),
  )
  // Only a full line-up can be judged; a partial pick may still come good.
  if (selected.length < event.nop) return errors

  // The limit is judged against the squad as it stood when the season
  // started, so a rating earned since cannot make a legal team illegal.
  const ratingOf = (p) => leagueRatings[p._id.toString()] ?? p.rating ?? 0
  const combined = selected.reduce((sum, p) => sum + ratingOf(p), 0)
  if (combined > event.ratingLimit) {
    errors.push(
      `Combined rating (${combined}) exceeds limit (${event.ratingLimit})`,
    )
  }
  if (
    event.topPlayersRatingEnabled &&
    event.topPlayersCount &&
    event.topPlayersRatingLimit
  ) {
    const top = [...selected]
      .sort((a, b) => ratingOf(b) - ratingOf(a))
      .slice(0, event.topPlayersCount)
      .reduce((sum, p) => sum + ratingOf(p), 0)
    if (top > event.topPlayersRatingLimit) {
      errors.push(
        `Top ${event.topPlayersCount} combined rating (${top}) exceeds limit (${event.topPlayersRatingLimit})`,
      )
    }
  }
  return errors
}

/**
 * Pick this week's players for every team at once. Simulated leagues only —
 * it exists so a league created to be tried out can reach playable matches
 * without filling in a dialog per team.
 *
 * Teams are filled most-constrained first: a team whose roster is barely
 * bigger than its line-up picks before one with players to spare, so a
 * shared player goes to the team that can least afford to lose them.
 */
export const autoSelectLeagueRoundPlayers = async (body) => {
  if (!body?._id) throwError('Event ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)

  if (!event.simulated) {
    throwError('Auto Select is only for simulated leagues')
  }
  if (getRoundMatches(event).length > 0) {
    throwError('This round already has a match schedule')
  }

  const selections = autoSelect(event)
  await collection.updateOne(
    { _id: event._id },
    {
      $set: { leagueSelections: selections, updatedAt: new Date().toISOString() },
    },
  )
  return { success: true, selections }
}

const autoSelect = (event) => {
  const byId = new Map((event.participants || []).map((p) => [p._id, p]))
  const playing = (event.leaguePairings || []).flatMap((p) => [
    p.homeParticipantId,
    p.awayParticipantId,
  ])
  const order = [...playing].sort(
    (a, b) =>
      (byId.get(a)?.players?.length ?? 0) - (byId.get(b)?.players?.length ?? 0),
  )

  const taken = new Set()
  const selections = []
  for (const participantId of order) {
    const roster = byId.get(participantId)?.players || []
    // Strongest available first, so the line-up is the team's best.
    const available = [...roster]
      .filter((p) => !taken.has(p._id.toString()))
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, event.nop)
    if (available.length < event.nop) {
      throwError(
        `${teamLabel(byId.get(participantId))} has too few free players this week`,
      )
    }
    for (const player of available) taken.add(player._id.toString())
    selections.push({
      participantId,
      playerIds: available.map((p) => p._id.toString()),
    })
  }
  return selections
}

const teamLabel = (participant) =>
  participant?.teamName ||
  (participant?.players || [])
    .map((p) => `${p.firstName} ${p.lastName}`)
    .join('/') ||
  'A team'

/**
 * Clear a week's matches and player selections so it can be built again —
 * the wrong players were fielded, or the week was filled in by something
 * other than the league (see the league guard in autoGenerateForEvent).
 *
 * Refuses once anything has been played: undoing results is a super admin's
 * Reset Event, not a routine correction.
 */
export const resetLeagueRound = async (body) => {
  if (!body?._id) throwError('Event ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)

  if (hasPlayedMatches(event)) {
    throwError(
      'This week already has results. A super admin can Reset Event instead.',
    )
  }

  const stages = (event.eventStages || []).map((stage) =>
    stage.type === 'group'
      ? { ...stage, groups: [], advancedParticipants: [] }
      : stage,
  )

  await collection.updateOne(
    { _id: event._id },
    {
      $set: {
        eventStages: stages,
        leagueSelections: [],
        updatedAt: new Date().toISOString(),
      },
      // Resetting removes what starting depends on, so an early start goes
      // with it — same as resetEvent.
      $unset: { startedAt: '' },
    },
  )
  return { success: true }
}

const hasPlayedMatches = (event) =>
  getRoundMatches(event).some(
    (match) =>
      match.winningSide != null ||
      (match.subMatches || []).some(
        (sub) => sub.winningSide != null || (sub.games || []).length > 0,
      ),
  )

/**
 * Pull a pending sub-match forward so it plays next, putting whatever was on
 * the table back in the queue.
 *
 * RR Singles only: every player meets every opponent, so the order carries no
 * meaning and any pending pairing can be played next. Singles and Doubles
 * follows a fixed schedule from match.md, where the order is part of the
 * format.
 *
 * The listed order never changes — "Match 4" stays Match 4. All this moves is
 * which one the queue offers next.
 */
export const playLeagueSubMatchNow = async (body) => {
  if (!body?._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)

  if (event.league?.format !== 'RR Singles') {
    throwError('Only an RR Singles round can reorder its matches')
  }

  const parent = getRoundMatches(event).find((m) =>
    (m.subMatches || []).some((s) => s._id === body.matchId),
  )
  if (!parent) throwError('Sub-match not found in this round')

  const pending = (parent.subMatches || []).filter(subMatchIsPending)
  const target = pending.find((s) => s._id === body.matchId)
  if (!target) throwError('That match has already been played')

  const current = pending.find((s) => s.playNextAt) || pending[0]
  if (current._id === target._id) throwError('That match is already next')
  if (!(await isOnTableNotStarted(current))) {
    throwError('The current match is under way — it cannot be put back')
  }

  const stages = event.eventStages.map((stage) =>
    stage.type !== 'group'
      ? stage
      : {
          ...stage,
          groups: (stage.groups || []).map((group) => ({
            ...group,
            matches: (group.matches || []).map((m) =>
              m._id !== parent._id ? m : withChosenSubMatch(m, target._id),
            ),
          })),
        },
  )

  await collection.updateOne(
    { _id: event._id },
    { $set: { eventStages: stages, updatedAt: new Date().toISOString() } },
  )
  // Release the table so the rebuild can put the chosen match on it.
  await freeTableForMatch(current._id)
  return { success: true }
}

const subMatchIsPending = (sub) =>
  !sub.cancelledAt && sub.winningSide == null && (sub.games || []).length === 0

const isOnTableNotStarted = async (sub) => {
  if (!subMatchIsPending(sub)) return false
  const state = await getDB()
    .collection(TABLE_STATE_COLLECTION)
    .findOne({ docId: TABLE_STATE_DOC_ID })
  return (state?.tables || []).some(
    (t) =>
      t.status === 'assigned' &&
      t.match?.matchId?.toString() === sub._id.toString(),
  )
}

const withChosenSubMatch = (parent, matchId) => ({
  ...parent,
  subMatches: parent.subMatches.map((sub) =>
    sub._id === matchId
      ? { ...sub, playNextAt: new Date().toISOString() }
      : { ...sub, playNextAt: undefined },
  ),
})

/**
 * Swap the tables of two fixtures in a week that hasn't been generated yet.
 *
 * Before the matches exist the table lives on the fixture itself, so there is
 * nothing on a table to move — switchMatchTables handles it from the point
 * the matches are created onwards.
 */
export const switchLeagueFixtureTable = async (body) => {
  if (!body?._id) throwError('Event ID is required')
  if (!body.homeParticipantId) throwError('Fixture is required')
  if (body.tableNumber == null) throwError('tableNumber is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)
  if (getRoundMatches(event).length > 0) {
    throwError('This week already has matches — switch the match instead')
  }

  const pairings = [...(event.leaguePairings || [])]
  const mine = pairings.findIndex(
    (p) => p.homeParticipantId === body.homeParticipantId,
  )
  if (mine === -1) throwError('Fixture not found in this round')
  const fromTable = pairings[mine].tableNumber
  if (fromTable === body.tableNumber) throwError('Already on that table')

  const theirs = pairings.findIndex(
    (p, i) => i !== mine && p.tableNumber === body.tableNumber,
  )
  pairings[mine] = { ...pairings[mine], tableNumber: body.tableNumber }
  if (theirs !== -1) {
    pairings[theirs] = { ...pairings[theirs], tableNumber: fromTable }
  }

  await collection.updateOne(
    { _id: event._id },
    { $set: { leaguePairings: pairings, updatedAt: new Date().toISOString() } },
  )
  return { success: true }
}

// ==================== Generating a round's matches ====================

/**
 * Turn this week's fixtures into playable team matches, once every team has
 * picked its players. The order a team picks in is its order of play, so the
 * sub-matches are expanded straight away rather than waiting for both sides
 * to fill in an order-of-play dialog.
 */
export const generateLeagueRoundMatches = async (body) => {
  if (!body?._id) throwError('Event ID is required')

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const event = await loadRound(collection, body._id)

  validateGenerateRoundMatches(event)

  const matches = (event.leaguePairings || []).map((pairing) =>
    buildLeagueTeamMatch(event, pairing),
  )

  const stages = [...(event.eventStages || [])]
  const groupIndex = stages.findIndex((s) => s.type === 'group')
  const stage = stages[groupIndex]
  stages[groupIndex] = {
    ...stage,
    groups: [{ index: 0, participants: [], matches, isComplete: false }],
  }

  await collection.updateOne(
    { _id: event._id },
    { $set: { eventStages: stages, updatedAt: new Date().toISOString() } },
  )
  return { success: true, matches: matches.length }
}

const validateGenerateRoundMatches = (event) => {
  const errors = []
  const pairings = event.leaguePairings || []
  if (pairings.length === 0) {
    errors.push(
      'This round has no fixtures — generate the league schedule first',
    )
  }
  if (getRoundMatches(event).length > 0) {
    errors.push('This round already has a match schedule')
  }

  const playing = pairings.flatMap((p) => [
    p.homeParticipantId,
    p.awayParticipantId,
  ])
  const selections = event.leagueSelections || []
  if (!isRoundSelectionComplete(selections, playing, event.nop)) {
    errors.push(`Every team must select ${event.nop} players first`)
  }
  const clashes = findDoubleBookedPlayers(selections)
  if (clashes.length > 0) {
    errors.push(
      `${namePlayers(event, clashes)} is selected for two teams this week`,
    )
  }
  throwErrors(errors)
}

const selectedPlayers = (event, participantId) => {
  const participant = (event.participants || []).find(
    (p) => p._id === participantId,
  )
  const selection = (event.leagueSelections || []).find(
    (s) => s.participantId === participantId,
  )
  const byId = new Map(
    (participant?.players || []).map((p) => [p._id.toString(), p]),
  )
  // Selection order is the order of play: first picked is A, then B, then C.
  return (selection?.playerIds || []).map((id) => byId.get(id.toString()))
}

const getLeagueTeamMatchType = (event) =>
  event.league?.format === 'RR Singles'
    ? `rr${event.nop}`
    : getTeamMatchType(
        event.nop,
        getLeagueSubMatchCount(event.league?.format, event.nop),
      )

const buildLeagueTeamMatch = (event, pairing) => {
  const home = selectedPlayers(event, pairing.homeParticipantId)
  const away = selectedPlayers(event, pairing.awayParticipantId)
  const numberOfMatches = getLeagueSubMatchCount(
    event.league?.format,
    event.nop,
  )

  return {
    _id: generateId(),
    config: {
      numberOfGames: getBestOfNumber(event.league?.roundGames || 'Best of 5'),
      isSuddenDeath: true,
      gameConfig: { type: 'standard', targetPoints: 11, isGolden: false },
    },
    side1: home,
    side2: away,
    games: [],
    gamesWon1: 0,
    gamesWon2: 0,
    winningSide: undefined,
    homeSide: 1,
    isTeamMatch: true,
    teamMatchType: getLeagueTeamMatchType(event),
    numberOfMatches,
    // A league round is not sudden death: the standings rank on total
    // matches and games won across the season, so every sub-match is
    // played even once the round is mathematically decided.
    playAllMatches: true,
    participantIds: {
      side1: pairing.homeParticipantId,
      side2: pairing.awayParticipantId,
    },
    // No assignments yet: each side sets its own order of play, and the
    // sub-matches are expanded when the second one is saved.
    lockedTableNumber: pairing.tableNumber,
  }
}
