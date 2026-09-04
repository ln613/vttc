#!/usr/bin/env node
// Simulate a busy tournament day against the DEV database and report the
// effect of the load optimizations.
//
// Drives the real API handler IN-PROCESS (not over HTTP) because the
// long-running `netlify dev` bundles functions at startup and is serving a
// stale build. In-process also lets us exercise the DEPLOYED pool settings
// (NETLIFY_DEV unset) safely against the dev DB.
//
//   npm run sim -- [--speed 600]   # 600 = 10 simulated minutes per real second

process.env.MONGODB_DB = 'vttc-dev' // never production
delete process.env.NETLIFY_DEV // exercise deployed pool sizing (5 / 1)

const { handler } = await import('../netlify/functions/api.js')
const { readMetrics, resetMetrics } = await import('../netlify/functions/utils/metrics.js')

const argNum = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`)
  const v = i === -1 ? NaN : Number(process.argv[i + 1])
  return Number.isFinite(v) ? v : dflt
}
const SPEED = argNum('speed', 600)
const PARTICIPANTS = 16
const POINT_SECONDS = 1
const SAVE_EVERY_SECONDS = 3
// --pace 0 skips the per-3s score saves, isolating the match-level traffic
// (the only thing the Pusher optimizations act on).
const PACE = argNum('pace', 1)
const SINGLES = ['Open Singles', 'U1800 Singles', 'U1600 Singles', 'U1300 Singles', 'U900 Singles', 'U600 Singles']
const TEAMS = ['U3500 Teams', 'U2500 Teams']

const S = {
  events: [], groupMatches: 0, koMatches: 0, teamParents: 0, subMatches: 0,
  updateGame: 0, updateGameErr: 0, simSeconds: 0, errors: [],
}
const note = (e, ctx) => {
  if (S.errors.length < 25) S.errors.push(`${ctx}: ${String(e.message).slice(0, 110)}`)
}

const call = async (method, type, payload = {}) => {
  const res = await handler({
    httpMethod: method.toUpperCase(),
    queryStringParameters: method === 'get' ? { type, ...payload } : { type },
    body: method === 'post' ? JSON.stringify(payload) : null,
  })
  const body = JSON.parse(res.body || '{}')
  if (res.statusCode !== 200) throw new Error(`${type} ${res.statusCode}: ${body.error}`)
  return body
}

const sleepSim = async (seconds) => {
  S.simSeconds += seconds
  const ms = (seconds * 1000) / SPEED
  if (ms >= 1) await new Promise((r) => setTimeout(r, ms))
}

// --- match play -----------------------------------------------------------
const playGames = (bestOf = 3) => {
  const need = Math.ceil(bestOf / 2)
  const games = []
  let a = 0, b = 0
  while (a < need && b < need) {
    const s1 = Math.random() < 0.5
    const l = Math.floor(Math.random() * 10)
    games.push(s1 ? { score1: 11, score2: l } : { score1: l, score2: 11 })
    s1 ? a++ : b++
  }
  return games
}
const points = (g) => g.reduce((n, x) => n + x.score1 + x.score2, 0)

const playMatch = async (eventId, matchId, bestOf) => {
  const games = playGames(bestOf)
  const secs = points(games) * POINT_SECONDS
  const saves = PACE === 0 ? 0 : Math.max(1, Math.round(secs / SAVE_EVERY_SECONDS))
  for (let i = 1; i <= saves; i++) {
    const f = i / saves
    try {
      await call('post', 'updateGame', {
        _id: eventId, matchId, gameNumber: 1,
        score: { score1: Math.round(games[0].score1 * f), score2: Math.round(games[0].score2 * f) },
        lastScoredSide: Math.random() < 0.5 ? 1 : 2,
      })
      S.updateGame++
    } catch (e) { S.updateGameErr++; note(e, 'updateGame') }
    await sleepSim(SAVE_EVERY_SECONDS)
  }
  await call('post', 'finishMatch', { _id: eventId, matchId, result: games, confirmed: true })
  return games
}

// --- walking the event ----------------------------------------------------
const groupMatches = (ev) =>
  (ev.eventStages || []).filter((s) => s.type === 'group')
    .flatMap((s) => (s.groups || []).flatMap((g) => g.matches || []))

const koMatches = (ev) =>
  (ev.eventStages || []).filter((s) => s.type === 'knockout')
    .flatMap((s) => (s.rounds || []).flatMap((r) => (r.matches || []).map((m) => m.match).filter(Boolean)))

const unfinished = (m) => m && m.winningSide == null && !m.cancelledAt

// A team parent needs its order set before sub-matches exist.
const setTeamOrder = async (eventId, m) => {
  for (const side of [1, 2]) {
    const players = (side === 1 ? m.side1 : m.side2) || []
    if (players.length < 2) continue
    await call('post', 'saveTeamMatchAssignment', {
      _id: eventId, matchId: m._id, side,
      assignmentIds: [String(players[0]._id)],
    })
  }
}

const playPending = async (eventId, isTeam, bestOf) => {
  let guard = 0
  let stalls = 0
  while (guard++ < 200) {
    const ev = await call('get', 'event', { _id: eventId })
    const all = [...groupMatches(ev), ...koMatches(ev)]
    let did = 0
    for (const m of all) {
      if (!unfinished(m)) continue
      if (m.isTeamMatch) {
        const subs = (m.subMatches || []).filter(unfinished)
        if (!subs.length) {
          try { await setTeamOrder(eventId, m); S.teamParents++; did++ } catch (e) { note(e, 'setOrder') }
          break // refetch: sub-matches were just created
        }
        for (const sub of subs) {
          try { await playMatch(eventId, sub._id, bestOf); S.subMatches++; did++ } catch (e) { note(e, 'sub') }
        }
        break
      }
      try {
        await playMatch(eventId, m._id, bestOf)
        did++
        if (koMatches(ev).some((k) => k && k._id === m._id)) S.koMatches++
        else S.groupMatches++
      } catch (e) { note(e, 'match') }
      if (did >= 8) break // batch, then refetch (mirrors 8 tables)
    }
    if (!did) {
      // No playable match left: try to open the next knockout round. If that
      // fails twice in a row the event is as far as it can go (byes, or a
      // match the driver can't drive) — stop rather than spin.
      try {
        await call('post', 'generateKnockout', { _id: eventId })
        stalls = 0
      } catch {
        if (++stalls >= 2) return
      }
    } else {
      stalls = 0
    }
  }
}

// --- run ------------------------------------------------------------------
const run = async () => {
  const t0 = Date.now()
  resetMetrics()
  const tournaments = await call('get', 'tournaments')
  const byName = new Map(tournaments.map((t) => [t.name, t]))
  const nS = argNum('singles', SINGLES.length)
  const nT = argNum('teams', TEAMS.length)
  const plan = [...SINGLES.slice(0, nS), ...TEAMS.slice(0, nT)]
  console.log(`simulating ${nS} singles + ${nT} team events, ${PARTICIPANTS} participants each (speed ${SPEED}x)\n`)

  for (const name of plan) {
    const t = byName.get(name)
    if (!t) { note(new Error('tournament missing'), name); continue }
    let ev
    try {
      ev = await call('post', 'simulateEvent', {
        tournamentId: String(t._id), date: '2026-09-05', time: '9:00 AM',
        name: `SIM ${name}`, maxParticipants: PARTICIPANTS, registrationFee: 30,
      })
      await call('post', 'generateGroups', { _id: String(ev._id) })
    } catch (e) { note(e, `setup ${name}`); continue }
    const id = String(ev._id)
    S.events.push({ name, id, participants: (ev.participants || []).length, isTeam: t.type === 'Team' })
    console.log(`  ${name}: ${(ev.participants || []).length} participants`)
    await playPending(id, t.type === 'Team', 3)
  }

  const m = readMetrics()
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0)
  console.log(`\n=== RESULT (real ${elapsed}s, simulated ${(S.simSeconds / 3600).toFixed(1)}h) ===`)
  console.log(JSON.stringify({ stats: S, metrics: m }, null, 2))
}

run().catch((e) => { console.error('FATAL', e); process.exit(1) })
