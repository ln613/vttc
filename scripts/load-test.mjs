#!/usr/bin/env node
// Busy-tournament-day load test.
//
// Drives the DEPLOYED QA site over real HTTP (so Netlify function
// invocations, bandwidth and MongoDB connections are all genuine) while a
// pool of simulated spectator clients holds real Pusher subscriptions and
// refetches exactly the way the browser does.
//
// Measures the three things the optimizations were meant to move:
//   1. Netlify  — request count + bytes on the wire (-> credits)
//   2. MongoDB  — peak concurrent connections during the burst
//   3. Pusher   — messages published to the live-score channel
//
//   node --env-file=.env scripts/load-test.mjs [--events 8] [--tables 8]
//
// Defaults target vttc-live-qa, which reads the vttc-dev database.

// pusher-js ships a CJS build; under ESM the node entry exposes the
// constructor as a named export (and again under `default`).
import * as PusherNS from 'pusher-js/node.js'
const Pusher = PusherNS.Pusher ?? PusherNS.default?.Pusher ?? PusherNS.default
import { MongoClient, ObjectId } from 'mongodb'
import { readFileSync, writeFileSync } from 'node:fs'

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = process.argv[i + 1]
  return typeof dflt === 'number' ? Number(v) : v
}

const HOST = arg('host', 'https://vttc-live-qa.netlify.app')
const API = `${HOST}/.netlify/functions/api`
const TABLES = arg('tables', 8)
const SPECTATORS = arg('spectators', 50)
const SINGLES = arg('singles', 6)
const TEAMS = arg('teams', 2)
const PARTICIPANTS = arg('participants', 16)
// Real-time pace: one point per second, matching a live match. --speed >1
// compresses time for smoke tests (and undercounts Pusher, which coalesces
// on a wall-clock window).
const SPEED = arg('speed', 1)
const MAX_MINUTES = arg('max-minutes', 120)
const EVENT_DATE = arg('date', '2026-09-05')
const TAG = arg('tag', `LOAD${Date.now().toString(36).slice(-4).toUpperCase()}`)
// Events store no name (the tournament supplies it) and enforce one event
// per tournament+date, so runs are identified by the ids they created.
const ID_FILE = new URL('../.load-test-events.json', import.meta.url)

const SINGLES_NAMES = ['Open Singles', 'U1800 Singles', 'U1600 Singles', 'U1300 Singles', 'U900 Singles', 'U600 Singles']
const TEAM_NAMES = ['U3500 Teams', 'U2500 Teams']

// Mirrors the client: gamePlayStore SAVE_DEBOUNCE_MS / refetch.ts jitter.
const SAVE_DEBOUNCE_MS = 1000
const REFETCH_JITTER_MS = 1500
const POINT_INTERVAL_MS = 1000
const REQUEST_TIMEOUT_MS = 30000

// ---------------------------------------------------------------- metrics
const M = {
  req: 0, reqErr: 0, byType: {}, wireBytes: 0, rawBytes: 0, bytesByType: {},
  scorerReq: 0, spectatorReq: 0,
  pusherMsgs: 0, pusherByEventId: {},
  matchesFinished: 0, subMatchesFinished: 0, teamOrdersSet: 0,
  points: 0, errors: [], inFlight: 0, maxInFlight: 0,
}
const note = (ctx, e) => { if (M.errors.length < 400) M.errors.push(`${ctx}: ${String(e?.message || e).slice(0, 140)}`) }
const bump = (o, k, n = 1) => { o[k] = (o[k] || 0) + n }

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms / SPEED)))
const rand = (n) => Math.floor(Math.random() * n)

// ------------------------------------------------------------------- http
const call = async (method, type, payload = {}, who = 'scorer') => {
  const url = method === 'get'
    ? `${API}?${new URLSearchParams({ type, ...payload })}`
    : `${API}?type=${type}`
  M.req++; bump(M.byType, `${method}:${type}`)
  who === 'scorer' ? M.scorerReq++ : M.spectatorReq++
  M.inFlight++; if (M.inFlight > M.maxInFlight) M.maxInFlight = M.inFlight
  try {
    // A dropped connection (cold start, transient DNS) is retried; an HTTP
    // error is not, so real 4xx/5xx still surface.
    let res = null
    for (let attempt = 0; attempt < 5 && !res; attempt++) {
      try {
        res = await fetch(url, {
          method: method.toUpperCase(),
          headers: { 'content-type': 'application/json', 'accept-encoding': 'gzip, br' },
          body: method === 'post' ? JSON.stringify(payload) : undefined,
          // Without a deadline a stalled socket parks a table forever, and
          // because that table still counts as "busy" the whole run hangs.
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
      } catch (e) {
        if (attempt === 4) throw e
        await new Promise((r) => setTimeout(r, 400 * 2 ** attempt))
      }
    }
    const text = await res.text()
    const wire = Number(res.headers.get('content-length')) || text.length
    M.wireBytes += wire; M.rawBytes += text.length
    bump(M.bytesByType, `${method}:${type}`, wire)
    if (!res.ok) {
      M.reqErr++
      let msg = text.slice(0, 120)
      try { msg = JSON.parse(text).error } catch { /* keep raw */ }
      throw new Error(`${type} ${res.status}: ${msg}`)
    }
    return text ? JSON.parse(text) : {}
  } finally { M.inFlight-- }
}

// ------------------------------------------------------- match simulation
// Points arrive ~1/s; the tablet debounces saves by 1s, so a save lands
// whenever the gap between points exceeds the debounce (exactly the real
// client's behaviour, replicated rather than approximated).
const playOneMatch = async (eventId, matchId, numberOfGames, targetPoints = 11, at = () => {}) => {
  const needed = Math.ceil(numberOfGames / 2)
  const games = []
  let won1 = 0, won2 = 0

  await call('post', 'saveMatchSetup', { _id: eventId, matchId, initialServingSide: 1, leftSide: 1 })
    .catch((e) => note('saveMatchSetup', e))

  let debounce = null
  let latest = null
  // Saves are chained so they can never overlap, and so the whole chain can
  // be drained before finishMatch. Without this an in-flight updateGame
  // lands AFTER the finish and overwrites the finished match with a partial
  // score snapshot -- which confirms the match with no winner and stalls
  // the bracket. (The real client has the same race; the human tapping
  // through the confirm dialog is what normally hides it.)
  // At most ONE save is ever outstanding; newer scores overwrite the pending
  // one rather than queueing behind it. That is what the client's 1s
  // debounce achieves in real time, and it keeps a compressed --speed run
  // from producing saves faster than the network can drain them (an
  // unbounded queue there stalled the whole run).
  let pumping = null
  const pump = () => {
    if (pumping) return pumping
    pumping = (async () => {
      while (latest) {
        const s = latest; latest = null
        try { await call('post', 'updateGame', s) } catch (e) { note('updateGame', e) }
      }
      pumping = null
    })()
    return pumping
  }
  const scheduleSave = (payload) => {
    latest = payload
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => { debounce = null; void pump() }, SAVE_DEBOUNCE_MS / SPEED)
  }

  while (won1 < needed && won2 < needed) {
    const side1Wins = Math.random() < 0.5
    const loserPoints = rand(targetPoints - 1)
    // Interleave the winner's and loser's points at random, with the match
    // point last. Generating each point independently let the LOSING side
    // touch 11 mid-game, which the server reads as a finished game — the
    // next game's save then fails with "Match is already finished".
    const seq = [
      ...Array(targetPoints).fill(true),
      ...Array(loserPoints).fill(false),
    ]
    for (let i = seq.length - 1; i > 0; i--) {
      const j = rand(i + 1)
      ;[seq[i], seq[j]] = [seq[j], seq[i]]
    }
    const lastWin = seq.lastIndexOf(true)
    ;[seq[lastWin], seq[seq.length - 1]] = [seq[seq.length - 1], seq[lastWin]]

    let won = 0, lost = 0
    for (const winnerScores of seq) {
      winnerScores ? won++ : lost++
      const s1 = side1Wins ? won : lost
      const s2 = side1Wins ? lost : won
      M.points++
      at(`${matchId.slice(-6)} g${games.length + 1} ${won}-${lost}`)
      scheduleSave({
        _id: eventId, matchId, gameNumber: games.length + 1,
        score: { score1: s1, score2: s2 },
        lastScoredSide: winnerScores === side1Wins ? 1 : 2,
      })
      // Rally length varies around the 1 point/second average.
      await sleep(POINT_INTERVAL_MS * (0.4 + Math.random() * 1.2))
    }
    games.push(side1Wins
      ? { score1: targetPoints, score2: loserPoints }
      : { score1: loserPoints, score2: targetPoints })
    side1Wins ? won1++ : won2++
  }
  if (debounce) clearTimeout(debounce)
  at(`${matchId.slice(-6)} draining saves`)
  await pump()
  // The umpire tapping through the finish/confirm dialog.
  at(`${matchId.slice(-6)} confirming`)
  await sleep(1500)
  try {
    await call('post', 'finishMatch', { _id: eventId, matchId, result: games, confirmed: true })
  } catch (e) {
    // A retried request that actually landed shows up as a duplicate.
    if (!/already confirmed|already finished/i.test(e.message)) throw e
  }
}

// ------------------------------------------------------------ event walker
const stagesOf = (e) => e?.eventStages || []
const groupMatches = (e) => stagesOf(e).filter((s) => s.type === 'group')
  .flatMap((s) => (s.groups || []).flatMap((g) => g.matches || []))
const koMatches = (e) => stagesOf(e).filter((s) => s.type === 'knockout')
  .flatMap((s) => (s.rounds || []).flatMap((r) => (r.matches || []).map((w) => w.match).filter(Boolean)))
const playable = (m) => m && m.winningSide == null && !m.cancelledAt && !m.confirmed

class EventDriver {
  constructor(id, name, isTeam) {
    this.id = id; this.name = name; this.isTeam = isTeam
    this.claimed = new Set(); this.event = null; this.done = false
    this.refreshing = null; this.idleRounds = 0
  }
  async refresh() {
    if (this.refreshing) return this.refreshing
    this.refreshing = call('get', 'event', { _id: this.id })
      .then((e) => { this.event = e; return e })
      .catch((e) => { note(`refresh ${this.name}`, e); return this.event })
      .finally(() => { this.refreshing = null })
    return this.refreshing
  }
  // Next thing a free table can pick up: a playable singles/knockout match,
  // a team sub-match, or a team parent that still needs its order of play.
  nextTask() {
    const e = this.event
    if (!e) return null
    for (const m of [...groupMatches(e), ...koMatches(e)]) {
      if (!m || m.winningSide != null || m.cancelledAt) continue
      if (m.isTeamMatch) {
        // A team match is claimed WHOLE, because in real life one table
        // plays its sub-matches in order. Handing individual subs to
        // different tables let two of them finish out of order, which
        // repeatedly decided and un-decided the parent and left subs
        // stranded mid-play.
        if (this.claimed.has(m._id)) continue
        const needsOrder = !m.side1Assignment || !m.side2Assignment
        if (!needsOrder && !(m.subMatches || []).some(playable)) continue
        this.claimed.add(m._id)
        return { kind: 'team', parentId: m._id, claimKey: m._id }
      }
      if (!playable(m) || this.claimed.has(m._id)) continue
      this.claimed.add(m._id)
      // CRITICAL: best-of differs by round (e.g. "Best of 3 before
      // Semifinal" makes SF/Final best-of-5). Sending a best-of-3 result
      // to a best-of-5 match confirms it with NO winner and bricks the
      // bracket, so always take the count from the match's own config.
      return { kind: 'match', matchId: m._id, claimKey: m._id, numberOfGames: m.config?.numberOfGames || 3 }
    }
    return null
  }
}

const findParent = (e, parentId) =>
  [...groupMatches(e), ...koMatches(e)].find((m) => m._id === parentId)

// One table, one team match: set the order of play, then work through the
// sub-matches in order until the tie is decided (the app cancels the dead
// rubbers itself).
const playTeamMatch = async (drv, parentId, at = () => {}) => {
  for (let step = 0; step < 12; step++) {
    at(`team ${parentId.slice(-6)} step${step}`)
    // Read straight from the API rather than the shared driver snapshot, so
    // the next sub is chosen from state that includes our own last finish.
    const e = await call('get', 'event', { _id: drv.id })
    drv.event = e
    const parent = findParent(e, parentId)
    if (!parent || parent.winningSide != null || parent.cancelledAt) return
    if (!parent.side1Assignment || !parent.side2Assignment) {
      await setTeamOrder(drv, parent)
      continue
    }
    const sub = (parent.subMatches || []).find(playable)
    if (!sub) return
    await playOneMatch(drv.id, sub._id, sub.config?.numberOfGames || 3, 11, at)
    M.subMatchesFinished++
  }
}

const setTeamOrder = async (drv, parent) => {
  for (const side of [1, 2]) {
    const roster = (side === 1 ? parent.side1 : parent.side2) || []
    if (roster.length < 2) continue
    // Send roster.length - 1 picks; the handler derives the last slot.
    await call('post', 'saveTeamMatchAssignment', {
      _id: drv.id, matchId: parent._id, side,
      assignmentIds: roster.slice(0, roster.length - 1).map((p) => String(p._id)),
    })
  }
  M.teamOrdersSet++
}

// --------------------------------------------------------- spectator pool
// Each spectator is a real Pusher subscriber running the same jittered,
// collapsing refetch the browser uses (src/utils/refetch.ts).
const jitteredRefetch = (run) => {
  let timer = null, inFlight = false, again = false
  const execute = async () => {
    timer = null
    if (inFlight) { again = true; return }
    inFlight = true
    try { await run() } catch { /* client swallows */ }
    finally { inFlight = false; if (again) { again = false; schedule() } }
  }
  const schedule = () => {
    if (timer) return
    timer = setTimeout(() => void execute(), Math.random() * REFETCH_JITTER_MS)
  }
  return schedule
}

const startSpectators = async (eventIds) => {
  const key = process.env.VITE_PUSHER_KEY?.replace(/"/g, '').trim()
  const cluster = process.env.VITE_PUSHER_CLUSTER?.replace(/"/g, '').trim()
  if (!key) { console.log('  (no VITE_PUSHER_KEY — skipping spectators)'); return [] }

  const clients = []
  // Mix mirrors a real tournament room: most watch Live Score, some sit on
  // an event page, a few on the schedule (the heaviest payload).
  const roles = []
  for (let i = 0; i < SPECTATORS; i++) {
    roles.push(i % 10 < 6 ? 'liveScore' : i % 10 < 8 ? 'eventDetail' : 'schedule')
  }

  for (let i = 0; i < SPECTATORS; i++) {
    const role = roles[i]
    const watching = eventIds[i % eventIds.length]
    const pusher = new Pusher(key, { cluster })
    const ch = pusher.subscribe('live-score')
    const fetchFor = {
      liveScore: () => call('get', 'liveScore', {}, 'spectator'),
      schedule: () => call('get', 'events', { full: 'true' }, 'spectator'),
      eventDetail: () => call('get', 'event', { _id: watching }, 'spectator'),
    }[role]
    const refetch = jitteredRefetch(fetchFor)
    ch.bind('updated', (data) => {
      if (i === 0) { M.pusherMsgs++; bump(M.pusherByEventId, String(data?.eventId ?? 'null')) }
      // EventDetail only refetches when the broadcast names its event (or none).
      if (role === 'eventDetail' && data?.eventId && data.eventId !== watching) return
      refetch()
    })
    clients.push({ pusher, role })
    await sleep(40) // stagger connections like arriving devices
  }
  const byRole = clients.reduce((a, c) => (bump(a, c.role), a), {})
  console.log(`  ${clients.length} spectators connected:`, JSON.stringify(byRole))
  return clients
}

// --------------------------------------------------- mongo connection probe
const startMongoSampler = async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) return { stop: async () => ({}) }
  const client = new MongoClient(uri, { maxPoolSize: 2 })
  await client.connect()
  const samples = []
  const tick = async () => {
    try {
      const s = await client.db('admin').command({ serverStatus: 1 })
      samples.push({ t: Date.now(), current: s.connections.current, available: s.connections.available })
    } catch { /* transient */ }
  }
  await tick()
  const timer = setInterval(tick, 2000)
  return {
    stop: async () => {
      clearInterval(timer); await tick()
      await client.close()
      const cur = samples.map((s) => s.current)
      return {
        samples: samples.length,
        baseline: cur[0],
        peak: Math.max(...cur),
        mean: Math.round(cur.reduce((a, b) => a + b, 0) / cur.length),
        ceiling: samples[0] ? samples[0].current + samples[0].available : null,
      }
    },
  }
}

// -------------------------------------------------------------------- run
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const setup = async () => {
  const tournaments = await call('get', 'tournaments')
  const byName = new Map(tournaments.map((t) => [t.name, t]))
  const plan = [
    ...SINGLES_NAMES.slice(0, SINGLES).map((n) => [n, false]),
    ...TEAM_NAMES.slice(0, TEAMS).map((n) => [n, true]),
  ]
  const drivers = []
  const created = []
  // One event per tournament+date is allowed, so a re-run needs a free
  // date. Walk forward until the first create succeeds, then use that
  // date for the whole run.
  let date = EVENT_DATE
  for (const [name, isTeam] of plan) {
    const t = byName.get(name)
    if (!t) { note('setup', new Error(`tournament "${name}" missing`)); continue }
    let ev = null
    for (let attempt = 0; attempt < 30 && !ev; attempt++) {
      try {
        // Events are unique on (eventName, date); the run tag in the name
        // keeps re-runs from colliding and makes leftovers easy to spot.
        ev = await call('post', 'simulateEvent', {
          tournamentId: String(t._id), date, time: '9:00 AM',
          name: `${TAG} ${name}`, maxParticipants: PARTICIPANTS, registrationFee: 30,
        })
      } catch (e) {
        if (!/already exists/i.test(e.message)) { note(`setup ${name}`, e); break }
        date = addDays(date, 1)
      }
    }
    if (!ev) continue
    try {
      await call('post', 'generateGroups', { _id: String(ev._id) })
      const drv = new EventDriver(String(ev._id), name, isTeam)
      await drv.refresh()
      drivers.push(drv)
      created.push(String(ev._id))
      console.log(`  ${name}: ${(ev.participants || []).length} participants  ${date}  (${ev._id})`)
    } catch (e) { note(`setup ${name}`, e) }
  }
  writeFileSync(ID_FILE, JSON.stringify({ tag: TAG, date, ids: created }, null, 2))
  console.log(`  (event ids recorded in .load-test-events.json for cleanup)`)
  return drivers
}

// How many tables are mid-match. A table may only give up once every
// other table is idle too -- otherwise it quits while another table is
// still holding the last claimable match, leaving the event unfinished.
let busyTables = 0
let deadline = Infinity
// What each table is doing right now, so a stalled run says where it stuck.
const tableState = []

const runTable = async (tableNo, drivers) => {
  let idle = 0
  const at = (s) => { tableState[tableNo] = s }
  at('start')
  while (idle < 8 && Date.now() < deadline) {
    // Round-robin across events so all 8 run concurrently, like a real hall.
    let task = null, drv = null
    for (let k = 0; k < drivers.length; k++) {
      const d = drivers[(tableNo + k) % drivers.length]
      if (d.done) continue
      const t = d.nextTask()
      if (t) { task = t; drv = d; break }
    }
    if (!task) {
      // Only count toward giving up when nothing else is running; while
      // another table plays, new sub-matches and knockout rounds can still
      // appear. This poll is driver bookkeeping, so it is NOT scaled by
      // --speed (a compressed wait made both tables quit within a second).
      at(`idle(${idle})`)
      idle = busyTables === 0 ? idle + 1 : 0
      // Refresh every event so newly-opened knockout rounds and
      // freshly-expanded team sub-matches become visible.
      await Promise.all(drivers.filter((d) => !d.done).map((d) => d.refresh()))
      await new Promise((r) => setTimeout(r, 2000))
      continue
    }
    idle = 0
    busyTables++
    try {
      if (task.kind === 'team') {
        at(`team ${task.parentId.slice(-6)}`)
        await playTeamMatch(drv, task.parentId, at)
      } else {
        at(`match ${task.matchId.slice(-6)}`)
        await playOneMatch(drv.id, task.matchId, task.numberOfGames, 11, at)
        M.matchesFinished++
      }
    } catch (e) {
      note(task.kind, e)
      // Let another table retry this one rather than skipping it forever.
      drv.claimed.delete(task.claimKey)
    } finally {
      busyTables--
    }
    at('refresh')
    await drv.refresh()
  }
  at('EXIT')
}

// Confirm the tournaments actually ran to completion — a match that is
// confirmed but has no winner is a stalled bracket, not a finished one.
const diagnose = (drivers) => {
  for (const d of drivers) {
    const e = d.event
    if (!e) continue
    const parents = [...groupMatches(e), ...koMatches(e)]
    const open = parents.filter((m) => m.winningSide == null && !m.cancelledAt)
    if (!open.length) continue
    console.log(`  [left in ${d.name}] ${open.length} open parent match(es)`)
    for (const m of open.slice(0, 6)) {
      if (!m.isTeamMatch) {
        console.log(`    single ${m._id} conf=${m.confirmed} claimed=${d.claimed.has(m._id)}`)
        continue
      }
      const subs = m.subMatches || []
      console.log(`    team ${m._id} s1a=${!!m.side1Assignment} s2a=${!!m.side2Assignment}` +
        ` orderClaimed=${d.claimed.has(`order:${m._id}`)} subs=[` +
        subs.map((x) => `${x.winningSide ?? '-'}${x.cancelledAt ? 'X' : x.confirmed ? 'C' : ''}` +
          `${d.claimed.has(x._id) ? '*' : ''}`).join(' ') + ']')
    }
  }
}

const verify = async (drivers) => {
  const rows = []
  for (const d of drivers) {
    await d.refresh()
    const e = d.event
    const all = [
      ...groupMatches(e),
      ...koMatches(e),
      ...groupMatches(e).flatMap((m) => m.subMatches || []),
      ...koMatches(e).flatMap((m) => m.subMatches || []),
    ]
    rows.push({
      name: d.name,
      total: all.length,
      done: all.filter((m) => m.winningSide != null).length,
      bricked: all.filter((m) => m.winningSide == null && m.confirmed).length,
      pending: all.filter((m) => m.winningSide == null && !m.confirmed && !m.cancelledAt).length,
      deadRubbers: all.filter((m) => m.cancelledAt).length,
    })
  }
  return rows
}

const report = (t0, t1, mongo, drivers, completion) => {
  const mins = ((t1 - t0) / 60000).toFixed(1)
  const gb = M.wireBytes / 1024 ** 3
  const credits = {
    requests: M.req / 5000,
    bandwidth: gb * 20,
  }
  credits.total = credits.requests + credits.bandwidth
  console.log(`\n${'='.repeat(66)}\nLOAD TEST REPORT\n${'='.repeat(66)}`)
  console.log(`window (UTC)   ${new Date(t0).toISOString()}  ->  ${new Date(t1).toISOString()}`)
  console.log(`window (local) ${new Date(t0).toLocaleTimeString()}  ->  ${new Date(t1).toLocaleTimeString()}   (${mins} min)`)
  console.log(`target         ${HOST}   tag=${TAG}`)
  console.log(`\n-- played --`)
  console.log(`  events                ${drivers.length}   tables ${TABLES}   spectators ${SPECTATORS}`)
  console.log(`  matches finished      ${M.matchesFinished}`)
  console.log(`  team sub-matches      ${M.subMatchesFinished}`)
  console.log(`  team orders set       ${M.teamOrdersSet}`)
  console.log(`  points scored         ${M.points}`)
  console.log(`\n-- completion (incl. team sub-matches) --`)
  completion.forEach((r) => console.log(
    `  ${r.name.padEnd(16)} ${String(r.done).padStart(4)}/${String(r.total).padEnd(4)} done` +
    `${r.bricked ? `   ${r.bricked} BRICKED` : ''}${r.pending ? `   ${r.pending} unplayed` : ''}` +
    `${r.deadRubbers ? `   (${r.deadRubbers} dead rubbers)` : ''}`))
  console.log(`\n-- 1. NETLIFY --`)
  console.log(`  total requests        ${M.req}   (errors ${M.reqErr})`)
  console.log(`    from scorers        ${M.scorerReq}`)
  console.log(`    from spectators     ${M.spectatorReq}`)
  console.log(`  bytes on the wire     ${(M.wireBytes / 1024 ** 2).toFixed(1)} MB   (uncompressed ${(M.rawBytes / 1024 ** 2).toFixed(1)} MB)`)
  console.log(`  peak concurrent reqs  ${M.maxInFlight}`)
  console.log(`  credits: requests     ${credits.requests.toFixed(2)}  (${M.req} / 5000)`)
  console.log(`  credits: bandwidth    ${credits.bandwidth.toFixed(2)}  (${gb.toFixed(4)} GB x 20)`)
  console.log(`  credits TOTAL         ${credits.total.toFixed(2)}   [excludes compute + the 15/deploy]`)
  console.log(`  by type:`)
  Object.entries(M.byType).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`    ${k.padEnd(34)} ${String(v).padStart(6)}   ${((M.bytesByType[k] || 0) / 1024 ** 2).toFixed(2)} MB`))
  console.log(`\n-- 2. MONGODB --`)
  if (mongo.samples) {
    console.log(`  cluster ceiling       ${mongo.ceiling}`)
    console.log(`  baseline connections  ${mongo.baseline}`)
    console.log(`  PEAK connections      ${mongo.peak}   (${((mongo.peak / mongo.ceiling) * 100).toFixed(1)}% of ceiling)`)
    console.log(`  mean connections      ${mongo.mean}   over ${mongo.samples} samples @2s`)
  } else console.log('  (not sampled)')
  console.log(`\n-- 3. PUSHER --`)
  console.log(`  messages published    ${M.pusherMsgs}   (live-score channel, counted by one subscriber)`)
  console.log(`  delivered to clients  ~${M.pusherMsgs * SPECTATORS}   (${SPECTATORS} subscribers)`)
  console.log(`  broadcasts/min        ${(M.pusherMsgs / Number(mins)).toFixed(1)}`)
  const named = Object.entries(M.pusherByEventId).filter(([k]) => k !== 'null').reduce((a, [, v]) => a + v, 0)
  console.log(`  coalesced (eventId=null) ${M.pusherByEventId.null || 0}   single-event ${named}`)
  if (M.errors.length) {
    console.log(`\n-- errors (${M.errors.length} recorded) --`)
    const tally = M.errors.reduce((a, e) => (bump(a, e), a), {})
    Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .forEach(([e, n]) => console.log(`  x${n}  ${e}`))
  }
  console.log(`\nCleanup:  npm run load:test -- --cleanup`)
  console.log('='.repeat(66))
}

const cleanup = async () => {
  const { ids = [], tag } = JSON.parse(readFileSync(ID_FILE, 'utf8'))
  if (!ids.length) return console.log('nothing to clean up')
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const res = await client.db('vttc-dev').collection('events').deleteMany({
    $or: [
      { _id: { $in: ids.map((id) => new ObjectId(id)) } },
      { eventName: new RegExp(`^${tag} `) },
    ],
  })
  console.log(`deleted ${res.deletedCount}/${ids.length} events from run "${tag}" (vttc-dev)`)
  await client.close()
}

const run = async () => {
  if (process.argv.includes('--cleanup')) return cleanup()

  console.log(`Load test -> ${HOST}`)
  console.log(`${SINGLES} singles + ${TEAMS} team events, ${PARTICIPANTS} participants, ${TABLES} tables, ${SPECTATORS} spectators, speed ${SPEED}x\n`)
  console.log('setting up events...')
  const drivers = await setup()
  if (!drivers.length) {
    M.errors.forEach((e) => console.error('  setup error:', e))
    throw new Error('no events created')
  }

  console.log('\nconnecting spectators...')
  const spectators = await startSpectators(drivers.map((d) => d.id))
  const mongoSampler = await startMongoSampler()

  console.log('\nplaying...')
  const t0 = Date.now()
  deadline = t0 + MAX_MINUTES * 60000
  const progress = setInterval(() => {
    console.log(`  [${((Date.now() - t0) / 60000).toFixed(1)}m] matches ${M.matchesFinished} subs ${M.subMatchesFinished} | req ${M.req} (err ${M.reqErr}, thrown ${M.errors.length}) | pusher ${M.pusherMsgs} | busy ${busyTables} | tables: ${tableState.join(' / ')}`)
  }, 30000)

  await Promise.all(Array.from({ length: TABLES }, (_, i) => runTable(i, drivers)))
  const t1 = Date.now()
  clearInterval(progress)

  console.log('\ntables idle — what is left:')
  diagnose(drivers)
  const mongo = await mongoSampler.stop()
  const completion = await verify(drivers)
  spectators.forEach((s) => s.pusher.disconnect())
  report(t0, t1, mongo, drivers, completion)
  process.exit(0)
}

run().catch((e) => { console.error('FATAL', e); process.exit(1) })
