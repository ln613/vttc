#!/usr/bin/env node
// Seed a tournament series into a club database: the tournament templates
// its events need, the events themselves, and a field of entrants drawn
// from the club's own players.
//
//   npm run seed:series -- --club bctta
//   npm run seed:series -- --club bctta --dry-run   report, write nothing
//   npm run seed:series -- --club bctta --real      let results move ratings
//
// Entrants are picked at random, so by default every event is flagged
// `simulated` and excluded from rating updates (rating.js). Pass --real
// only when the entry list is the genuine one.
//
// Safe to re-run: an event is matched on (eventName, date) — the pair
// saveEvent itself refuses to duplicate — and one that already exists is
// left alone, entrants and all.
import { resolveClubTarget } from './utils/clubEnv.mjs'

// ==================== the series ====================

const SERIES_NAME = '2026 Pan-Asia Pacific Fall Open'
const SATURDAY = '2026-09-26'
const SUNDAY = '2026-09-27'

const TEAM_SIZE = 2
const MIN_ENTRIES = 9
const MAX_ENTRIES = 12

// "3rd & 4th" on the flyer is one figure paid to both losing semifinalists.
const prize = (first, second, thirdAndFourth) => ({
  first,
  second,
  third: thirdAndFourth,
  fourth: thirdAndFourth,
})

// Both flyer pages in one table: when each event plays, what it costs to
// enter, what it pays out, and who is allowed in.
const SERIES_EVENTS = [
  { name: 'Open Team', day: SATURDAY, time: '9:00 AM', fee: 80, prizes: prize(260, 130, 80), team: true, restriction: 'Open' },
  { name: 'U1900 Team', day: SATURDAY, time: '9:00 AM', fee: 60, prizes: prize(180, 90, 60), team: true, restriction: 'Rated', ratingLimit: 1900 },
  { name: 'Age 60+ Singles', day: SATURDAY, time: '9:00 AM', fee: 25, restriction: 'Age', ageLimitType: 'O', ageLimit: 60 },
  { name: 'U350 Singles', day: SATURDAY, time: '11:30 AM', fee: 25, restriction: 'Rated', ratingLimit: 350 },
  { name: 'U1550 Singles', day: SATURDAY, time: '12:30 PM', fee: 40, prizes: prize(140, 70, 45), restriction: 'Rated', ratingLimit: 1550 },
  { name: 'U950 Singles', day: SATURDAY, time: '1:30 PM', fee: 30, restriction: 'Rated', ratingLimit: 950 },
  { name: 'Age 35+ Singles', day: SATURDAY, time: '2:30 PM', fee: 40, prizes: prize(100, 50, 30), restriction: 'Age', ageLimitType: 'O', ageLimit: 35 },
  { name: 'U1850 Singles', day: SATURDAY, time: '4:00 PM', fee: 45, prizes: prize(160, 80, 50), restriction: 'Rated', ratingLimit: 1850 },
  { name: 'U3600 Team', day: SUNDAY, time: '9:00 AM', fee: 70, prizes: prize(240, 120, 70), team: true, restriction: 'Rated', ratingLimit: 3600 },
  { name: 'U1100 Team', day: SUNDAY, time: '9:00 AM', fee: 50, prizes: prize(160, 80, 50), team: true, restriction: 'Rated', ratingLimit: 1100 },
  { name: 'Men Singles', day: SUNDAY, time: '11:30 AM', fee: 50, prizes: prize(240, 120, 60), sex: 'Man', restriction: 'Open' },
  { name: 'Women Singles', day: SUNDAY, time: '11:30 AM', fee: 40, prizes: prize(120, 60, 40), sex: 'Woman', restriction: 'Open' },
  { name: 'U650 Singles', day: SUNDAY, time: '12:30 PM', fee: 30, restriction: 'Rated', ratingLimit: 650 },
  { name: 'U1250 Singles', day: SUNDAY, time: '2:00 PM', fee: 40, prizes: prize(120, 60, 40), restriction: 'Rated', ratingLimit: 1250 },
]

// ==================== input ====================

const throwError = (message) => {
  throw new Error(message)
}

const parseArgs = (argv) => {
  const value = (name) => {
    const at = argv.indexOf(`--${name}`)
    return at === -1 ? undefined : argv[at + 1]
  }
  return {
    club: value('club') ?? process.env.CLUB,
    dryRun: argv.includes('--dry-run'),
    real: argv.includes('--real'),
  }
}

// ==================== tournament templates ====================

// Each event needs a Tournament to inherit its format from. The series
// brings its own rather than reusing whatever the club happens to have,
// so the rating bands match the flyer exactly.
const buildTournamentInput = (def) => ({
  name: def.name,
  sex: def.sex || 'All',
  type: def.team ? 'Team' : 'Single',
  teamSize: def.team ? TEAM_SIZE : undefined,
  restriction: def.restriction,
  ratingLimit: def.ratingLimit,
  ageLimitType: def.ageLimitType,
  ageLimit: def.ageLimit,
  stages: 'Group + Knockout',
})

const ensureTournament = async (db, saveTournament, def) => {
  if (!def) throwError('Event definition is required')

  const existing = await db.collection('tournaments').findOne({ name: def.name })
  if (existing) return { _id: existing._id.toString(), created: false }

  const saved = await saveTournament(buildTournamentInput(def))
  return { _id: saved._id.toString(), created: true }
}

// ==================== events ====================

// Team matches are best of 3 games and best of 3 matches; singles are best
// of 3 games. The same in the group stage and the knockout.
const buildEventInput = (def, tournamentId) => ({
  tournamentId,
  eventSeries: SERIES_NAME,
  date: def.day,
  time: def.time,
  maxParticipants: 0,
  name: def.name,
  groupGames: 'Best of 3',
  knockoutGames: 'Best of 3',
  groupMatches: 'Best of 3',
  knockoutMatches: 'Best of 3',
  qualifiers: 'Top 2',
  registrationFee: def.fee,
  prizes: def.prizes || null,
})

const findExistingEvent = async (db, def) =>
  db.collection('events').findOne({ eventName: def.name, date: def.day })

// ==================== picking the field ====================

const shuffle = (items) => {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const randomBetween = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

const playerId = (player) => player._id.toString()

const isMale = (player) => ['m', 'male'].includes((player.sex || '').trim().toLowerCase())
const isFemale = (player) => ['f', 'female'].includes((player.sex || '').trim().toLowerCase())

// An unrated player (rating 0, or none at all) can't be placed in a rating
// band, and seeding a draw with them tells us nothing — leave them out.
const isRated = (player) => (player.rating ?? 0) > 0

const meetsSex = (def, player) => {
  if (def.sex === 'Man') return isMale(player)
  if (def.sex === 'Woman') return isFemale(player)
  return true
}

// The players here came from the TTCan list, which gives a birth year and
// no date. The app's own age check reads dateOfBirth, so it cannot judge
// these entries — see the note in the summary.
const meetsAge = (def, player) => {
  if (def.restriction !== 'Age') return true
  if (!player.birthYear) return false
  const age = Number(def.day.slice(0, 4)) - player.birthYear
  return def.ageLimitType === 'O' ? age >= def.ageLimit : age <= def.ageLimit
}

// A singles rating limit applies to the player; a team's applies to the
// pair, so here it only rules out anyone already over it on their own.
const meetsRating = (def, player) =>
  def.restriction !== 'Rated' || player.rating <= def.ratingLimit

const eligiblePlayers = (def, players, taken) => {
  if (!def) throwError('Event definition is required')
  return players.filter(
    (p) =>
      isRated(p) &&
      !taken.has(playerId(p)) &&
      meetsSex(def, p) &&
      meetsAge(def, p) &&
      meetsRating(def, p),
  )
}

const pickSingles = (pool, wanted) => shuffle(pool).slice(0, wanted).map((p) => [p])

// Pairs are drawn in random order and matched to the first partner that
// keeps the team under the combined limit. Anyone too heavy to pair with
// whoever is left simply goes unpartnered.
const pickTeams = (pool, wanted, ratingLimit) => {
  const available = shuffle(pool)
  const teams = []
  while (teams.length < wanted && available.length >= 2) {
    const first = available.shift()
    const at = available.findIndex(
      (second) => !ratingLimit || first.rating + second.rating <= ratingLimit,
    )
    if (at === -1) continue
    teams.push([first, available.splice(at, 1)[0]])
  }
  return teams
}

const pickEntries = (def, pool) => {
  const wanted = randomBetween(MIN_ENTRIES, MAX_ENTRIES)
  return def.team
    ? pickTeams(pool, wanted, def.restriction === 'Rated' ? def.ratingLimit : 0)
    : pickSingles(pool, wanted)
}

// ==================== writing ====================

const toParticipants = (entries, nop, { generateId, calculateParticipantRating, sanitizeForStorage }) =>
  entries.map((players) => ({
    _id: generateId(),
    players: players.map(sanitizeForStorage),
    teamName: null,
    rating: calculateParticipantRating(players, nop),
  }))

const seedOneEvent = async (context, def) => {
  const { db, handlers, players, slots, args } = context

  const existing = await findExistingEvent(db, def)
  if (existing)
    return { name: def.name, status: 'exists', entries: existing.participants?.length ?? 0 }

  const slot = `${def.day} ${def.time}`
  const taken = slots.get(slot) ?? new Set()
  const pool = eligiblePlayers(def, players, taken)
  const entries = pickEntries(def, pool)

  // Booked before the write, not after, so nobody is entered in two events
  // starting at the same time — and so a dry run reports the same field a
  // real one would produce.
  const entrantIds = entries.flat().map(playerId)
  for (const id of entrantIds) taken.add(id)
  slots.set(slot, taken)

  const report = {
    name: def.name,
    status: 'created',
    entries: entries.length,
    pool: pool.length,
    short: entries.length < MIN_ENTRIES,
  }
  if (args.dryRun) return { ...report, status: 'would create' }

  const tournament = await ensureTournament(db, handlers.saveTournament, def)
  const event = await handlers.saveEvent(buildEventInput(def, tournament._id))

  const nop = def.team ? TEAM_SIZE : 1
  const participants = toParticipants(entries, nop, handlers)

  await db.collection('events').updateOne(
    { _id: handlers.toObjectId(event._id) },
    {
      $set: {
        participants,
        paidPlayerIds: entrantIds,
        ...(args.real ? {} : { simulated: true }),
      },
    },
  )

  return report
}

// ==================== run ====================

const reportLine = (r) =>
  `  ${r.name.padEnd(18)} ${r.status.padEnd(12)} ${String(r.entries).padStart(2)} ` +
  `${r.entries === 1 ? 'entry ' : 'entries'}` +
  (r.pool === undefined ? '' : `  (pool ${r.pool})`) +
  (r.short ? '  <- fewer than asked for' : '')

const run = async () => {
  const args = parseArgs(process.argv.slice(2))
  if (!args.club)
    throwError('Which club? e.g. npm run seed:series -- --club bctta')

  const target = resolveClubTarget(args.club)
  process.env.MONGODB_URI = target.uri
  process.env.MONGODB_DB = target.dbName

  // Imported only once the club's cluster is in the environment, because
  // db.js reads it at connect time — and imported at all so the events are
  // built by the same code the API uses, not a second copy of it.
  const { connectDB, getDB, toObjectId } = await import('../netlify/functions/utils/db.js')
  const { saveEvent, generateId, calculateParticipantRating } = await import(
    '../netlify/functions/utils/eventHandlers.js'
  )
  const { saveTournament } = await import('../netlify/functions/utils/tournamentHandlers.js')
  const { sanitizeForStorage } = await import('../netlify/functions/utils/embeddedPlayers.js')

  await connectDB()
  const db = getDB()
  const players = await db.collection('players').find({}).toArray()

  console.log(`${SERIES_NAME} -> ${args.club} (${target.dbName})`)
  console.log(`${players.length} players on file${args.dryRun ? ', dry run' : ''}\n`)

  const context = {
    db,
    players,
    slots: new Map(),
    args,
    handlers: {
      saveEvent,
      saveTournament,
      generateId,
      calculateParticipantRating,
      sanitizeForStorage,
      toObjectId,
    },
  }

  for (const def of SERIES_EVENTS) console.log(reportLine(await seedOneEvent(context, def)))

  console.log(
    args.real
      ? '\nEvents count towards ratings.'
      : '\nEvents flagged `simulated` — results will not move ratings.',
  )
  process.exit(0)
}

run().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
